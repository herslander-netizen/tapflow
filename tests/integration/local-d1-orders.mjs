// QA isolado: não usa IDs de deploy, autenticação Cloudflare nem recursos remotos.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createOrderAdmissionIssuer } from "../../apps/api/order-admission.mjs";
import { createOrderTracking } from "../../apps/api/order-tracking.mjs";
const [repo, miniflareFile] = process.argv.slice(2);
if (!repo || !miniflareFile) throw Error("Informe checkout e entrada Miniflare local");
const { Miniflare } = await import(pathToFileURL(miniflareFile));
const get = path => readFile(repo + "/" + path, "utf8");
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const issuer="https://tapflow-staff.example.invalid/", audience="tapflow-local-fixture";
const toPart=object=>Buffer.from(JSON.stringify(object)).toString("base64url");
function mintStaffToken(subject){
  const iat=Math.floor(Date.now()/1000);
  const input=toPart({alg:"RS256",typ:"at+jwt",kid:"local"})+"."+toPart({iss:issuer,aud:audience,sub:subject,iat,exp:iat+300});
  return input+"."+sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
}
const modules = [
  { type: "ESModule", path: "local-order-worker.mjs", contents: `
    import { createTableOrderRouter } from "./apps/api/table-order-router.mjs";
    import { createAdmissionAttemptGuard } from "./apps/api/admission-attempt-guard.mjs";
    import { createStaffIdentityAuthorizer,createD1StaffMembershipRepository } from "./apps/api/staff-identity.mjs";
    export default { async fetch(request, env) {
      const key = await crypto.subtle.importKey("raw",new Uint8Array(32).fill(4),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const issueLimiter = {limit:async()=>({success:true})};
      const redeemLimiter = {limit:async()=>({success:true})};
      const staffKey=await crypto.subtle.importKey("jwk",env.STAFF_PUBLIC_KEY,
        {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
      const localRoute = createTableOrderRouter({
        db:env.DB, enabled:true, origin:"http://localhost",
        resolveIngress:async()=>({source:"cloudflare-verified-ingress",address:"127.0.0.1"}),
        attemptGuard:createAdmissionAttemptGuard({issueLimiter,redeemLimiter,key}),
        authorizeStaff:createStaffIdentityAuthorizer({
          enabled:true,issuer:env.STAFF_ISSUER,audience:env.STAFF_AUDIENCE,
          getVerificationKey:async kid=>kid==="local"?staffKey:null,
          findActiveMembership:createD1StaffMembershipRepository(env.DB)
        })
      });
      return await localRoute(request) ?? new Response(null,{status:404});
    } };` },
  ...await Promise.all(["apps/api/order-service.mjs","apps/api/order-session.mjs","apps/api/order-admission.mjs","apps/api/order-tracking.mjs","apps/api/table-order-router.mjs","apps/api/admission-attempt-guard.mjs","apps/api/staff-identity.mjs","packages/contracts/order.mjs"]
    .map(async path => ({type:"ESModule",path,contents:await get(path)}))),
];
const mf = new Miniflare({modules, compatibilityDate:"2026-08-06", d1Databases:{DB:"tapflow-local-qa-only"}, d1Persist:false, bindings:{STAFF_PUBLIC_KEY:publicKey.export({format:"jwk"}),STAFF_ISSUER:issuer,STAFF_AUDIENCE:audience}, telemetry:{enabled:false}});
try {
  const db = await mf.getD1Database("DB");
  for (const path of ["infra/free-stack/d1/0001_schema.sql", "infra/free-stack/d1/0003_order_sessions.sql", "infra/free-stack/d1/0004_order_admissions.sql", "infra/free-stack/d1/0005_order_admission_issue_index.sql", "infra/free-stack/d1/0006_order_tracking_tokens.sql","infra/free-stack/d1/0007_order_staff_memberships.sql"]) {
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
  await db.prepare("INSERT INTO order_staff_memberships(staff_id,issuer,subject,tenant_id,location_id,role,status) VALUES (?,?,?,?,?,?,?)")
    .bind("staff-local",issuer,"fixture-user","ta","la","attendant","active").run();
  const staffToken=mintStaffToken("fixture-user");
  const now=Date.now();
  const staff={staffId:"fixture-staff",tenantId:"ta",locationId:"la",permission:"issue_table_admission"};
  const issue=createOrderAdmissionIssuer({db,requireCurrentStaffMembership:false,now:()=>now,authorizeStaff:async()=>staff});
  assert.equal(await issue(null,"mb"),null);
  assert.equal(await createOrderAdmissionIssuer({db})(staff,"ma2"),null);
  const issued=(await Promise.all(Array.from({length:12},()=>issue(null,"ma2")))).filter(Boolean);
  assert.equal(issued.length,3);
  assert.equal(await issue(null,"ma2"),null);
  const issuedHashes=(await db.prepare("SELECT admission_hash FROM order_admissions WHERE table_id='ma2'").all()).results;
  assert.deepEqual(new Set(issuedHashes.map(row=>row.admission_hash)),
    new Set(issued.map(grant=>createHash("sha256").update(grant.code).digest("hex"))));
  const fixture = (char, a, b, c, expiry=now+180000) => {
    const token=char.repeat(43), hash=createHash("sha256").update(token).digest("hex");
    return {token,hash,write:db.prepare("INSERT INTO order_sessions(session_hash,tenant_id,location_id,table_id,expires_at_ms) VALUES (?,?,?,?,?)").bind(hash,a,b,c,expiry)};
  };
  const expiredCode="y".repeat(43), revokedCode="z".repeat(43);
  const digest = raw => createHash("sha256").update(raw).digest("hex");
  const seedAdmission=(code,expiry,revoked=null)=>db.prepare(
    "INSERT INTO order_admissions(admission_hash,tenant_id,location_id,table_id,issued_at_ms,expires_at_ms,revoked_at_ms) VALUES (?,'ta','la','ma',?,?,?)"
  ).bind(digest(code),now-60000,expiry,revoked);
  await db.batch([seedAdmission(expiredCode,now-1000),seedAdmission(revokedCode,now+180000,now-1000)]);
  const post=(path,body,auth,origin="http://localhost")=>mf.dispatchFetch("http://localhost"+path,
    {method:"POST",headers:{"content-type":"application/json",origin,...auth&&{authorization:"Bearer "+auth}},
      ...body&&{body:JSON.stringify(body)}});
  assert.equal((await post("/v1/table-admissions",{tableId:"ma"})).status,403);
  assert.equal((await post("/v1/table-admissions",{tableId:"ma"},staffToken,"https://foreign.example")).status,403);
  assert.equal((await post("/v1/table-admissions",{tableId:"mb"},staffToken)).status,403);
  assert.equal((await post("/v1/table-admissions",{tableId:"ma"},mintStaffToken("unknown"))).status,403);
  const issueResult=await post("/v1/table-admissions",{tableId:"ma"},staffToken);
  assert.equal(issueResult.status,201);
  assert.equal(issueResult.headers.get("cache-control"),"no-store");
  const {code:mainCode}=await issueResult.json();
  await db.prepare("UPDATE order_staff_memberships SET status='suspended' WHERE staff_id='staff-local'").run();
  assert.equal((await post("/v1/table-admissions",{tableId:"ma"},staffToken)).status,403);
  const redeem=code=>post("/v1/order-sessions",{code});
  const admissions=await Promise.all(Array.from({length:20},()=>redeem(mainCode)));
  assert.equal(admissions.filter(r=>r.status===201).length,1);
  assert.equal(admissions.filter(r=>r.status===401).length,19);
  assert.equal((await redeem(expiredCode)).status,401);
  assert.equal((await redeem(revokedCode)).status,401);
  const {token}=await admissions.find(r=>r.status===201).json();
  const main={token,hash:digest(token)}, otherTable=fixture("b","ta","la","ma2"), otherTenant=fixture("c","tb","lb","mb"), expired=fixture("d","ta","la","ma",now-1000);
  await db.batch([otherTable.write,otherTenant.write,expired.write]);
  const call=(path,token,body,key) => mf.dispatchFetch("http://localhost"+path,
    {method:body?"POST":"GET",headers:{"content-type":"application/json",origin:"http://localhost",authorization:"Bearer "+token,...key&&{"idempotency-key":key}},...body&&{body:JSON.stringify(body)}});
  const cart={lines:[{itemId:"aa",quantity:2,addonIds:[]}]};
  const q=await call("/v1/quotes",main.token,cart);
  assert.equal(q.status,200); assert.equal((await q.json()).total,5000);
  const attempts=await Promise.all(Array.from({length:6},()=>call("/v1/orders",main.token,cart,"miniflare-order-test-1")));
  assert.deepEqual(attempts.map(x=>x.status).sort(),[200,200,200,200,200,201]);
  const ids=new Set((await Promise.all(attempts.map(x=>x.json()))).map(x=>x.id));
  assert.equal(ids.size,1); const [id]=ids; const status="/v1/orders/"+id;
  assert.equal((await call(status,main.token)).status,200);
  let trackingTime=Date.now();
  const tracker=createOrderTracking({db,now:()=>trackingTime,enabled:true});
  const trackRequest=(token,method="GET")=>new Request("http://localhost"+status,
    {method,headers:{authorization:"Bearer "+token}});
  assert.equal(await tracker.issue(trackRequest(otherTable.token),id),null);
  const trackPath="/v1/order-tracking/"+id;
  assert.equal((await post(trackPath,null,otherTable.token)).status,404);
  const trackingResponse=await post(trackPath,null,main.token);
  assert.equal(trackingResponse.status,201);
  // Simulate losing the first successful response after the write committed.
  const savedTrackingHash=await db.prepare("SELECT token_hash,expires_at_ms FROM order_tracking_tokens WHERE order_id=?").bind(id).first();
  await trackingResponse.body.cancel();
  const recovered=await post(trackPath,null,main.token);
  assert.equal(recovered.status,201);
  const trackGrant=await recovered.json();
  assert.equal(digest(trackGrant.token),savedTrackingHash.token_hash);
  assert.equal(trackGrant.expiresAtMs,savedTrackingHash.expires_at_ms);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM order_tracking_tokens").first("n"),1);
  assert.equal((await post(trackPath,null,otherTable.token)).status,404);
  assert.equal((await call(trackPath,trackGrant.token)).status,200);
  assert.equal((await call(trackPath+"?token=not-allowed",trackGrant.token)).status,400);
  assert.equal((await call(trackPath,main.token)).status,404);
  assert.ok(trackGrant);
  trackingTime+=31*60*1000;
  assert.equal(await tracker.issue(trackRequest(main.token),id),null);
  assert.equal((await tracker.read(trackRequest(trackGrant.token),id)).status,"submitted");
  assert.equal(await tracker.read(trackRequest(trackGrant.token,"POST"),id),null);
  assert.equal((await call(status,trackGrant.token)).status,401);
  trackingTime=trackGrant.expiresAtMs;
  assert.equal(await tracker.read(trackRequest(trackGrant.token),id),null);

  assert.equal((await call(status,otherTable.token)).status,404);
  assert.equal((await call(status,otherTenant.token)).status,404);
  assert.equal((await call("/v1/quotes",expired.token,cart)).status,401);
  await db.prepare("UPDATE order_sessions SET revoked_at_ms = ? WHERE session_hash = ?").bind(now,main.hash).run();
  assert.equal((await call(status,main.token)).status,401);
  assert.equal((await call("/v1/orders",main.token,cart,"miniflare-order-test-2")).status,401);
  for(const table of ["orders","order_lines","order_events","order_idempotency"])
    assert.equal(await db.prepare("SELECT count(*) AS n FROM "+table).first("n"),1);
  console.log("D1 local: emissão autorizada e limitada, código de mesa de uso único (20 tentativas), cotação, pedido, status, seis reenvios concorrentes, expiração, revogação, isolamento da mesa/tenant e acompanhamento somente de leitura após 31 min; PASS");
} finally {
  await mf.dispose();
}
