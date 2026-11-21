// QA isolado: não usa IDs de deploy, autenticação Cloudflare nem recursos remotos.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const [repo, miniflareFile] = process.argv.slice(2);
if (!repo || !miniflareFile) throw Error("Informe checkout e entrada Miniflare local");
const { Miniflare } = await import(pathToFileURL(miniflareFile));
const get = path => readFile(repo + "/" + path, "utf8");
const modules = [
  { type: "ESModule", path: "local-order-worker.mjs", contents: `
    import { createOrderApi } from "./apps/api/order-service.mjs";
    import { createOrderSessionAuthorizer } from "./apps/api/order-session.mjs";
    import { createOrderAdmissionRedeemer } from "./apps/api/order-admission.mjs";
    export default { async fetch(request, env) {
      if (new URL(request.url).pathname === "/_fixture/redeem") {
        const result = await createOrderAdmissionRedeemer({db: env.DB})(request.headers.get("x-fixture-code"));
        return Response.json(result, {status: result ? 200 : 401});
      }
      return createOrderApi({db: env.DB, enabled: true,
        authorizeSession: createOrderSessionAuthorizer({db: env.DB})})(request);
    } };` },
  ...await Promise.all(["apps/api/order-service.mjs","apps/api/order-session.mjs","apps/api/order-admission.mjs","packages/contracts/order.mjs"]
    .map(async path => ({type:"ESModule",path,contents:await get(path)}))),
];
const mf = new Miniflare({modules, compatibilityDate:"2026-08-06", d1Databases:{DB:"tapflow-local-qa-only"}, d1Persist:false, telemetry:{enabled:false}});
try {
  const db = await mf.getD1Database("DB");
  for (const path of ["infra/free-stack/d1/0001_schema.sql", "infra/free-stack/d1/0003_order_sessions.sql", "infra/free-stack/d1/0004_order_admissions.sql"]) {
    const sql = (await get(path)).split("\n").filter(line => !/^\s*--|^\s*PRAGMA/.test(line)).join("\n");
    const triggerAt=sql.indexOf("CREATE TRIGGER");
    const plain=triggerAt<0?sql:sql.slice(0,triggerAt);
    for (const statement of plain.split(";").map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
    if(triggerAt>=0) await db.prepare(sql.slice(triggerAt).trim()).run();
  }
  await db.batch([
    db.prepare("INSERT INTO tenants(id,slug,name,status) VALUES ('ta','qa','Fictício A','active'),('tb','qb','Fictício B','active')"),
    db.prepare("INSERT INTO locations(id,tenant_id,name,status) VALUES ('la','ta','QA','active'),('lb','tb','QB','active')"),
    db.prepare("INSERT INTO dining_tables(id,tenant_id,location_id,label,is_active) VALUES ('ma','ta','la','1',1),('ma2','ta','la','2',1),('mb','tb','lb','1',1)"),
    db.prepare("INSERT INTO menu_items(id,tenant_id,location_id,name,price_cents,availability) VALUES ('aa','ta','la','Fictício A',2500,'available'),('bb','tb','lb','Fictício B',500,'available')"),
  ]);
  const now=Date.now();
  const fixture = (char, a, b, c, expiry=now+180000) => {
    const token=char.repeat(43), hash=createHash("sha256").update(token).digest("hex");
    return {token,hash,write:db.prepare("INSERT INTO order_sessions(session_hash,tenant_id,location_id,table_id,expires_at_ms) VALUES (?,?,?,?,?)").bind(hash,a,b,c,expiry)};
  };
  const mainCode="x".repeat(43), expiredCode="y".repeat(43), revokedCode="z".repeat(43);
  const digest = raw => createHash("sha256").update(raw).digest("hex");
  const seedAdmission=(code,expiry,revoked=null)=>db.prepare(
    "INSERT INTO order_admissions(admission_hash,tenant_id,location_id,table_id,issued_at_ms,expires_at_ms,revoked_at_ms) VALUES (?,'ta','la','ma',?,?,?)"
  ).bind(digest(code),now-60000,expiry,revoked);
  await db.batch([seedAdmission(mainCode,now+180000),seedAdmission(expiredCode,now-1000),seedAdmission(revokedCode,now+180000,now-1000)]);
  const redeem=code=>mf.dispatchFetch("http://localhost/_fixture/redeem",{method:"POST",headers:{"x-fixture-code":code}});
  const admissions=await Promise.all(Array.from({length:20},()=>redeem(mainCode)));
  assert.equal(admissions.filter(r=>r.status===200).length,1);
  assert.equal(admissions.filter(r=>r.status===401).length,19);
  assert.equal((await redeem(expiredCode)).status,401);
  assert.equal((await redeem(revokedCode)).status,401);
  const {token}=await admissions.find(r=>r.status===200).json();
  const main={token,hash:digest(token)}, otherTable=fixture("b","ta","la","ma2"), otherTenant=fixture("c","tb","lb","mb"), expired=fixture("d","ta","la","ma",now-1000);
  await db.batch([otherTable.write,otherTenant.write,expired.write]);
  const call=(path,token,body,key) => mf.dispatchFetch("http://localhost"+path,
    {method:body?"POST":"GET",headers:{"content-type":"application/json",authorization:"Bearer "+token,...key&&{"idempotency-key":key}},...body&&{body:JSON.stringify(body)}});
  const cart={lines:[{itemId:"aa",quantity:2,addonIds:[]}]};
  const q=await call("/v1/quotes",main.token,cart);
  assert.equal(q.status,200); assert.equal((await q.json()).total,5000);
  const attempts=await Promise.all(Array.from({length:6},()=>call("/v1/orders",main.token,cart,"miniflare-order-test-1")));
  assert.deepEqual(attempts.map(x=>x.status).sort(),[200,200,200,200,200,201]);
  const ids=new Set((await Promise.all(attempts.map(x=>x.json()))).map(x=>x.id));
  assert.equal(ids.size,1); const [id]=ids; const status="/v1/orders/"+id;
  assert.equal((await call(status,main.token)).status,200);
  assert.equal((await call(status,otherTable.token)).status,404);
  assert.equal((await call(status,otherTenant.token)).status,404);
  assert.equal((await call("/v1/quotes",expired.token,cart)).status,401);
  await db.prepare("UPDATE order_sessions SET revoked_at_ms = ? WHERE session_hash = ?").bind(now,main.hash).run();
  assert.equal((await call(status,main.token)).status,401);
  assert.equal((await call("/v1/orders",main.token,cart,"miniflare-order-test-2")).status,401);
  for(const table of ["orders","order_lines","order_events","order_idempotency"])
    assert.equal(await db.prepare("SELECT count(*) AS n FROM "+table).first("n"),1);
  console.log("D1 local: código de mesa de uso único (20 tentativas), cotação, pedido, status, seis reenvios concorrentes, expiração, revogação, isolamento da mesa/tenant; PASS");
} finally {
  await mf.dispose();
}
