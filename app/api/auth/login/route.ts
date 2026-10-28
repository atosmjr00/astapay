import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({email:z.email().trim().max(254),password:z.string().min(1).max(128)});
export async function POST(req:Request){
 const parsed=schema.safeParse(await req.json());
 if(!parsed.success)return NextResponse.json({error:"E-mail ou senha inválidos."},{status:400});
 try{
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});
  if(error||!data.user)return NextResponse.json({error:"Não foi possível entrar. Confira e-mail e senha ou confirme seu e-mail."},{status:401});
  return NextResponse.json({user:{id:data.user.id,email:data.user.email}});
 }catch{return NextResponse.json({error:"Falha ao iniciar sessão. Confira o Supabase."},{status:500});}
}
