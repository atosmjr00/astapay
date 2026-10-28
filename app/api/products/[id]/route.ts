import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({status:z.enum(["draft","active"])});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Status inválido."},{status:400});
 try{const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login."},{status:401});
 const {data,error}=await supabase.from("products").update({status:parsed.data.status}).eq("id",id).eq("seller_id",user.id).select("id,name,description,price_cents,status,slug,created_at").single();
 if(error||!data)return NextResponse.json({error:"Não foi possível atualizar o produto."},{status:400});return NextResponse.json({product:data});
 }catch{return NextResponse.json({error:"Falha ao atualizar produto."},{status:500});}
}
