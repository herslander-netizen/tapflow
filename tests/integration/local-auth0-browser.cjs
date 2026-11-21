const {createServer}=require("node:http"),fs=require("node:fs/promises"),abs=require("node:path"),assert=require("node:assert/strict");
// Run after npm run build:merchant-preview. Supply local Playwright and Chromium modules.
const [playwrightModule,chromiumModule]=process.argv.slice(2);
if(!playwrightModule||!chromiumModule)throw Error("Informe Playwright e Chromium locais");
const browserEngine=require(abs.resolve(playwrightModule)).chromium;
const runtime=require(abs.resolve(chromiumModule));
const root=abs.resolve(".build/merchant-preview-assets");
const issuer="https://pilot-auth0.invalid",audience="https://tapflow-pilot-api.invalid",clientId="test_client_id_123";
(async()=>{
 let origin;
 const server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,origin).pathname;
   if(path==="/api/merchant/login-config"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({issuer,clientId,audience}));}
   if(!/^\/(?:vendor\/)?[a-z0-9.-]+$/.test(path))throw Error("404");
   const mime=path.endsWith(".html")?"text/html":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/javascript";
   const bytes=await fs.readFile(root+path);
   res.writeHead(200,{"content-type":mime,"Content-Security-Policy":"default-src 'self'; frame-src 'none'; style-src 'self' 'unsafe-inline'; connect-src 'self' "+issuer});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 origin="http://127.0.0.1:"+server.address().port;
 let browser;
 try{
  browser=await browserEngine.launch({executablePath:await runtime.executablePath(),
   args:runtime.args.filter(a=>!["--disable-web-security","--allow-running-insecure-content"].includes(a)),headless:true});
  const tab=await browser.newPage({viewport:{width:390,height:850}});
  const errors=[];tab.on("pageerror",e=>errors.push(String(e)));
  let redirect;
  await tab.route(issuer+"/**",route=>{
   redirect=new URL(route.request().url());
   return route.fulfill({status:200,contentType:"text/html",body:"<h1>Login hosted fixture</h1>"});
  });
  await tab.goto(origin+"/merchant.html", {waitUntil:"networkidle"});
  assert.equal(await tab.locator("#access-token").isVisible(),false);
  await tab.getByRole("button",{name:"Entrar no painel"}).click();
  await tab.waitForURL(u=>u.origin===issuer);
  await tab.getByRole("heading",{name:"Login hosted fixture"}).waitFor();
  assert.equal(redirect.pathname,"/authorize");
  const q=redirect.searchParams;
  assert.equal(q.get("response_type"),"code");
  assert.equal(q.get("code_challenge_method"),"S256");
  assert.match(q.get("code_challenge"),/^[A-Za-z0-9_-]{43}$/);
  assert.equal(q.has("code_verifier"),false);
  assert.equal(/^[A-Za-z0-9+/=_-]{32,}$/.test(q.get("state")??""),true,"SDK stored an opaque OAuth state");
  assert.equal(q.get("client_id"),clientId);
  assert.equal(q.get("audience"),audience);
  assert.equal(q.get("redirect_uri"),origin+"/merchant.html");
  assert.deepEqual(errors,[]);
  console.log("SDK oficial gerado: redirecionamento Auth0, PKCE S256 e configurações corretas, sem rede real.");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
