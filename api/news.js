const FEEDS = [
  "Tinubu Nigeria",
  "Surulere Lagos council projects",
  "Agboola Dabiri Surulere",
  "Hamzat Lagos",
  "Princess Damilola Sonayon-James",
  "Wasiu Ayinde Amzat Lagos",
  "Fuad Laguda Barakat Surulere",
  "THE-LAB Surulere APC",
  "Surulere community meeting Lagos"
];
const TRUSTED = ["statehouse.gov.ng","punchng.com","thecable.ng","guardian.ng","vanguardngr.com","channelstv.com","premiumtimesng.com","thisdaylive.com","businessday.ng","radionigerialagos.gov.ng","rhythm937.com","thenationonlineng.com","tribuneonlineng.com","dailytrust.com","blueprint.ng"];
const esc = s => String(s || "").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();
const tag = (s,n) => { const m=s.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i")); return m ? esc(m[1]) : ""; };

module.exports = async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key) return res.status(503).json({error:"News storage is not configured"});
  const headers={apikey:key,authorization:"Bearer "+key,"content-type":"application/json"};
  const rest=base.replace(/\/$/,"")+"/rest/v1/news_articles";
  const auth=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const isCron=Boolean(process.env.CRON_SECRET && auth===process.env.CRON_SECRET);

  // Public GET requests read the news feed. Vercel Cron GET requests carry
  // Authorization: Bearer <CRON_SECRET> and run the scheduled refresh.
  if(req.method==="GET" && !isCron){
    try{
      const r=await fetch(rest+"?select=id,title,summary,source_name,source_url,image_url,published_at,topic&status=eq.published&order=published_at.desc.nullslast&limit=30",{headers});
      if(!r.ok) throw new Error("News read failed");
      return res.status(200).json({articles:await r.json()});
    }catch(e){return res.status(502).json({error:"News is temporarily unavailable"});}
  }
  if(req.method!=="GET" && req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  if(!isCron) return res.status(401).json({error:"Unauthorized"});

  try{
    const feeds=await Promise.all(FEEDS.map(async term=>{
      try{
        const url="https://news.google.com/rss/search?q="+encodeURIComponent(term+" when:7d")+"&hl=en-NG&gl=NG&ceid=NG:en";
        const response=await fetch(url,{headers:{"User-Agent":"SurulereForContinuityNews/1.0"}});
        if(!response.ok) return {term,items:[]};
        const xml=await response.text();
        return {term,items:[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1])};
      }catch(_){return {term,items:[]};}
    }));
    const unique=new Map();
    let scanned=0;
    for(const feed of feeds){
      for(const item of feed.items){
        scanned++;
        const title=tag(item,"title"),link=tag(item,"link"),desc=tag(item,"description");
        const sourceMatch=item.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);
        const sourceName=sourceMatch?esc(sourceMatch[1]):"Google News";
        const sourceHref=item.match(/<source\b[^>]*\burl=["']([^"']+)["']/i);
        if(!title||!/^https:\/\//i.test(link)) continue;
        let publisherHost="";
        try{if(sourceHref)publisherHost=new URL(sourceHref[1]).hostname.replace(/^www\./,"");}catch(_){}
        const trustedDomain=TRUSTED.some(d=>publisherHost===d||publisherHost.endsWith("."+d));
        const trustedName=/state house|punch|the cable|guardian|vanguard|channels television|premium times|thisday|businessday|radio nigeria lagos|rhythm|the nation|daily trust|blueprint/i.test(sourceName);
        const trusted=trustedDomain||trustedName;
        const parsedDate=Date.parse(tag(item,"pubDate"));
        const date=Number.isFinite(parsedDate)?new Date(parsedDate).toISOString():new Date().toISOString();
        unique.set(link,{title,summary:desc.slice(0,700)||"Open the original report for details.",source_name:sourceName,source_url:link,published_at:date,topic:feed.term,status:trusted?"published":"review"});
      }
    }
    const payload=[...unique.values()];
    if(!payload.length) return res.status(200).json({ok:true,scanned,inserted:0,published:0,held_for_review:0,checked_at:new Date().toISOString()});
    const save=await fetch(rest+"?on_conflict=source_url",{method:"POST",headers:{...headers,Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(payload)});
    if(!save.ok) return res.status(502).json({error:"News storage update failed",scanned});
    const inserted=await save.json();
    const insertedPublished=inserted.filter(x=>x.status==="published").length;
    const insertedReview=inserted.length-insertedPublished;
    return res.status(200).json({ok:true,scanned,inserted:inserted.length,published:insertedPublished,held_for_review:insertedReview,checked_at:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:"News refresh failed"});}
};
