import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(){
 try{const supabase=await createClient();await supabase.auth.signOut();return NextResponse.json({ok:true});}
 catch{return NextResponse.json({error:"Não foi possível encerrar a sessão."},{status:500});}
}
