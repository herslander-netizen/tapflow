import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createMerchantAppearanceHandler } from "../../apps/api/merchant-appearance.mjs";

const issuer="https://identity.example.test";
const draft={preset:"brasa",mode:"dark",accent:"#ab1234",background:null};
const changed={...draft,accent:"#00FF00"};
function fixture(t){
  const sqlite=new DatabaseSync(":memory:");
  t.after(()=>sqlite.close());
  for(const name of ["0001_schema","0007_order_staff_memberships","0008_merchant_appearance","0009_merchant_catalog"]){
    sqlite.exec(readFileSync(new URL(`../../infra/free-stack/d1/${name}.sql`,import.meta.url),"utf8"));
  }
  sqlite.exec(`INSERT INTO tenants (id,slug,name,status) VALUES('a','a','A','active'),('b','b','B','active');
    INSERT INTO locations (id,tenant_id,name,status) VALUES
      ('one','a','Loja A','active'),('two','b','Loja B','active'),('extra','a','Filial','suspended');`);
  const membership=sqlite.prepare("INSERT INTO order_staff_memberships VALUES(?,?,?,?,?,?,?)");
  membership.run(issuer,"alice","one-owner","a","one","owner","active");
  membership.run(issuer,"bob","two-owner","b","two","owner","active");
  membership.run(issuer,"manager","one-manager","a","one","manager","active");
  membership.run(issuer,"suspended","one-suspended","a","one","owner","suspended");
  const owner=sqlite.prepare("INSERT INTO merchant_owners (tenant_id,issuer,subject,staff_id,status) VALUES (?,?,?,?,?)");
  owner.run("a",issuer,"alice","one-owner","active");
  owner.run("b",issuer,"bob","two-owner","active");
  owner.run("a",issuer,"manager","one-manager","active");
  owner.run("a",issuer,"suspended","one-suspended","active");
  const db={prepare(sql){return {bind(...args){
    return {async first(){
      return sqlite.prepare(sql.replace(/\?\d+/g,m=>"$"+m.slice(1)))
        .get(Object.fromEntries(args.map((v,i)=>["$"+(i+1),v])))??null;
    }};
  }}}};
  const verifyIdentity=async req=>{
    const subject=req.headers.get("x-fixture");
    return subject?{issuer,subject}:null;
  };
  const handler=createMerchantAppearanceHandler({enabled:true,db,verifyIdentity});
  const call=(tenant,action,subject,data)=>{
    const method=action==="read"?"GET":"POST";
    const headers={};
    if(subject)headers["x-fixture"]=subject;
    if(data!==undefined)headers["Content-Type"]="application/json";
    return handler(new Request("https://tap.example.test/",{method,headers,
      body:data===undefined?undefined:JSON.stringify(data)}),tenant,action);
  };
  return {call,sqlite,db,verifyIdentity};
}

test("tenant owner can edit, publish and preserve public state between revisions",async t=>{
  const {call}=fixture(t);
  const init=await call("a","read","alice");
  assert.equal(init.status,200);
  assert.equal(init.headers.get("cache-control"),"no-store");
  assert.equal((await init.json()).revision,0);
  const [winner,stale]=await Promise.all([
    call("a","save","alice",{revision:0,settings:draft}),
    call("a","save","alice",{revision:0,settings:changed})
  ]);
  assert.equal(winner.status,200);
  assert.equal(stale.status,409);
  assert.deepEqual(await winner.json(),{draft:{...draft,accent:"#AB1234"},published:null,revision:1});
  const pub=await call("a","publish","alice",{revision:1});
  assert.equal(pub.status,200);
  const published=await pub.json();
  assert.deepEqual(published.published,{...draft,accent:"#AB1234"});
  assert.equal(published.revision,2);
  assert.equal((await call("a","publish","alice",{revision:1})).status,409);
  const next=await call("a","save","alice",{revision:2,settings:changed});
  assert.deepEqual(await next.json(),{draft:changed,published:published.published,revision:3});
  assert.equal((await (await call("b","read","bob")).json()).revision,0);
});

test("no writes by another tenant, manager, suspended membership or partial-location owner",async t=>{
  const {call,sqlite}=fixture(t);
  assert.equal((await call("a","read",null)).status,401);
  for(const subject of ["bob","manager","suspended"]){
    assert.equal((await call("a","read",subject)).status,404);
    assert.equal((await call("a","save",subject,{revision:0,settings:draft})).status,404);
  }
  assert.equal((await call("a","save","alice",{revision:0,settings:draft})).status,200);
  sqlite.exec("UPDATE locations SET status='active' WHERE id='extra'");
  assert.equal((await call("a","publish","alice",{revision:1})).status,404);
  assert.equal(sqlite.prepare("SELECT published_json FROM tenant_appearances").get().published_json,null);
  sqlite.exec("UPDATE locations SET status='suspended' WHERE id='extra'");
  sqlite.exec("UPDATE order_staff_memberships SET staff_id='unrelated-staff' WHERE subject='alice'");
  assert.equal((await call("a","publish","alice",{revision:1})).status,404);
  sqlite.exec("UPDATE order_staff_memberships SET staff_id='one-owner' WHERE subject='alice'");
  sqlite.exec("UPDATE merchant_owners SET status='suspended' WHERE tenant_id='a'");
  assert.equal((await call("a","read","alice")).status,404);
  assert.equal((await call("a","save","alice",{revision:1,settings:changed})).status,404);
  assert.equal((await call("a","publish","alice",{revision:1})).status,404);
  assert.equal(sqlite.prepare("SELECT revision FROM tenant_appearances").get().revision,1);
  sqlite.exec("UPDATE tenants SET status='suspended' WHERE id='b'");
  assert.equal((await call("b","read","bob")).status,404);
});

test("strict semantic allowlist, size cap, and feature disabled by default",async t=>{
  const {call,db,verifyIdentity}=fixture(t);
  const disabled=createMerchantAppearanceHandler({db,verifyIdentity});
  assert.equal((await disabled(new Request("https://tap.example.test/"),"a","read")).status,404);
  for(const invalid of [{...draft,logo:"https://other.test/logo.svg"},{...draft,mode:"auto"},
    {...draft,accent:"red"},{...draft,preset:"__proto__"},{...draft,background:"#FFFF"},{...draft,preset:"x".repeat(1024)}]){
    assert.equal((await call("a","save","alice",{revision:0,settings:invalid})).status,400);
  }
  assert.equal((await call("a","save","alice",{revision:-1,settings:draft})).status,400);
  assert.equal((await call("a","save","alice",{revision:1,settings:draft})).status,409);
  assert.equal((await call("a","publish","alice",{revision:0})).status,409);
});
