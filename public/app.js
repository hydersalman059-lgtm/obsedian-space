const C=window.OBSEDIAN_CONFIG||{}; const sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY);
const $=x=>document.getElementById(x); let session=null, currentSites=[];
async function boot(){const r=await sb.auth.getSession(); session=r.data.session; paint(); sb.auth.onAuthStateChange((_e,s)=>{session=s;paint()});}
function paint(){$("login").classList.toggle("hidden",!!session);$("dash").classList.toggle("hidden",!session); if(session)load();}
async function oauth(p){await sb.auth.signInWithOAuth({provider:p,options:{redirectTo:location.href}})}
$("google").onclick=()=>oauth("google");$("github").onclick=()=>oauth("github");
$("emailBtn").onclick=async()=>{let {error}=await sb.auth.signInWithOtp({email:$("email").value,options:{emailRedirectTo:location.href}});$("msg").textContent=error?.message||"Email link sent."};
$("phoneBtn").onclick=async()=>{let {error}=await sb.auth.signInWithOtp({phone:$("phone").value});$("msg").textContent=error?.message||"OTP sent."};
$("logout").onclick=()=>sb.auth.signOut();
async function load(){
 const u=session.user; $("hello").textContent="Welcome, "+(u.user_metadata?.full_name||u.email||"there");
 const [subR,siteR,apR]=await Promise.all([
  sb.from("subscriptions").select("*,plans(*)").eq("user_id",u.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  sb.from("websites").select("*").eq("user_id",u.id).order("created_at",{ascending:false}),
  sb.from("approvals").select("*").eq("user_id",u.id).order("created_at",{ascending:false}).limit(20)
 ]);
 const sub=subR.data, sites=siteR.data||[]; currentSites=sites;
 $("badge").textContent=sub?.plans?.name||"Free";
 $("stats").innerHTML=[["Websites",sites.length],["Limit",sub?.plans?.max_websites||0],["Status",sub?.status||"—"],["Ends",sub?.subscription_ends_at?new Date(sub.subscription_ends_at).toLocaleDateString():"—"]].map(x=>`<div class="stat"><small>${x[0]}</small><br><b>${x[1]}</b></div>`).join("");
 $("sites").innerHTML=sites.map(s=>`<div class="item"><b>${s.name||s.url}</b><br><small>${s.url} · ${s.status}</small></div>`).join("")||"<p>No websites yet.</p>";
 $("billing").innerHTML=sub?`${sub.plans.name} · ${sub.status} · ${sub.plans.max_websites} websites · ends ${sub.subscription_ends_at||"—"}`:"No plan";
 $("approvals").innerHTML=(apR.data||[]).map(a=>`<div class="item"><b>${a.title}</b><br>${a.description||""}<br><small>${a.status} · ${a.risk_level}</small>${a.status==="pending"?`<button onclick="approve('${a.id}')">Approve</button><button onclick="reject('${a.id}')">Reject</button>`:""}</div>`).join("")||"<p>No pending approvals.</p>";
}
$("add").onclick=async()=>{const {error}=await sb.from("websites").insert({user_id:session.user.id,url:$("url").value,normalized_url:new URL($("url").value).origin,name:$("name").value,status:"pending",next_crawl_at:new Date().toISOString()});if(error)alert(error.message);else load()};
async function agent(agent,task,provider="openai"){if(!currentSites[0])return alert("Add a website first");$("out").textContent="AI agent running…";let {data:{session:s}}=await sb.auth.getSession();let r=await fetch("/api/ai",{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({agent,task,provider,website_id:currentSites[0].id,context:{url:currentSites[0].url}})});$("out").textContent=JSON.stringify(await r.json(),null,2);load()}
$("audit").onclick=()=>agent("seo_auditor","Audit technical SEO, on-page SEO, content quality and observable performance. Return evidence-backed prioritized recommendations.");
$("strategy").onclick=()=>agent("seo_strategist","Create a 30-day SEO strategy with keyword themes, page opportunities, internal linking and content briefs. Mark assumptions.");
$("report").onclick=()=>agent("executive_report","Create a weekly executive report template based on currently available website signals. Never invent traffic or rankings.");
document.querySelectorAll("[data-plan]").forEach(b=>b.onclick=async()=>{let {data:{session:s}}=await sb.auth.getSession();let r=await fetch("/api/checkout",{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({plan:b.dataset.plan,billing_cycle:"monthly"})});alert(JSON.stringify(await r.json()))});
$("ticket").onclick=async()=>{let {error}=await sb.from("support_tickets").insert({user_id:session.user.id,subject:$("subject").value,message:$("support").value});alert(error?.message||"Ticket created")};
window.approve=async id=>{await sb.from("approvals").update({status:"approved",approved_at:new Date().toISOString()}).eq("id",id).eq("user_id",session.user.id);load()};
window.reject=async id=>{await sb.from("approvals").update({status:"rejected"}).eq("id",id).eq("user_id",session.user.id);load()};
boot();
