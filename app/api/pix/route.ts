import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema = z.object({ productId: z.string().uuid(), customer: z.object({ name: z.string().trim().min(2).max(120), email: z.email().max(254), document: z.string().regex(/^\\d{11}$|^\\d{14}$/) }) });
export const runtime = "nodejs";
export async function POST(request: Request) {
 try {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { data: product, error } = await supabase.from("products").select("id,name,price_cents,status,seller_id").eq("id", parsed.data.productId).eq("status", "active").single();
  if (error || !product) return NextResponse.json({ error: "Produto não encontrado ou indisponível." }, { status: 404 });
  if (!process.env.NOMAPAY_SECRET_KEY || !process.env.NOMAPAY_CREATE_PIX_PATH) return NextResponse.json({ error: "Gateway Pix não configurado; pagamentos reais estão desabilitados.", code: "GATEWAY_NOT_CONFIGURED" }, { status: 503 });
  return NextResponse.json({ error: "Adaptador NOMAPAY bloqueado até validação da documentação oficial, assinatura do webhook e idempotência.", code: "GATEWAY_ADAPTER_PENDING" }, { status: 503 });
 } catch { return NextResponse.json({ error: "Não foi possível processar a solicitação." }, { status: 500 }); }
}
