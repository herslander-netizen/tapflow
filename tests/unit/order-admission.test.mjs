import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createOrderAdmissionRedeemer} from "../../apps/api/order-admission.mjs";
import {createOrderSessionAuthorizer} from "../../apps/api/order-session.mjs";

const code="a".repeat(43), now=10000;
const hash=value=>createHash("sha256").update(value).digest("hex");
function fixture(t){
  const sqlite=new DatabaseSync(":memory:");
  t.after(()=>sqlite.close());
  for(const file of ["0001_schema.sql","0003_order_sessions.sql","0004_order_admissions.sql"])
    sqlite.exec(readFileSync(new URL("../../infra/free-stack/d1/"+file,import.meta.url),"utf8"));
  sqlite.exec(`
    INSERT INTO tenants (id,slug,name,status) VALUES ('t','demo','Demo','active');
    INSERT INTO locations (id,tenant_id,name,status) VALUES ('l','t','Loja','active');
    INSERT INTO dining_tables (id,tenant_id,location_id,label,is_active) VALUES ('m','t','l','Mesa',1);
  `);
  const db={prepare(sql){return {bind(...params){
    assert.equal(params.includes(code),false);
    return {first:async()=>sqlite.prepare(sql).get(...params)};
  }}}};
  const create=(expires=now+1000, revoked=null, issued=now-1000)=>
    sqlite.prepare("INSERT INTO order_admissions (admission_hash,tenant_id,location_id,table_id,issued_at_ms,expires_at_ms,revoked_at_ms) VALUES (?,'t','l','m',?,?,?)")
      .run(hash(code),issued,expires,revoked);
  const redeem=createOrderAdmissionRedeemer({db,now:()=>now});
  return {sqlite,db,create,redeem};
}

test("resgates concorrentes da aplicação produzem uma única sessão utilizável, persistindo só hashes",async t=>{
  const {sqlite,db,create,redeem}=fixture(t);create();
  const result=(await Promise.all(Array.from({length:20},()=>redeem(code)))).filter(Boolean);
  assert.equal(result.length,1);
  const grant=result[0];
  assert.match(grant.token,/^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(grant.token,code);
  assert.equal(grant.expiresAtMs,now+1800000);
  const admissions=sqlite.prepare("SELECT * FROM order_admissions").all();
  const sessions=sqlite.prepare("SELECT * FROM order_sessions").all();
  assert.equal(sessions.length,1);
  assert.equal(admissions[0].admission_hash,hash(code));
  assert.equal(admissions[0].session_hash,hash(grant.token));
  assert.equal(sessions[0].session_hash,hash(grant.token));
  assert.equal(sessions[0].expires_at_ms,grant.expiresAtMs);
  const serialized=JSON.stringify({admissions,sessions});
  assert.equal(serialized.includes(code)||serialized.includes(grant.token),false);
  const authorize=createOrderSessionAuthorizer({db,now:()=>now});
  const request=new Request("https://tapflow.test",{headers:{authorization:"Bearer "+grant.token}});
  assert.deepEqual(await authorize(request),{tenantId:"t",locationId:"l",tableId:"m",sessionHash:hash(grant.token)});
  sqlite.exec("UPDATE order_sessions SET revoked_at_ms=10001");
  assert.equal(await authorize(request),null);
  assert.equal(await redeem(code),null);
});

test("admissão vencida no limite, revogada, futura ou com mesa inativa não cria sessão",async t=>{
  const {sqlite,create,redeem}=fixture(t);
  for(const args of [[now],[now+1000,now-1],[now+1000,null,now+1]]){
    create(...args);
    assert.equal(await redeem(code),null);
    sqlite.exec("DELETE FROM order_admissions");
  }
  create();
  sqlite.exec("UPDATE dining_tables SET is_active=0");
  assert.equal(await redeem(code),null);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM order_sessions").get().n,0);
  assert.equal(sqlite.prepare("SELECT redeemed_at_ms FROM order_admissions").get().redeemed_at_ms,null);
});

test("falha inserindo sessão reverte o consumo, permitindo uma repetição",async t=>{
  const {sqlite,create,redeem}=fixture(t);create();
  sqlite.exec("CREATE TRIGGER fail_test BEFORE INSERT ON order_sessions BEGIN SELECT RAISE(ABORT,'forced failure'); END");
  await assert.rejects(redeem(code),/forced failure/);
  const row=sqlite.prepare("SELECT redeemed_at_ms,session_hash FROM order_admissions").get();
  assert.equal(row.redeemed_at_ms,null);assert.equal(row.session_hash,null);
  sqlite.exec("DROP TRIGGER fail_test");
  assert.ok(await redeem(code));
});

test("código inválido nunca consulta o banco",async()=>{
  const redeem=createOrderAdmissionRedeemer({db:{prepare:()=>assert.fail("consultou banco")}});
  for(const input of [null,{},42,"abc","Bearer "+code," "+code])assert.equal(await redeem(input),null);
});
