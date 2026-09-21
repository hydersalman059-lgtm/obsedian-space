import { createClient } from "npm:@supabase/supabase-js@2";
export function client(){
 return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
}
export async function userFrom(req:Request){
 const token=req.headers.get("Authorization")?.replace("Bearer ","");
 if(!token)return null;
 const sb=client(); const {data:{user}}=await sb.auth.getUser(token);
 return user;
}
