import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createD1StaffMembershipRepository,createStaffIdentityAuthorizer} from "../../apps/api/staff-identity.mjs";

const issuer="https://staff.example.test", audience="urn:tapflow:orders", time=100000000;
const permission="issue_table_admission";
const keypair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},false,["sign","verify"]);
const label={alg:"RS256",typ:"at+jwt",kid:"trusted1"};
const claims={iss:issuer,aud:audience,sub:"subject_test",iat:time/1000,exp:time/1000+600,
  role:"owner",tenant_id:"untrusted"};
const segment=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
async function sign(c=claims,h=label){
  const text=segment(h)+"."+segment(c);
  const signature=await crypto.subtle.sign(keypair.privateKey.algorithm.name,keypair.privateKey,Buffer.from(text));
  return text+"."+Buffer.from(signature).toString("base64url");
}
const context=(token,tableId="ta")=>({
  request:new Request("https://tapflow.test/",{headers:token?{authorization:"Bearer "+token}:{}}),tableId
});
const expected={staffId:"operator",tenantId:"a",locationId:"la",permission,
  membershipProof:{issuer,subject:"subject_test",tableId:"ta"}};
const member={staff_id:"operator",tenant_id:"a",location_id:"la",table_id:"ta",role:"attendant"};
const defaults={enabled:true,issuer,audience,now:()=>time,
  getVerificationKey:async kid=>kid==="trusted1"?keypair.publicKey:null};

test("assinatura válida concede apenas o escopo consultado e a capacidade exata",async()=>{
  let lookedUp;
  const authorize=createStaffIdentityAuthorizer({...defaults,findActiveMembership:async g=>{lookedUp=g;return member;}});
  assert.deepEqual(await authorize(context(await sign()),permission),expected);
  assert.deepEqual(lookedUp,{issuer,subject:"subject_test",tableId:"ta"});
  assert.equal(await authorize(context(await sign()),"update_orders"),null);
});

test("desativado, assinatura adulterada, token errado, claims de destino/tempo inválidas: nunca consulta vínculos",async()=>{
  const fail=()=>assert.fail("leu vínculos de identidade inválida");
  const enabled=createStaffIdentityAuthorizer({...defaults,findActiveMembership:fail});
  const disabled=createStaffIdentityAuthorizer({...defaults,enabled:false,findActiveMembership:fail});
  const token=await sign();
  assert.equal(await disabled(context(token),permission),null);
  assert.equal(await enabled(null,permission),null);
  const [h,p,s]=token.split(".");
  for(const jwt of [
    null,[h,segment({...claims,sub:"tampered"}),s].join("."), await sign({...claims,iss:"https://other.example"}),
    await sign({...claims,aud:[audience,"other"]}),await sign({...claims,exp:time/1000}),
    await sign({...claims,nbf:time/1000+1}),await sign({...claims,iat:time/1000+1}),
    await sign({...claims,exp:time/1000+901}),await sign(claims,{...label,typ:"JWT"}),
    await sign(claims,{...label,jku:"https://other.example/key"}),await sign(claims,{...label,kid:"unknown"}),
    await sign(claims,{...label,alg:"HS256"})
  ])assert.equal(await enabled(context(jwt),permission),null);
});

test("D1 resolve a mesa e exige vínculo ativo exato; revogação e troca de papel têm efeito imediato",async t=>{
  const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());
  for(const f of ["0001_schema.sql","0007_order_staff_memberships.sql"]){
    sqlite.exec(readFileSync(new URL("../../infra/free-stack/d1/"+f,import.meta.url),"utf8"));
  }
  sqlite.exec(`
    INSERT INTO tenants (id,slug,name,status) VALUES ('a','a','A','active'),('b','b','B','active');
    INSERT INTO locations(id,tenant_id,name,status) VALUES ('la','a','A','active'),('la2','a','A2','active'),('lb','b','B','active');
    INSERT INTO dining_tables(id,tenant_id,location_id,label,is_active) VALUES ('ta','a','la','1',1),('ta2','a','la2','1',1),('tb','b','lb','1',1);
  `);
  const db={prepare(sql){return {bind(...args){return {first:async()=>sqlite.prepare(sql).get(...args)};}};}};
  const authorize=createStaffIdentityAuthorizer({...defaults,findActiveMembership:createD1StaffMembershipRepository(db)});
  const token=await sign();
  const read=table=>authorize(context(token,table),permission);
  sqlite.prepare("INSERT INTO order_staff_memberships VALUES (?,?,'operator','a','la','attendant','active')").run(issuer,"subject_test");
  assert.deepEqual(await read("ta"),expected);
  assert.equal(await read("ta2"),null);
  assert.equal(await read("tb"),null);
  sqlite.exec("UPDATE order_staff_memberships SET role='viewer'");
  assert.equal(await read("ta"),null);
  sqlite.exec("UPDATE order_staff_memberships SET role='manager',status='suspended'");
  assert.equal(await read("ta"),null);
  sqlite.exec("UPDATE order_staff_memberships SET status='active'; UPDATE locations SET status='suspended' WHERE id='la'");
  assert.equal(await read("ta"),null);
});
