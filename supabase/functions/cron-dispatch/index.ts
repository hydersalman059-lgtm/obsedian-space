import {client} from "../_shared/auth.ts";
Deno.serve(async(req)=>{
 const sb=client();
 await sb.rpc("pause_expired_subscriptions");
 const {data:sites}=await sb.from("websites").select("id,user_id").lte("next_crawl_at",new Date().toISOString()).eq("status","active").limit(100);
 for(const s of sites||[]){
   await sb.from("jobs").insert({user_id:s.user_id,website_id:s.id,type:"audit",status:"queued",payload:{source:"cron"}});
   await sb.from("websites").update({next_crawl_at:new Date(Date.now()+7*86400000).toISOString()}).eq("id",s.id);
 }
 return Response.json({queued:sites?.length||0});
});
