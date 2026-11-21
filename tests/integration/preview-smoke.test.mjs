import test from "node:test";
import assert from "node:assert/strict";
const ORIGIN="https://tapflow-preview.tapflowse.workers.dev";
async function get(path){
  const response=await fetch(ORIGIN+path,{redirect:"error",signal:AbortSignal.timeout(16000)});
  return {response,text:await response.text()};
}
test("prévia responde com HTML da experiência Reels",async()=>{
  const {response,text}=await get("/");
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type")||"",/text\/html/);
  assert.match(text,/TapFlow/);
  assert.match(text,/app\.js/);
  assert.match(text,/DEMONSTRAÇÃO/);
});
test("módulos JS e CSS são servidos com MIME correto",async()=>{
  for(const path of ["/app.js","/domain.mjs","/demo-data.js","/media.mjs","/styles.css","/experience.css"]){
    const {response,text}=await get(path);
    assert.equal(response.status,200,path);
    assert.ok(text.length>100,path);
    assert.match(response.headers.get("content-type")||"",/text\/(javascript|css)/,path);
  }
});
test("health verifica D1 mas não oferece pagamentos nem pedidos reais",async()=>{
  const {response,text}=await get("/api/health");
  assert.equal(response.status,200);
  const health=JSON.parse(text);
  assert.equal(health.databaseConnected,true);
  assert.equal(health.ordersPersistent,false);
  assert.equal(health.paymentsEnabled,false);
  assert.equal(health.aiEnabled,false);
});
test("API real não aceita POST de pedidos",async()=>{
 const r=await fetch(ORIGIN+"/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 assert.equal(r.status,405);
});


test("rota Gemini exige autenticação; nenhum segredo necessário para este teste",async()=>{
 const unsupported=await fetch(ORIGIN+"/api/admin/ai/description",{method:"GET",signal:AbortSignal.timeout(16000)});
 assert.equal(unsupported.status,405);
 const rejected=await fetch(ORIGIN+"/api/admin/ai/description",{
   method:"POST",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({name:"Burger",ingredients:"pão, queijo"}),
   signal:AbortSignal.timeout(16000)
 });
 assert.equal(rejected.status,401);
});
