import {client} from "../_shared/auth.ts";
Deno.serve(async(req)=>{
 const raw=await req.text();
 const signature=req.headers.get("X-Razorpay-Signature");
 if(!signature)return new Response("missing signature",{status:400});
 // Production: verify HMAC-SHA256(raw, RAZORPAY_WEBHOOK_SECRET) before parsing.
 // Then map verified subscription/payment events to provider_subscription_id and update
 // subscriptions.subscription_ends_at/status.
 console.log("Verified webhook implementation placeholder",raw.slice(0,200));
 return new Response("ok");
});
