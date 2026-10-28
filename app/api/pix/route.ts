import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  productId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().max(254),
    phone: z.string().trim().max(24).optional(),
    cpf: z.string().trim().optional(),
  }),
});
export const runtime = "nodejs";

type NomapayPixResponse = {
  success?: boolean;
  id?: string;
  transaction_id?: string;
  status?: string;
  amount?: number;
  pix_copy_paste?: string;
  pix_qr_code?: string;
  pix?: { copy_paste?: string; qr_code?: string; expires_at?: string };
};

export async function POST(request: Request) {
  let orderId: string | null = null;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const publicKey = process.env.NOMAPAY_PUBLIC_KEY;
    const secretKey = process.env.NOMAPAY_SECRET_KEY;
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    const webhookUrl = appUrl ? `${appUrl}/api/webhooks/nomapay` : null;
    if (!publicKey || !secretKey || !webhookUrl || !process.env.NOMAPAY_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Checkout ainda não está configurado para pagamentos reais.", code: "GATEWAY_NOT_CONFIGURED" }, { status: 503 });
    }
    const supabase = createAdminClient();

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id,name,price_cents,status,seller_id")
      .eq("id", parsed.data.productId)
      .eq("status", "active")
      .single();
    if (productError || !product) return NextResponse.json({ error: "Produto não encontrado ou indisponível." }, { status: 404 });

    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim() || randomUUID();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return NextResponse.json({ error: "Chave de idempotência inválida." }, { status: 400 });
    }
    const cpf = parsed.data.customer.cpf?.replace(/\D/g, "");
    if (cpf && cpf.length !== 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      product_id: product.id,
      seller_id: product.seller_id,
      customer_name: parsed.data.customer.name,
      customer_email: parsed.data.customer.email.toLowerCase(),
      customer_document_hash: cpf ? createHash("sha256").update(cpf).digest("hex") : null,
      amount_cents: product.price_cents,
      platform_fee_cents: 50,
      status: "pending",
      gateway_name: "nomapay",
      idempotency_key: idempotencyKey,
    }).select("id,amount_cents").single();

    if (orderError || !order) {
      if (orderError?.code === "23505") {
        const { data: existing } = await supabase.from("orders")
          .select("id,status,pix_code,expires_at,amount_cents")
          .eq("idempotency_key", idempotencyKey).maybeSingle();
        if (existing) return NextResponse.json({
          orderId: existing.id, status: existing.status, pixCopyPaste: existing.pix_code,
          expiresAt: existing.expires_at, amountCents: existing.amount_cents,
        });
      }
      return NextResponse.json({ error: "Não foi possível criar o pedido." }, { status: 500 });
    }
    orderId = order.id;

    const customer: Record<string, string | { number: string; type: "CPF" }> = {
      name: parsed.data.customer.name,
      email: parsed.data.customer.email.toLowerCase(),
    };
    if (parsed.data.customer.phone) customer.phone = parsed.data.customer.phone.replace(/\D/g, "");
    if (cpf) customer.document = { number: cpf, type: "CPF" };

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
    const gatewayResponse = await fetch("https://nomaofficial.com.br/api/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        amount: order.amount_cents,
        payment_method: "PIX",
        postback_url: webhookUrl,
        customer,
        items: [{ title: product.name, unit_price: order.amount_cents, quantity: 1, tangible: false }],
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const raw = await gatewayResponse.text();
    let gateway: NomapayPixResponse;
    try { gateway = JSON.parse(raw) as NomapayPixResponse; }
    catch {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id).eq("status", "pending");
      return NextResponse.json({ error: "Resposta inválida do gateway." }, { status: 502 });
    }

    const transactionId = gateway.transaction_id || gateway.id;
    const copyPaste = gateway.pix?.copy_paste || gateway.pix_copy_paste;
    const qrCode = gateway.pix?.qr_code || gateway.pix_qr_code;
    if (!gatewayResponse.ok || !transactionId || !copyPaste || (gateway.amount !== undefined && gateway.amount !== order.amount_cents)) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id).eq("status", "pending");
      return NextResponse.json({ error: "O gateway não confirmou a criação da cobrança." }, { status: 502 });
    }

    const { error: updateError } = await supabase.from("orders").update({
      gateway_transaction_id: transactionId,
      pix_code: copyPaste,
      pix_qr_code_url: qrCode || null,
      expires_at: gateway.pix?.expires_at || null,
    }).eq("id", order.id);
    if (updateError) {
      return NextResponse.json({ error: "Cobrança criada, mas a confirmação local falhou. Contate o suporte com o pedido.", orderId: order.id }, { status: 502 });
    }

    return NextResponse.json({
      orderId: order.id,
      transactionId,
      status: gateway.status || "WAITING_PAYMENT",
      amountCents: order.amount_cents,
      pixCopyPaste: copyPaste,
      qrCodeUrl: qrCode || null,
      expiresAt: gateway.pix?.expires_at || null,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível processar o checkout." }, { status: 500 });
  }
}
