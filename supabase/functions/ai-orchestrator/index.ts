import {client,userFrom} from "../_shared/auth.ts";
import {json,cors} from "../_shared/cors.ts";

async function openai(prompt:string){
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("OPENAI_API_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5-mini",input:prompt})});
 return await r.json();
}
async function claude(prompt:string){
 const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":Deno.env.get("ANTHROPIC_API_KEY")!,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:3000,messages:[{role:"user",content:prompt}]})});
 return await r.json();
}
async function gemini(prompt:string){
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
 return await r.json();
}
async function perplexity(prompt:string){
 const r=await fetch("https://api.perplexity.ai/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("PERPLEXITY_API_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({model:"sonar",messages:[{role:"user",content:prompt}]})});
 return await r.json();
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const user=await userFrom(req); if(!user)return json({error:"Unauthorized"},401);
 const sb=client(); const body=await req.json(); const provider=body.provider||"openai";
 const {data:ent}=await sb.rpc("current_entitlement");
 if(!ent?.[0] || !["trial","active"].includes(ent[0].status) || (ent[0].ends_at && new Date(ent[0].ends_at)<=new Date()))
   return json({error:"subscription_paused"},402);
 const prompt=`You are an Obsedian.Space ${body.agent||"marketing"} agent.
Rules: use evidence; never invent traffic/rankings/conversions; identify estimates; return JSON where possible; ad execution must remain approval-gated.
Website context:
${JSON.stringify(body.context||{})}
Task:
${body.task||""}`;
 const started=Date.now(); let result:any;
 if(provider==="claude")result=await claude(prompt);
 else if(provider==="gemini")result=await gemini(prompt);
 else if(provider==="perplexity")result=await perplexity(prompt);
 else result=await openai(prompt);
 await sb.from("ai_runs").insert({user_id:user.id,website_id:body.website_id||null,agent:body.agent||"general",provider,status:"completed",latency_ms:Date.now()-started,result});
 await sb.from("usage_events").insert({user_id:user.id,event_type:"ai_run",provider,units:1,metadata:{agent:body.agent}});
 return json({provider,result});
});
