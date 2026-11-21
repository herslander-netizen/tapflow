import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createOrderTracking,ORDER_TRACKING_TTL_MS} from "../../apps/api/order-tracking.mjs";
import {createOrderApi} from "../../apps/api/order-service.mjs";

const orderA="ord_"+"a".repeat(40),orderB="ord_"+"b".repeat(40);
const actorA="A".repeat(43),actorB="B".repeat(43),orderWindow=1800000;
const hash=value=>createHash("sha256").update(value).digest("hex");
function req(token,method="GET",query=""){
  return new Request("https://tapflow.test/v1/orders/"+orderA+query,{
    method,headers:token?{authorization:"Bearer "+token}:{}
  });
}
function fixture(t){
  const sqlite=new DatabaseSync(":memory:");
  t.after(()=>sqlite.close());
  for(const file of ["0001_schema.sql","0003_order_sessions.sql","0006_order_tracking_tokens.sql"]){
    sqlite.exec(readFileSync(new URL("../../infra/free-stack/d1/"+file,import.meta.url),"utf8"));
  }
  sqlite.exec(`
    INSERT INTO tenants (id,slug,name,status) VALUES ('t','demo','Demo','active');
    INSERT INTO locations (id,tenant_id,name,status) VALUES ('l','t','Loja','active');
    INSERT INTO dining_tables (id,tenant_id,location_id,label,is_active) VALUES ('m','t','l','Mesa',1);
  `);
  const addOrder=sqlite.prepare("INSERT INTO orders (id,tenant_id,location_id,table_id,actor_session_hash,total_cents) VALUES (?,'t','l','m',?,777)");
  const addSession=sqlite.prepare("INSERT INTO order_sessions (session_hash,tenant_id,location_id,table_id,expires_at_ms) VALUES (?,'t','l','m',?)");
  for(const [order,actor] of [[orderA,actorA],[orderB,actorB]]){
    addSession.run(hash(actor),orderWindow);addOrder.run(order,hash(actor));
  }
  const db={prepare(sql){return {bind(...params){
    assert.ok(params.every(p=>typeof p!=="string" || !p.startsWith("tftrk_")));
    return {first:async()=>sqlite.prepare(sql).get(...params)};
  }}}};
  let time=1000;
  const tracking=createOrderTracking({db,now:()=>time,enabled:true});
  return {sqlite,db,tracking,setTime:v=>time=v};
}

test("minuto 31 e nova requisição mantêm só o status do pedido; reenvio não estende a validade",async t=>{
  const {sqlite,tracking,setTime}=fixture(t);
  const grant=await tracking.issue(req(actorA),orderA);
  assert.ok(grant);assert.equal(grant.expiresAtMs,1000+ORDER_TRACKING_TTL_MS);
  setTime(2000);
  const duplicate=await Promise.all(Array.from({length:8},()=>tracking.issue(req(actorA),orderA)));
  assert.ok(duplicate.every(retry=>retry?.token===grant.token&&retry.expiresAtMs===grant.expiresAtMs));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM order_tracking_tokens").get().n,1);
  setTime(31*60000);
  assert.equal(await tracking.issue(req(actorA),orderA),null);
  sqlite.exec("UPDATE orders SET status='preparing'");
  assert.equal(await tracking.issue(req(actorB),orderB),null);
  const r1=await tracking.read(req(grant.token),orderA);
  const r2=await tracking.read(req(grant.token),orderA);
  assert.deepEqual(r1,r2);assert.equal(r2.status,"preparing");
  assert.deepEqual(Object.keys(r2).sort(),["id","status","updatedAt"]);
  const persisted=sqlite.prepare("SELECT * FROM order_tracking_tokens").get();
  assert.equal(persisted.token_hash,hash(grant.token));
  assert.ok(!JSON.stringify(persisted).includes(grant.token));
});

test("mesma mesa não compartilha credenciais, e token nunca serve como pedido ou URL",async t=>{
  const {tracking,db}=fixture(t);
  assert.equal(await tracking.issue(req(actorB),orderA),null);
  const a=await tracking.issue(req(actorA),orderA), b=await tracking.issue(req(actorB),orderB);
  assert.equal(await tracking.read(req(a.token),orderB),null);
  assert.equal(await tracking.read(req(b.token),orderA),null);
  assert.equal(await tracking.read(req(null,"GET","?token="+a.token),orderA),null);
  assert.equal(await tracking.read(req(a.token,"POST"),orderA),null);
  assert.equal(await tracking.issue(req(a.token),orderA),null);
  const {createOrderSessionAuthorizer}=await import("../../apps/api/order-session.mjs");
  const api=createOrderApi({db,enabled:true,authorizeSession:createOrderSessionAuthorizer({db,now:()=>1000})});
  const post=new Request("https://tapflow.test/v1/orders",{method:"POST",headers:{authorization:"Bearer "+a.token}});
  assert.equal((await api(post)).status,401);
});

test("revogação imediata e expiração no limite; limpeza local não apaga o pedido",async t=>{
  const {sqlite,tracking,setTime}=fixture(t);
  const a=await tracking.issue(req(actorA),orderA),b=await tracking.issue(req(actorB),orderB);
  sqlite.prepare("UPDATE order_tracking_tokens SET revoked_at_ms=1001 WHERE token_hash=?").run(hash(a.token));
  setTime(1001);
  assert.equal(await tracking.read(req(a.token),orderA),null);
  assert.equal(await tracking.issue(req(actorA),orderA),null);
  setTime(b.expiresAtMs-1);assert.ok(await tracking.read(req(b.token),orderB));
  setTime(b.expiresAtMs);assert.equal(await tracking.read(req(b.token),orderB),null);
  sqlite.prepare("DELETE FROM order_tracking_tokens WHERE expires_at_ms<=?").run(b.expiresAtMs);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM order_tracking_tokens").get().n,0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM orders").get().n,2);
});

test("por padrão, o módulo não consulta o banco nem emite token",async()=>{
  const closed=createOrderTracking({db:{prepare:()=>assert.fail("consultou D1 fechado")}});
  assert.equal(await closed.issue(req(actorA),orderA),null);
  assert.equal(await closed.read(req("tftrk_"+actorA),orderA),null);
});
