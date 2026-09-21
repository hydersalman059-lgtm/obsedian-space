export async function onRequestGet(c){
 const a=c.request.headers.get("Authorization");if(!a)return Response.json({error:"Unauthorized"},{status:401});
 const r=await fetch(`${c.env.SUPABASE_URL}/functions/v1/admin`,{headers:{"Authorization":a,"apikey":c.env.SUPABASE_PUBLISHABLE_KEY}});
 return new Response(await r.text(),{status:r.status,headers:{"Content-Type":"application/json"}});
}
