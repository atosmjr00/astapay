import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
const schema=z.object({orderId:z.string().uuid(),slug:z.string().min(1).max(180)});
export async function GET(req:Request){
 const parsed=schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
 if(!parsed.success)return NextResponse.json({error:"Consulta inválida."},{status:400});
 try{const db=createAdminClient();const {data,error}=await db.from("orders").select("id,status,paid_at,expires_at,products!inner(slug)").eq("id",parsed.data.orderId).eq("products.slug",parsed.data.slug).single();
 if(error||!data)return NextResponse.json({error:"Pedido não encontrado."},{status:404});
 return NextResponse.json({orderId:data.id,status:data.status,paidAt:data.paid_at,expiresAt:data.expires_at});
 }catch{return NextResponse.json({error:"Status do pedido indisponível."},{status:503});}
}
