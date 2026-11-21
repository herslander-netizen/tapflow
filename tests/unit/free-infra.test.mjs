import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const base=new URL("../../infra/free-stack/",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("manifest.json",base),"utf8"));
const sql=await readFile(new URL("d1/0001_schema.sql",base),"utf8");
const worker=await import("../../infra/free-stack/worker.mjs");

test("nenhum provisionamento, deploy ou cobrança habilitado",()=>{
  assert.equal(manifest.provisioning.enabled,false);
  assert.equal(manifest.provisioning.automaticDeploy,false);
  assert.equal(manifest.provisioning.deployToProduction,false);
  assert.equal(manifest.provisioning.allowBillingUpgrade,false);
  assert.equal(manifest.provisioning.allowPaidAddons,false);
});
test("ambientes isolados e conta exclusiva",()=>{
  assert.equal(manifest.accountPolicy.dedicatedAccountOnly,true);
  assert.equal(manifest.accountPolicy.verifyConnectedIdentityBeforeProvisioning,true);
  assert.equal(manifest.environments.production.enabled,false);
  assert.equal(manifest.environments.preview.configured,false);
});
test("não salvar e-mail pessoal em inventário público",()=>{
  assert.equal(manifest.accountPolicy.accountEmailStoredInRepository,false);
  assert.doesNotMatch(JSON.stringify(manifest),/@gmail\.com/);
});
test("modelo de banco carrega tenant em tabelas sensíveis",()=>{
  for(const name of ["tenants","locations","dining_tables","menu_items","orders","order_lines","order_idempotency","order_events"]){
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS "+name),name);
  }
  assert.match(sql,/PRIMARY KEY\(tenant_id,actor_session_hash,idempotency_key\)/);
});
test("health demonstra que não há pedidos persistidos ou pagamento",async()=>{
  const r=await worker.default.fetch(new Request("https://tapflow.example/api/health"));
  const v=await r.json();
  assert.equal(r.status,200);assert.equal(v.payments,false);assert.equal(v.persistentOrders,false);
});
test("sem API de pedidos disponível no Worker preparatório",async()=>{
  const r=await worker.default.fetch(new Request("https://tapflow.example/api/orders",{method:"POST"}));
  assert.equal(r.status,405);
});
