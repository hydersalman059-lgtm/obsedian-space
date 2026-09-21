import {client,userFrom} from "../_shared/auth.ts";
import {json,cors} from "../_shared/cors.ts";
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const u=await userFrom(req); if(!u)return json({error:"Unauthorized"},401);
 const sb=client(); const {data:p}=await sb.from("profiles").select("role").eq("id",u.id).single();
 if(p?.role!=="admin")return json({error:"Admin only"},403);
 const {data:m}=await sb.rpc("admin_metrics");
 const {data:logs}=await sb.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(100);
 return json({metrics:m,logs});
});
