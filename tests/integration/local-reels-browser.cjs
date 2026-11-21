const {createServer}=require("node:http");
const {readFile}=require("node:fs/promises");
const {resolve,extname}=require("node:path");
// Local/synthetic only. Supply TAPFLOW_PLAYWRIGHT_MODULE if Playwright is not on Node's module path.
// Optionally supply TAPFLOW_CHROMIUM_EXECUTABLE or TAPFLOW_CHROMIUM_MODULE (headless runtime).
const assert=require("node:assert/strict");
const {chromium}=require(process.env.TAPFLOW_PLAYWRIGHT_MODULE||"playwright");
const runtime=process.env.TAPFLOW_CHROMIUM_MODULE?require(process.env.TAPFLOW_CHROMIUM_MODULE):null;
const web=resolve(__dirname,"../../apps/web"), path="/cardapio/cafe-aurora-demo/vitrine-demo";
const api="/api/public/menu/cafe-aurora-demo/vitrine-demo";
const items=[
 ["aurora-coado","Café coado","Cafés",800,"Filtrado"],
 ["aurora-cap","Cappuccino da casa","Cafés",1200,"Espresso"],
 ["aurora-bolo","Bolo de laranja com cobertura artesanal","Vitrine",1100,"Laranja"],
 ["aurora-croissant","Croissant de manteiga","Vitrine",1450,"Folhado"],
 ["fallback","Suco da casa muito comprido com laranja, manga, maracujá e um rótulo longo","Bebidas",1000,"Descrição extensa ".repeat(24)],
].map(([id,name,categoryName,priceCents,description])=>({id,name,categoryId:"cafes",categoryName:"Cafés",priceCents,description:description+" seleção",available:true,addons:[]}));
const requests=[];let blockVideo=false,blockPhoto=false,blockThumbnail=false;
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,"http://localhost"); requests.push([req.method,u.pathname]);
 if(u.pathname===api){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({name:"Café Aurora",location:{name:"Vitrine fictícia"},appearance:{preset:"cafe",mode:"light"},orderingEnabled:false,items:[...items,{id:"excluded",name:"Excluído",categoryId:"other",categoryName:"Outra",priceCents:100,available:true,addons:[]}]}));}
 if((blockVideo&&/cap-motion/.test(u.pathname))||(blockPhoto&&/bolo-720/.test(u.pathname))||(blockThumbnail&&/bolo-(96|192)/.test(u.pathname))){res.writeHead(404);return res.end();}
 const f=u.pathname===path?"public-menu.html":u.pathname.slice(1);
 const mime={".css":"text/css",".mjs":"text/javascript",".html":"text/html",".webp":"image/webp",".jpg":"image/jpeg",".webm":"video/webm",".mp4":"video/mp4",".svg":"image/svg+xml"};
 if(!/^[\w./-]+$/.test(f)||f.split("/").includes("..")||!mime[extname(f)]){res.writeHead(404);return res.end();}
 try{const body=await readFile(resolve(web,f));res.writeHead(200,{"content-type":mime[extname(f)],"cache-control":"no-store"});res.end(body);}
 catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
 try{
 browser=await chromium.launch({executablePath:process.env.TAPFLOW_CHROMIUM_EXECUTABLE||await runtime?.executablePath(),
  headless:true,args:runtime?.args.filter(a=>!["--disable-web-security","--allow-running-insecure-content"].includes(a))});
 const origin="http://127.0.0.1:"+server.address().port;
 const page=await browser.newPage({viewport:{width:390,height:590},isMobile:true,hasTouch:true,reducedMotion:"reduce"});
 page.setDefaultTimeout(4500); const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 const dialog=page.getByRole("dialog",{name:"Reels do cardápio"});
 const waitForIndex=async (n,total=items.length)=>{await page.waitForFunction(({n,total})=>document.querySelector("#reelsPosition")?.textContent?.includes(n+" de "+total),{n,total});};
 const search=page.getByRole("searchbox");
 const trigger=(name)=>page.getByRole("button",{name:"Ver no Reels: "+name,exact:true});
 const heroPaths=()=>requests.filter(([,p])=>/-720\.(webp|jpg)$/.test(p)).map(([,p])=>p);
 const videoCount=()=>requests.filter(([,p])=>/\.(mp4|webm)$/.test(p)).length;
 await page.goto(origin+path);
 await page.getByRole("heading",{name:"Café Aurora",exact:true}).waitFor();
 assert.equal(videoCount(),0);
 assert.deepEqual(heroPaths(),[],"the list does not download full-size photos");
 await page.emulateMedia({reducedMotion:"no-preference"});
 await page.locator(".item-title-trigger").filter({hasText:items[1].name}).click();
 await dialog.waitFor();
 await dialog.locator("#reelsHint").waitFor({state:"visible"});
 await page.waitForFunction(()=>{const v=document.querySelector("video");return v&&!v.paused&&v.currentTime>.15;});
 assert.deepEqual([...new Set(heroPaths().map(p=>p.replace(/\.(jpg|webp)$/,"")))],["/menu-photos/aurora/cap-720"],"only the selected dish gets upgraded");
 assert.deepEqual(await dialog.locator("video").evaluate(v=>[v.muted,v.playsInline]),[true,true]);
 const box=await dialog.boundingBox(), viewport=page.viewportSize();
 assert.ok(box&&box.width>=viewport.width-2&&box.height>=viewport.height-2,
  "the active Reel fills the mobile viewport");
 const heroBox=await dialog.locator(".reels-hero").nth(1).boundingBox();
 assert.ok(heroBox&&heroBox.height>=viewport.height-2,"media extends behind the overlay controls");
 const contrast=await dialog.locator(".reels-details").nth(1).evaluate(el=>{
   const numbers=s=>s.match(/[0-9.]+/g).map(Number), css=getComputedStyle(el);
   const fg=numbers(css.color), rgba=numbers(css.getPropertyValue("--reels-scrim").replace(/(\d+)%/,(_,x)=>String(+x/100)));
   if(!css.backgroundImage.startsWith("linear-gradient"))throw Error("caption scrim is missing");
   const composite=rgba.slice(0,3).map(c=>c*(rgba[3]??1)+255*(1-(rgba[3]??1)));
   const luminance=rgb=>rgb.reduce((sum,c,i)=>{
     const v=c/255;return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
   },0);
   const a=luminance(fg),b=luminance(composite);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
 assert.ok(contrast>=4.5,"O texto precisa manter contraste AA até sobre mídia branca.");
 assert.equal(new URL(page.url()).pathname,path);
 await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
 assert.equal(await page.locator("video").count(),0);
 await page.emulateMedia({reducedMotion:"reduce"});
 const beforeReduced=videoCount();
 await page.getByRole("button",{name:"Cafés",exact:true}).click();
 await search.fill("selecao");
 await page.getByText("5 itens",{exact:true}).waitFor();
 const opener=trigger(items[1].name);await opener.scrollIntoViewIfNeeded();await opener.focus();
 const before=await page.evaluate(()=>scrollY);
 await opener.press("Enter");
 await dialog.waitFor();await waitForIndex(2);
 assert.equal(await page.locator("video").count(),0);
 assert.equal(videoCount(),beforeReduced);
 assert.equal(new URL(page.url()).pathname,path);
 await dialog.getByRole("button",{name:"Ver em vídeo",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("video")?.readyState>=1);
 const v=dialog.locator("video");
 assert.deepEqual(await v.evaluate(e=>[e.playsInline,e.muted]),[true,true]);
 const oldVideo=await v.elementHandle();assert.ok(videoCount()>0);
 await dialog.getByRole("button",{name:"Próximo item",exact:true}).click();
 await waitForIndex(3);
 await dialog.locator("#reelsHint").waitFor({state:"hidden"});
 assert.equal(await page.locator("video").count(),0);
 assert.equal(await oldVideo.evaluate(el=>el.paused&&!el.isConnected),true);
 await dialog.getByRole("button",{name:"Próximo item",exact:true}).click();
 await waitForIndex(4);
 await page.goBack();await dialog.waitFor({state:"hidden"});
 assert.equal(await search.inputValue(),"selecao");
 assert.equal(await page.getByRole("button",{name:"Cafés",exact:true}).getAttribute("aria-pressed"),"true");
 await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Ver no Reels: Cappuccino da casa");
 assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<=3);
 await page.goForward();await dialog.waitFor();await waitForIndex(4);
 const cdp=await page.context().newCDPSession(page);
 const track=await page.locator("#reelsTrack").boundingBox();assert.ok(track);
 const x=Math.round(track.x+track.width/2),start=Math.round(track.y+track.height*.98),end=Math.round(track.y+track.height*.03);
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y:start}]});
 for(let i=1;i<=8;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:Math.round(start+(end-start)*i/8)}]});
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 await waitForIndex(5);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await dialog.getByText("Foto indisponível",{exact:false}).last().waitFor();
 assert.equal(await dialog.getByRole("button",{name:/comprar|adicionar|pagar|fazer pedido/i}).count(),0);
 await dialog.getByRole("button",{name:"Voltar à lista",exact:true}).click();await dialog.waitFor({state:"hidden"});
 assert.equal(await page.locator("video").count(),0);
 blockPhoto=true;blockVideo=true;
 await page.reload();await page.getByRole("heading",{name:"Café Aurora",exact:true}).waitFor();
 const countAtReload=videoCount();await trigger(items[1].name).click();await waitForIndex(2,6);
 assert.equal(videoCount(),countAtReload);
 await dialog.getByRole("button",{name:"Ver em vídeo",exact:true}).click();
 await dialog.getByText(/vídeo não carregou/i).waitFor();
 assert.equal(await page.locator("video").count(),0);
 await dialog.getByRole("button",{name:"Próximo item",exact:true}).click();await waitForIndex(3,6);
 await page.waitForFunction(()=>{const i=document.querySelectorAll(".reels-frame")[2].querySelector("img");return i&&i.naturalWidth>0&&/bolo-(96|192)/.test(i.currentSrc);});
 await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
 blockThumbnail=true;await page.reload();
 await trigger(items[2].name).click();await waitForIndex(3,6);
 await dialog.locator(".reels-frame").nth(2).getByText("Foto indisponível",{exact:true}).waitFor();
 await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
 assert.deepEqual(errors,[]);assert.ok(requests.filter(([m])=>m!=="GET").length===0,"read-only, no mutating requests");
 for(const width of [360,430,1280]){
  const p=page;await p.setViewportSize({width,height:740});
  await p.goto(origin+path);await p.getByRole("button",{name:"Ver no Reels: "+items[4].name,exact:true}).click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"overflow "+width);
  await p.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
 }
 console.log("PASS: first-click immersive playback, reduced-motion override, filtered opener, next twice, Back/Forward, focus/filter/scroll, touch swipe, media lazy-load/cleanup/errors, long text/reduced motion, 360/390/430/1280, read-only");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
