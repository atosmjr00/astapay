import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(receivedHex) || !/^[a-f0-9]{64}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const secret = process.env.NOMAPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-nomapay-signature") || "";
  const suppliedSignature = signatureHeader.replace(/^sha256=/i, "");
  const expectedSignature = createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8")).digest("hex");
  if (!safeEqualHex(expectedSignature, suppliedSignature)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const deliveryId = request.headers.get("x-nomapay-delivery-id");
  const eventName = request.headers.get("x-nomapay-event");
  if (!deliveryId || deliveryId.length > 200 || !eventName || eventName.length > 120) {
    return NextResponse.json({ error: "Headers do evento inválidos." }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: eventError } = await supabase.from("webhook_events").insert({
    delivery_id: deliveryId,
    event_name: eventName,
    payload,
  });
  if (eventError?.code === "23505") {
    const { data: existing } = await supabase.from("webhook_events")
      .select("processed_at,processing_error").eq("delivery_id", deliveryId).maybeSingle();
    if (existing?.processed_at && !existing.processing_error) return NextResponse.json({ received: true, duplicate: true });
    // Failed or interrupted deliveries can be retried and processed again below.
  } else if (eventError) {
    return NextResponse.json({ error: "Não foi possível persistir o evento." }, { status: 500 });
  }

  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const transactionId = [data.transaction_id, data.id].find((v) => typeof v === "string" && v.startsWith("fsp_tx_"));
  if (typeof transactionId !== "string") {
    await supabase.from("webhook_events").update({ processed_at: new Date().toISOString(), processing_error: "transaction id missing or unsupported event" }).eq("delivery_id", deliveryId);
    return NextResponse.json({ received: true });
  }

  if (eventName === "transaction.paid") {
    const { data: order, error: orderError } = await supabase.from("orders")
      .select("id,amount_cents,status,gateway_transaction_id")
      .eq("gateway_transaction_id", transactionId).maybeSingle();
    if (orderError) return NextResponse.json({ error: "Falha ao consultar pedido." }, { status: 500 });
    if (!order) {
      await supabase.from("webhook_events").update({ processing_error: "order not found" }).eq("delivery_id", deliveryId);
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    const amount = data.amount;
    if (typeof amount !== "number" || amount !== order.amount_cents) {
      await supabase.from("webhook_events").update({ processing_error: "amount mismatch" }).eq("delivery_id", deliveryId);
      return NextResponse.json({ error: "Valor da transação não confere." }, { status: 409 });
    }
    if (order.status !== "paid") {
      const { error: paidError } = await supabase.from("orders").update({
        status: "paid",
        paid_at: typeof data.paid_at === "string" ? data.paid_at : new Date().toISOString(),
      }).eq("id", order.id).eq("status", "pending");
      if (paidError) return NextResponse.json({ error: "Falha ao atualizar pedido." }, { status: 500 });
    }
  } else if (eventName === "transaction.failed") {
    await supabase.from("orders").update({ status: "cancelled" })
      .eq("gateway_transaction_id", transactionId).eq("status", "pending");
  }

  await supabase.from("webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("delivery_id", deliveryId);
  return NextResponse.json({ received: true });
}
