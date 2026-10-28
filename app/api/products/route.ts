import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({name:z.string().trim().min(2).max(120),description:z.string().trim().max(3000).optional().default(""),priceCents:z.number().int().min(100).max(100000000),status:z.enum(["draft","active"]).default("draft")});
export async function GET(){
 try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login."},{status:401});
 const {data,error}=await supabase.from("products").select("id,name,description,price_cents,status,slug,created_at").eq("seller_id",user.id).order("created_at",{ascending:false});
 if(error)throw error;return NextResponse.json({products:data||[]});
 }catch{return NextResponse.json({error:"Não foi possível carregar os produtos."},{status:500});}
}
export async function POST(req:Request){
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Confira nome e preço do produto."},{status:400});
 try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para criar produtos."},{status:401});
 const slug=`${parsed.data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)}-${crypto.randomUUID().slice(0,8)}`;
 const {data,error}=await supabase.from("products").insert({seller_id:user.id,name:parsed.data.name,description:parsed.data.description,price_cents:parsed.data.priceCents,status:parsed.data.status,slug}).select("id,name,description,price_cents,status,slug,created_at").single();
 if(error)throw error;return NextResponse.json({product:data},{status:201});
 }catch{return NextResponse.json({error:"Não foi possível salvar o produto. Verifique se a migração do Supabase foi aplicada."},{status:500});}
}
