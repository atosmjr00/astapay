import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(){
 try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({user:null});
 const {data:profile}=await supabase.from("profiles").select("full_name,kyc_status").eq("id",user.id).maybeSingle();
 return NextResponse.json({user:{id:user.id,email:user.email,name:profile?.full_name||user.user_metadata?.full_name||"",kycStatus:profile?.kyc_status||"pending"}});
 }catch{return NextResponse.json({user:null});}
}
