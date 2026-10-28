import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
export async function GET(_req:Request,{params}:{params:Promise<{slug:string}>}){
 try{const {slug}=await params;const db=createAdminClient();const {data,error}=await db.from("products").select("id,name,description,price_cents,slug").eq("slug",slug).eq("status","active").single();
 if(error||!data)return NextResponse.json({error:"Produto não encontrado."},{status:404});
 return NextResponse.json({product:data});
 }catch{return NextResponse.json({error:"Checkout indisponível."},{status:503});}
}
