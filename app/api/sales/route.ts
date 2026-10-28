import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(){
 try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login."},{status:401});
 const {data,error}=await supabase.from("orders").select("id,customer_name,customer_email,amount_cents,platform_fee_cents,status,paid_at,created_at,products(name)").eq("seller_id",user.id).order("created_at",{ascending:false}).limit(100);
 if(error)throw error;return NextResponse.json({sales:data||[]});
 }catch{return NextResponse.json({error:"Não foi possível carregar as vendas."},{status:500});}
}
