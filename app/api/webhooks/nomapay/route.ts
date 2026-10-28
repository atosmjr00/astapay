import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST() {
 if (!process.env.NOMAPAY_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
 return NextResponse.json({ error: "Validação oficial de assinatura, idempotência e conciliação ainda não implementadas." }, { status: 501 });
}
