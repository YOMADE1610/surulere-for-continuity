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
const TRUSTED = ["statehouse.gov.ng","punchng.com","thecable.ng","guardian.ng","vanguardngr.com","channelstv.com","premiumtimesng.com","thisdaylive.com","businessday.ng","radionigerialagos.gov.ng","rhythm937.com","thenationonlineng.net","tribuneonlineng.com","dailytrust.com","blueprint.ng"];
const esc = s => String(s || "").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();
const tag = (s,n) => { const m=s.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i")); return m ? esc(m[1]) : ""; };
module.exports = async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key) return res.status(503).json({error:"News storage is not configured"});
  const headers={apikey:key,authorization:"Bearer "+key,"content-type":"application/json"};
  if(req.method==="GET"){
    try{
      const r=await fetch(base.replace(/\/$/,"")+"/rest/v1/news_articles?select=id,title,summary,source_name,source_url,image_url,published_at,topic&status=eq.published&order=published_at.desc.nullslast&limit=30",{headers});
      if(!r.ok) throw new Error("News read failed");
      return res.status(200).json({articles:await r.json()});
    }catch(e){return res.status(502).json({error:"News is temporarily unavailable"});}
  }
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const auth=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!process.env.CRON_SECRET||auth!==process.env.CRON_SECRET) return res.status(401).json({error:"Unauthorized"});
  let added=0, reviewed=0, scanned=0;
  try{
    for(const term of FEEDS){
      const url="https://news.google.com/rss/search?q="+encodeURIComponent(term+" when:7d")+"&hl=en-NG&gl=NG&ceid=NG:en";
      const response=await fetch(url,{headers:{"User-Agent":"SurulereForContinuityNews/1.0"}});
      if(!response.ok) continue;
      const xml=await response.text();
      const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
      for(const item of items){
        scanned++;
        const title=tag(item,"title"), link=tag(item,"link"), desc=tag(item,"description");
        const sourceMatch=item.match(/<source\\b[^>]*url=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/source>/i);
        const source=sourceMatch?esc(sourceMatch[2]):"Google News";
        const publisherUrl=sourceMatch?sourceMatch[1]:link;
        if(!title||!/^https:\/\//i.test(link)) continue;
        let host=""; try{host=new URL(link).hostname.replace(/^www\./,"");}catch(_){continue;}
        const sourceTag=item.match(/<source([^>]*)>([\\s\\S]*?)<\\/source>/i);
        const sourceName=esc(sourceTag?.[2]||source);
        const sourceHref=(sourceTag?.[1]||"").match(/url=["']([^"']+)["']/i)?.[1]||"";
        let publisherHost=host;
        try{if(sourceHref)publisherHost=new URL(sourceHref).hostname.replace(/^www\\./,"");}catch(_){}
        const trustedDomain=TRUSTED.some(d=>publisherHost===d||publisherHost.endsWith("."+d));
        const trustedName=/state house|punch|the cable|guardian|vanguard|channels television|premium times|thisday|businessday|radio nigeria lagos|rhythm|the nation|daily trust|blueprint/i.test(sourceName);
        const trusted=trustedDomain||trustedName;
        const date=Date.parse(tag(item,"pubDate"))||Date.now();
        const cleanSummary=desc.slice(0,700)||"Open the original report for details.";
        const payload={title,summary:cleanSummary,source_name:sourceName,source_url:link,published_at:new Date(date).toISOString(),topic:term,status:trusted?"published":"review"};
        const save=await fetch(base.replace(/\/$/,"")+"/rest/v1/news_articles?on_conflict=source_url",{method:"POST",headers:{...headers,Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(payload)});
        if(save.ok){if(trusted)added++;else reviewed++;}
      }
    }
    return res.status(200).json({ok:true,scanned,inserted:added,held_for_review:reviewed,checked_at:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:"News refresh failed",scanned,inserted:added});}
};