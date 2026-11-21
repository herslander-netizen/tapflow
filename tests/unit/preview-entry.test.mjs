import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../apps/api/preview-worker.mjs";
const req=(path,method="GET")=>new Request("https://tapflow-preview.test"+path,{method});
const env={
 DB:{prepare(){return{first:async()=>({total:0})}}},
 ASSETS:{fetch:async()=>new Response("<html><body>TapFlow</body></html>",{headers:{"content-type":"text/html"}})}
};
test("health exibe situação real da prévia e recusa pagamentos",async()=>{
 const r=await worker.fetch(req("/api/health"),env),d=await r.json();
 assert.equal(r.status,200);
 assert.equal(d.ordersEnabled,false);assert.equal(d.paymentsEnabled,false);
 assert.equal(d.evolutionSendEnabled,false);assert.equal(d.agentActionsEnabled,false);
});
test("esquema não acessível deixa saúde indisponível",async()=>{
 const r=await worker.fetch(req("/api/health"),{...env,DB:{prepare(){throw Error("Sem D1")}}});
 assert.equal(r.status,503);
});
test("pedido POST real continua bloqueado, mesmo com variável de ambiente ligada",async()=>{
 const r=await worker.fetch(req("/v1/orders","POST"),{...env,ORDER_API_ENABLED:"true"});
 assert.equal(r.status,503);
 const j=await r.json();assert.match(j.error,/não estão ativados/);
});
test("acesso a assets é isolado de rotas privadas",async()=>{
 const r=await worker.fetch(req("/"),env);
 assert.equal(r.status,200);assert.match(await r.text(),/TapFlow/);
});
test("Gemini admin bloqueado sem autenticação",async()=>{
 const r=await worker.fetch(req("/api/admin/ai/description","POST"),env);
 assert.equal(r.status,401);
});
