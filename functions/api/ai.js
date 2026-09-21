export async function onRequestPost(c){
 const a=c.request.headers.get("Authorization"); if(!a)return Response.json({error:"Unauthorized"},{status:401});
 const r=await fetch(`${c.env.SUPABASE_URL}/functions/v1/ai-orchestrator`,{method:"POST",headers:{"Authorization":a,"apikey":c.env.SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:await c.request.text()});
 return new Response(await r.text(),{status:r.status,headers:{"Content-Type":"application/json"}});
}
