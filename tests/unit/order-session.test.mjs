import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createOrderSessionAuthorizer} from "../../apps/api/order-session.mjs";
import {createOrderApi} from "../../apps/api/order-service.mjs";

const token = "A".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");
const now = 1000;
const record = {tenant_id:"tenant_real",location_id:"place_real",table_id:"table_real",session_hash:hash};
const request = (authorization, path="/v1/orders?tenantId=forjado&token="+token) => new Request(
  "https://tapflow.test"+path, {method:"POST",headers:{
    ...(authorization ? {authorization} : {}),
    "x-tenant-id":"forjado","x-table-id":"forjada","content-type":"application/json"
  },body:JSON.stringify({tenantId:"forjado",tableId:"forjada"})}
);
function dbWith(row, check = () => {}) {
  return {prepare(sql){return {bind(...params){
    check(sql,params);
    return {first:async()=>row};
  }}}};
}

test("token ausente, inválido ou só na URL não consulta o banco",async()=>{
  const authorize = createOrderSessionAuthorizer({db:{prepare:()=>assert.fail("consultou banco")}});
  for (const value of [null, "Bearer abc", "Basic "+token, "Bearer "+token+", Bearer "+token]) {
    assert.equal(await authorize(request(value)),null);
  }
});

test("só usa o hash no banco e escopo fornecido pelo servidor",async()=>{
  const db = dbWith(record,(sql,params)=>{
    assert.deepEqual(params,[hash,now]);
    assert.equal(sql.includes(token),false);
    assert.match(sql,/s\.expires_at_ms>\?.*s\.revoked_at_ms IS NULL/);
    assert.match(sql,/d\.tenant_id=s\.tenant_id AND d\.location_id=s\.location_id/);
    assert.match(sql,/d\.is_active=1 AND l\.status='active' AND t\.status='active'/);
  });
  const authorize = createOrderSessionAuthorizer({db,now:()=>now});
  assert.deepEqual(await authorize(request("Bearer "+token)),{
    tenantId:"tenant_real",locationId:"place_real",tableId:"table_real",sessionHash:hash
  });
});

test("sessão desconhecida, inválida ou de hash diferente não fornece escopo",async()=>{
  for (const row of [null,{...record,table_id:""},{...record,session_hash:"b".repeat(64)}]) {
    const authorize = createOrderSessionAuthorizer({db:dbWith(row),now:()=>now});
    assert.equal(await authorize(request("Bearer "+token)),null);
  }
});

test("API permanece fechada quando um autorizador está disponível",async()=>{
  const authorizeSession = () => assert.fail("consultou sessão no modo fechado");
  const db = {prepare:()=>assert.fail("consultou banco no modo fechado")};
  assert.equal((await createOrderApi({db,authorizeSession})(request("Bearer "+token))).status,503);
});

test("SQL real: expiração estrita, revogação, mesa inativa e unidade divergente", async () => {
  const {DatabaseSync} = await import("node:sqlite");
  const {readFileSync} = await import("node:fs");
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const file of ["0001_schema.sql", "0003_order_sessions.sql"]) {
      sqlite.exec(readFileSync(new URL("../../infra/free-stack/d1/"+file,import.meta.url),"utf8"));
    }
    sqlite.exec(`
      INSERT INTO tenants (id, slug, name, status) VALUES ('tenant_real','pilot','Piloto','active');
      INSERT INTO locations (id, tenant_id, name, status) VALUES
        ('place_real','tenant_real','Principal','active'),('place_other','tenant_real','Outra','active');
      INSERT INTO dining_tables (id,tenant_id,location_id,label,is_active)
        VALUES ('table_real','tenant_real','place_real','Mesa 1',1);
    `);
    sqlite.prepare("INSERT INTO order_sessions VALUES(?,?,?,?,?,NULL)").run(
      hash,"tenant_real","place_real","table_real",now+1
    );
    let timestamp = now;
    const db = {prepare(sql){return {bind(...params){
      return {first:async()=>sqlite.prepare(sql).get(...params)};
    }}}};
    const verify = createOrderSessionAuthorizer({db,now:()=>timestamp});
    const authorized = () => verify(request("Bearer "+token));
    assert.equal((await authorized()).tableId,"table_real");
    timestamp = now+1;
    assert.equal(await authorized(),null);
    timestamp = now;
    sqlite.exec(`UPDATE order_sessions SET revoked_at_ms=${now}`);
    assert.equal(await authorized(),null);
    sqlite.exec("UPDATE order_sessions SET revoked_at_ms=NULL");
    sqlite.exec("UPDATE dining_tables SET is_active=0");
    assert.equal(await authorized(),null);
    sqlite.exec("UPDATE dining_tables SET is_active=1");
    sqlite.exec("UPDATE order_sessions SET location_id='place_other'");
    assert.equal(await authorized(),null);
  } finally {
    sqlite.close();
  }
});
