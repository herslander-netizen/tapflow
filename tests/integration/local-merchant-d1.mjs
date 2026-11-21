// Temporary D1 and synthesized RSA credentials only. Never reads deployment config or secrets.
// node tests/integration/local-merchant-d1.mjs <local miniflare entry> [--auth0-contract | --browser <local playwright entry> <local chromium entry>]
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {generateKeyPairSync,sign} from "node:crypto";
import {createRequire} from "node:module";
import {readFile,readdir,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL,fileURLToPath} from "node:url";
import worker from "../../apps/api/preview-worker.mjs";

const [miniflareFile,browser,playwrightFile,chromiumFile]=process.argv.slice(2);
if(!miniflareFile)throw Error("Informe a entrada do Miniflare local");
const {Miniflare}=await import(pathToFileURL(resolve(miniflareFile)));
const root=fileURLToPath(new URL("../../",import.meta.url));
const get=path=>readFile(resolve(root,path),"utf8");
const auth0=browser==="--auth0-contract";
const issuer=auth0?"https://identity.example.invalid/":"https://identity.example.invalid";
const audience="tapflow-merchant-local";
const userinfoAudience=new URL("/userinfo",issuer).href;
const clientId="TapFlowPilotSyntheticClient";
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const key=publicKey.export({format:"jwk"});key.kid="qa";
const pack=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
const token=(sub,overrides={})=>{
  const iat=Math.floor(Date.now()/1000);
  const input=pack({alg:"RS256",typ:"at+jwt",kid:"qa"})+"."+pack({iss:issuer,aud:auth0?[audience,userinfoAudience]:audience,sub,iat,exp:iat+(auth0?900:300),
    ...auth0&&{client_id:clientId,jti:"tapflow-integration-fixture"},...overrides});
  return input+"."+sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
};
const mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response(null,{status:404})}}",
  compatibilityDate:"2026-08-06",d1Databases:{DB:"tapflow-merchant-synthetic"},d1Persist:false,telemetry:{enabled:false}});
let origin;
const env={
  TAPFLOW_MERCHANT_PREVIEW:"true",
  TAPFLOW_STOREFRONT_PREVIEW:"true",
  TAPFLOW_MERCHANT_ISSUER:issuer,
  TAPFLOW_MERCHANT_AUDIENCE:audience,
  ...auth0&&{TAPFLOW_MERCHANT_IDENTITY_PROVIDER:"auth0",TAPFLOW_MERCHANT_CLIENT_ID:clientId,
    TAPFLOW_MERCHANT_AUTH0_USERINFO_AUDIENCE:userinfoAudience},
  TAPFLOW_MERCHANT_PUBLIC_JWKS:JSON.stringify({keys:[key]}),
  TAPFLOW_MERCHANT_PROVISION_ALLOWLIST:JSON.stringify([
    {issuer,subject:"alpha",slug:"loja-alfa"},{issuer,subject:"beta",slug:"loja-beta"},
    {issuer,subject:"ui",slug:"cafeteria-piloto"}
  ]),
  ASSETS:{async fetch(request){
    const m=/^\/((?:vendor\/)?[a-z0-9-]+\.(?:html|css|mjs|svg|js))$/.exec(new URL(request.url).pathname);
    const file=new URL(request.url).pathname==="/"?"index.html":m?.[1];
    if(!file)return new Response(null,{status:404});
    const mime={html:"text/html",mjs:"text/javascript",js:"text/javascript",css:"text/css",svg:"image/svg+xml"}[file.split(".").at(-1)];
    try{return new Response(request.method==="HEAD"?null:await get((file.startsWith("vendor/")?".build/merchant-preview-assets/":"apps/web/")+file),{headers:{"content-type":mime+"; charset=utf-8"}});}
    catch{return new Response(null,{status:404});}
  }}
};
const server=createServer(async (req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const response=await worker.fetch(new Request(origin+req.url,{method:req.method,headers:req.headers,...chunks.length?{body:Buffer.concat(chunks)}:{}}),env);
    res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}
});
const base="/v1/merchant/tenants";
const appear=tenant=>"/api/merchant/"+tenant+"/appearance";
const publicApi=(slug,location)=>"/api/public/menu/"+slug+"/"+location;
const publicPage=(slug,location)=>"/cardapio/"+slug+"/"+location;
try{
  env.DB=await mf.getD1Database("DB");
  const dir="infra/free-stack/d1";
  for(const file of (await readdir(resolve(root,dir))).filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort()){
    const sql=(await get(dir+"/"+file)).split("\n").filter(line=>!/^\s*--|^\s*PRAGMA/.test(line)).join("\n");
    // Migrations 0004 and 0006 may contain a trigger with internal semicolons.
    const triggers=[];
    const ordinary=sql.replace(/CREATE TRIGGER.*?\nEND;/gis,part=>{triggers.push(part);return "";});
    for(const statement of ordinary.split(";").map(s=>s.trim()).filter(Boolean).concat(triggers))
      await env.DB.prepare(statement).run();
  }
  await new Promise((r,j)=>{server.once("error",j);server.listen(0,"127.0.0.1",r);});
  origin=env.TAPFLOW_MERCHANT_ORIGIN="http://127.0.0.1:"+server.address().port;
  const request=(path,status=200,{sub,jwt,body,method=body?"POST":"GET",from=origin}={})=>check(path,status,{sub,jwt,body,method,from});
  async function check(path,status,{sub,jwt,body,method,from}){
    const headers={origin:from,...(sub||jwt)&&{authorization:"Bearer "+(jwt??token(sub))},...body&&{"content-type":"application/json"}};
    const res=await fetch(origin+path,{method,headers,...body&&{body:JSON.stringify(body)}});
    if(res.status!==status)throw Error(path+" esperava "+status+"; recebeu "+res.status+" "+await res.text());
    assert.equal(res.headers.get("cache-control"),"no-store");
    return /application\/json/.test(res.headers.get("content-type")??"")?await res.json():res;
  }
  if(auth0){
    assert.deepEqual(await request("/api/merchant/login-config"),{issuer,clientId,audience});
    await request(base,401);
    const invalid=[{client_id:"OtherSyntheticClient"},{client_id:undefined},{aud:[audience,audience]},
      {aud:[userinfoAudience]},{aud:[audience,userinfoAudience,"other"]}];
    for(const overrides of invalid)await request(base,401,{jwt:token("alpha",overrides)});
    assert.deepEqual(await request(base,200,{jwt:token("alpha",{aud:[userinfoAudience,audience]})}),{tenants:[]});
  }
  const a=await request(base,201,{sub:"alpha",body:{slug:"loja-alfa",name:"Restaurante Alfa",locationName:"Centro"}});
  const b=await request(base,201,{sub:"beta",body:{slug:"loja-beta",name:"Restaurante Beta",locationName:"Norte"}});
  await request(base,409,{sub:"alpha",body:{slug:"loja-alfa",name:"Alteração",locationName:"Outra"}});
  const t=base+"/"+a.tenant.id,l=a.location.id;
  await request(t+"/catalog",404,{sub:"beta"});
  await request(t+"/catalog",401);
  await request("/v1/merchant/kitchen/units",404,{sub:"alpha"});
  env.TAPFLOW_KITCHEN_PREVIEW="true";
  await request("/v1/merchant/kitchen/units",401);
  const kitchen=await request("/v1/merchant/kitchen/units",200,{sub:"alpha"});
  assert.equal(kitchen.units.some(x=>x.locationId===l),true);
  await request("/v1/merchant/kitchen/"+a.tenant.id+"/"+l+"/orders",404,{sub:"beta"});
  await request(t+"/tables",404,{sub:"beta",body:{locationId:l,name:"Mesa A"}});
  const table=await request(t+"/tables",201,{sub:"alpha",body:{locationId:l,name:"Mesa A"}});
  assert.deepEqual(await request(t+"/tables",200,{sub:"alpha",body:{locationId:l,name:"Mesa A"}}),table);

  const cat=await request(t+"/categories",201,{sub:"alpha",body:{locationId:l,name:"Pratos",sortOrder:2}});
  const body={locationId:l,categoryId:cat.id,priceCents:2990,availability:"available",name:"Bobó de camarão"};
  const item=await request(t+"/items",201,{sub:"alpha",body});
  await request(t+"/items",201,{sub:"alpha",body:{...body,name:"Oculto",availability:"hidden"}});
  await request(t+"/items",201,{sub:"alpha",body:{...body,name:"Esgotado",availability:"sold_out"}});
  await request(t+"/addons",201,{sub:"alpha",body:{locationId:l,itemId:item.id,name:"Molho",priceCents:450,isAvailable:true}});
  await request(t+"/addons",201,{sub:"alpha",body:{locationId:l,itemId:item.id,name:"Inativo",priceCents:450,isAvailable:false}});
  const p=publicApi(a.tenant.slug,l);
  await request(p,404);
  const draft={preset:"cafe",mode:"light",accent:"#75431F",background:null};
  const ap=appear(a.tenant.id);
  await request(ap,404,{sub:"beta"});
  await request(ap,403,{sub:"alpha",body:{revision:0,settings:draft},from:"https://other.example.invalid"});
  await request(ap,200,{sub:"alpha",body:{revision:0,settings:draft}});
  await request(p,404);
  await request(ap+"/publish",200,{sub:"alpha",body:{revision:1}});
  const menu=await request(p);
  assert.deepEqual(menu.appearance,draft);
  assert.deepEqual(menu.items.map(i=>[i.name,i.available,i.categoryName]),[["Bobó de camarão",true,"Pratos"],["Esgotado",false,"Pratos"]]);
  assert.deepEqual(menu.items[0].addons.map(i=>i.name),["Molho"]);
  assert.equal(menu.orderingEnabled,false);
  const tableQuery="?mesa="+table.id;
  assert.deepEqual((await request(p+tableQuery)).table,{label:"Mesa A"});
  await request(p+"?mesa="+table.id+"&mesa="+table.id,404);
  await request(p+"?mesa=inexistente",404);
  await request(publicApi(b.tenant.slug,b.location.id)+tableQuery,404);
  await request("/v1/order-sessions",404,{body:{code:table.id}});
  await request(t+"/tables/"+table.id,400,{sub:"alpha",method:"PATCH",body:{locationId:l,isActive:true}});
  await request(t+"/tables/"+table.id,404,{sub:"beta",method:"PATCH",body:{locationId:l,isActive:false}});
  await request(t+"/tables/"+table.id,200,{sub:"alpha",method:"PATCH",body:{locationId:l,isActive:false}});
  await request(p+tableQuery,404);
  await request(t+"/tables",409,{sub:"alpha",body:{locationId:l,name:"Mesa A"}});

  assert.equal(Object.hasOwn(menu,"draft"),false);
  await request(publicApi(b.tenant.slug,l),404);
  await request(publicApi(a.tenant.slug,b.location.id),404);
  await request(p,405,{method:"POST"});
  await request(ap,200,{sub:"alpha",body:{revision:2,settings:{...draft,accent:"#112233"}}});
  assert.deepEqual((await request(p)).appearance,draft);
  await request("/v1/orders",503,{method:"POST"});
  if(auth0){
    const previouslyValid=token("alpha");
    assert.equal((await request(base,200,{jwt:previouslyValid})).tenants.length,1);
    // Revocation fixture: deliberately leave location membership and JWT unchanged.
    const change=await env.DB.prepare("UPDATE merchant_owners SET status='suspended' WHERE tenant_id=? AND issuer=? AND subject=?")
      .bind(a.tenant.id,issuer,"alpha").run();
    assert.equal(change.meta.changes,1);
    assert.deepEqual(await request(base,200,{jwt:previouslyValid}),{tenants:[]});
    await request(t+"/catalog",404,{jwt:previouslyValid});
    await request(ap,404,{jwt:previouslyValid});
    await request(ap+"/publish",404,{jwt:previouslyValid,body:{revision:3}});
    assert.deepEqual((await request(p)).appearance,draft);
    const health=await request("/api/health");
    for(const capability of ["ordersEnabled","paymentsEnabled","evolutionSendEnabled","agentActionsEnabled"])
      assert.equal(health[capability],false);
    console.log("Auth0 sintético: emissor/client/audiência exatos, revogação imediata do lojista e cardápio publicado preservado");
  }
  console.log("D1 local + Worker: cadastro, catálogo, isolamento, rascunho, publicação e pedidos fechados OK");
  if(browser==="--browser"){
    const require=createRequire(import.meta.url);
    const {chromium}=require(resolve(playwrightFile)),runtime=require(resolve(chromiumFile));
    const launch=async()=>chromium.launch({executablePath:await runtime.executablePath(),args:runtime.args.filter(arg=>arg!=="--disable-web-security"&&arg!=="--allow-running-insecure-content"),headless:true});
    const seen=[];
    await mkdir(resolve(root,".build/qa"),{recursive:true});
    for(const width of [360,390,430,1280]){
      const browser=await launch();
      try{
        const page=await browser.newPage({viewport:{width,height:850},reducedMotion:"reduce"});
        page.on("pageerror",error=>seen.push(String(error)));
        await page.goto(origin+publicPage(a.tenant.slug,l),{waitUntil:"networkidle"});
        await page.getByRole("heading",{name:"Restaurante Alfa"}).waitFor();
        assert.equal(await page.locator("html").getAttribute("data-tapflow-appearance"),"light");
        assert.equal(await page.locator("html").evaluate(e=>e.scrollWidth<=e.clientWidth),true);
        assert.equal(await page.getByRole("heading",{name:"Bobó de camarão"}).count(),1);
        await page.getByRole("searchbox").fill("camarao");
        assert.equal(await page.getByText("Esgotado",{exact:true}).count(),0);
        await page.getByText("Ver adicionais").click();
        assert.equal(await page.getByText(/^Molho · /).isVisible(),true);
        await page.getByRole("searchbox").clear();
        await page.screenshot({path:resolve(root,".build/qa","cardapio-"+width+".png"),fullPage:true});
      }finally{await browser.close();}
    }
    {
      const browser=await launch();
      try{
        const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:"reduce",acceptDownloads:true});
        page.on("pageerror",error=>seen.push(String(error)));
        await page.goto(origin+"/merchant.html");
        await page.locator("#access-token").fill(token("ui"));
        await page.getByRole("button",{name:"Usar token nesta página"}).click();
        await page.locator("#tenant-name").fill("Cafeteria Piloto");
        await page.locator("#tenant-slug").fill("cafeteria-piloto");
        await page.locator("#tenant-first-location").fill("Centro");
        await page.getByRole("button",{name:"Criar estabelecimento e unidade"}).click();
        try{await page.getByText("Estabelecimento e primeira unidade criados.").waitFor({timeout:5000});}
        catch(e){throw new Error("Cadastro UI: "+await page.locator("#merchant-status").textContent()+" / "+await page.locator("#merchant-error").textContent()+" / "+e.message);}
        await page.locator("#table-name").fill("Mesa 07");
        await page.getByRole("button",{name:"Cadastrar mesa",exact:true}).click();
        await page.getByText("Cadastro da mesa salvo.").waitFor();
        await page.locator("#category-name").fill("Cafés");
        await page.getByRole("button",{name:"Criar categoria"}).click();
        await page.getByText("Cadastro da categoria salvo.").waitFor();
        await page.locator("#item-name").fill("Cappuccino");
        await page.locator("#item-category").selectOption({label:"Cafés"});
        await page.locator("#item-price").fill("13,50");
        await page.locator("#item-availability").selectOption("available");
        await page.getByRole("button",{name:"Criar prato"}).click();
        await page.getByText("Cadastro do prato salvo.").waitFor();
        await page.locator("#theme-preset").selectOption("cafe");
        await page.locator("#theme-background").fill("#efe7da");
        await page.getByRole("button",{name:"Salvar rascunho"}).click();
        await page.getByText("Rascunho salvo. Ainda não foi publicado.").waitFor();
        await page.getByRole("button",{name:"Publicar rascunho salvo"}).click();
        const link=page.getByRole("link",{name:"Abrir link da mesa",exact:true});
        await link.waitFor();
        const dl=page.waitForEvent("download");
        await page.getByRole("button",{name:"Baixar QR Code",exact:true}).click();
        const file=await dl;
        assert.equal(file.suggestedFilename(),"tapflow-qr-mesa.svg");
        const svg=await readFile(await file.path(),"utf8");
        assert.match(svg,/<svg.*viewBox=.*shape-rendering="crispEdges"/);
        assert.doesNotMatch(svg,/<script|<foreignObject|<image/i);
        assert.equal(await page.locator("html").evaluate(e=>e.scrollWidth<=e.clientWidth),true);
        await page.locator("#aparencia").screenshot({path:resolve(root,".build/qa","painel-aparencia-390.png")});
        const guest=await browser.newPage({viewport:{width:390,height:850}});
        await guest.goto(new URL(await link.getAttribute("href"),origin).href);
        await guest.getByRole("heading",{name:"Cafeteria Piloto"}).waitFor();
        await guest.getByRole("heading",{name:"Cappuccino"}).waitFor();
        await guest.getByText("Mesa 07",{exact:true}).waitFor();
        assert.equal(await guest.locator("html").getAttribute("data-tapflow-appearance"),"light");
        assert.equal(await guest.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--bg")),"#EFE7DA");
        await guest.screenshot({path:resolve(root,".build/qa","cardapio-publicado-390.png")});
        assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
      }finally{await browser.close();}
    }
    assert.deepEqual(seen,[]);
    console.log("Chromium: cardápio independente em 360, 390, 430 e 1280 px; cadastro pelo painel, publicação vista por outro visitante, busca e adicionais OK");
  }
}finally{
  if(server.listening)await new Promise(r=>server.close(r));
  await mf.dispose();
}
