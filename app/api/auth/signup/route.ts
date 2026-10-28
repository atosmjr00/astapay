import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({name:z.string().trim().min(2).max(120),email:z.email().trim().max(254),password:z.string().min(8).max(128)});
export async function POST(req:Request){
 const parsed=schema.safeParse(await req.json());
 if(!parsed.success)return NextResponse.json({error:"Confira nome, e-mail e senha (mínimo de 8 caracteres)."}, {status:400});
 try{
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signUp({email:parsed.data.email,password:parsed.data.password,options:{data:{full_name:parsed.data.name}}});
  if(error)return NextResponse.json({error:error.message}, {status:400});
  if(data.user && data.session) return NextResponse.json({user:{id:data.user.id,email:data.user.email},needsEmailConfirmation:false});
  return NextResponse.json({needsEmailConfirmation:true,message:"Confira seu e-mail para confirmar a conta e depois entre na AstaPay."},{status:201});
 }catch{return NextResponse.json({error:"Não foi possível criar a conta. Confira a configuração do Supabase."},{status:500});}
}
