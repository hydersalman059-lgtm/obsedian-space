export async function onRequestPost(c){
 const a=c.request.headers.get("Authorization");if(!a)return Response.json({error:"Unauthorized"},{status:401});
 return Response.json({status:"configure_required",message:"Connect this endpoint to your Razorpay subscription-creation Edge Function and verified webhook before accepting production payments."});
}
