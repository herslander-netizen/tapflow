import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createMerchantAdmin } from "../../apps/api/merchant-admin.mjs";

const origin="https://merchant.example.invalid";
const path="/v1/merchant/tenants";
const issuer="https://id.example.invalid";
const qa={issuer,subject:"qa"};
const qb={issuer,subject:"qb"};
const qa2={issuer,subject:"qa2"};
const fixture=(options={})=>{
  const store=new DatabaseSync(":memory:");
  for(const name of ["0001_schema","0007_order_staff_memberships","0009_merchant_catalog"]){
    store.exec(readFileSync(new URL(`../../infra/free-stack/d1/${name}.sql`,import.meta.url),"utf8"));
  }
  const db={
    prepare(query){return {bind(...args){return {
      all:async()=>({success:true,results:store.prepare(query).all(...args)}),
      _run(){
        const stmt=store.prepare(query);
        if(query.startsWith("SELECT"))return {success:true,results:stmt.all(...args)};
        return {success:true,meta:{changes:stmt.run(...args).changes}};
      }
    };}};},
    async batch(items){
      store.exec("BEGIN");
      try{const value=items.map(item=>item._run());store.exec("COMMIT");return value;}
      catch(err){store.exec("ROLLBACK");throw err;}
    }
  };
  const handle=createMerchantAdmin({enabled:true,origin,db,verifyIdentity:async request=>
    ({ "Bearer qa":qa,"Bearer qb":qb,"Bearer qa2":qa2 }[request.headers.get("authorization")]??null),
    provisioningAllowlist:[{...qa,slug:"test-a"},{...qb,slug:"test-b"}],...options});
  const request=(sub="qa",method="GET",suffix="",body,headers={})=>handle(new Request(origin+path+suffix,{method,
    headers:{"origin":origin,"authorization":`Bearer ${sub}`,"content-type":"application/json",...headers},
    ...(body!==undefined?{body:typeof body==="string"?body:JSON.stringify(body)}:{})}));
  return {store,request,handle};
};
const enrollment=(slug="test-a")=>({slug,name:"Fictício",locationName:"Primeira unidade"});

test("disabled, absent identity, cross-origin write, malformed body and no self grant",async()=>{
  assert.equal((await fixture({enabled:false}).request()).status,404);
  const {request,handle,store}=fixture();
  assert.equal(await handle(new Request(origin+"/other")),null);
  assert.equal((await request("anon","POST","",enrollment())).status,401);
  assert.equal((await request("qa","POST","",enrollment(),{origin:"https://external.example.invalid"})).status,403);
  assert.equal((await request("qa","POST",""," ".repeat(9000))).status,400);
  assert.equal((await request("qa","POST","",enrollment(),{"content-type":"text/plain"})).status,400);
  assert.equal((await request("qa","POST","",{...enrollment(),role:"owner"})).status,400);
  assert.equal((await request("qa2","POST","",enrollment())).status,403);
  assert.equal(store.prepare("SELECT COUNT(*) count FROM tenants").get().count,0);
});

test("one-shot provisioning atomically creates location, owner, staff membership and enrollment ledger",async()=>{
  const {request,store}=fixture();
  const requests=await Promise.all([request("qa","POST","",enrollment()),request("qa","POST","",enrollment())]);
  assert.deepEqual(requests.map(r=>r.status).sort(),[201,409]);
  const {tenant,location}=await requests.find(r=>r.status===201).json();
  for(const table of ["tenants","locations","merchant_owners","merchant_provisioning","order_staff_memberships"]){
    assert.equal(store.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count,1);
  }
  assert.equal(store.prepare("SELECT location_id FROM order_staff_memberships WHERE tenant_id=?").get(tenant.id).location_id,location.id);
  assert.deepEqual(await (await request()).json(),{tenants:[tenant]});
  assert.deepEqual(await (await request("qb")).json(),{tenants:[]});
});

test("a database error rolls back all five provisioning writes",async()=>{
  const {request,store}=fixture();
  store.exec("CREATE TRIGGER reject_fixture_staff BEFORE INSERT ON order_staff_memberships BEGIN SELECT RAISE(ABORT,'expected fixture'); END;");
  assert.equal((await request("qa","POST","",enrollment())).status,503);
  for(const table of ["tenants","locations","merchant_owners","merchant_provisioning","order_staff_memberships"]){
    assert.equal(store.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count,0);
  }
  store.exec("DROP TRIGGER reject_fixture_staff");
  assert.equal((await request("qa","POST","",enrollment())).status,201);
});

test("owner manages categories, products, prices, and addons; same/other tenant and unit are enforced",async()=>{
  const {request,store}=fixture();
  const a=await (await request("qa","POST","",enrollment())).json();
  const b=await (await request("qb","POST","",enrollment("test-b"))).json();
  const t=a.tenant.id,l=a.location.id;
  const mutation=(kind,body,key,user="qa",tenant=t)=>request(user,key?"PATCH":"POST",`/${tenant}/${kind}${key?"/"+key:""}`,body);
  const create=async(kind,body)=>{
    const res=await mutation(kind,body);
    assert.equal(res.status,201,JSON.stringify(await res.clone().json()));
    return (await res.json()).id;
  };
  const l2=await create("locations",{name:"Segunda"});
  const cat=await create("categories",{locationId:l,name:"Lanches",sortOrder:5});
  const cat2=await create("categories",{locationId:l2,name:"Pratos"});
  assert.equal((await mutation("locations",{name:"Segunda atualizada"},l2)).status,200);
  assert.equal((await mutation("items",{locationId:l,categoryId:cat2,name:"X",priceCents:10})).status,404);
  assert.equal((await mutation("items",{locationId:l,categoryId:cat,name:"X",priceCents:1.5})).status,400);
  const item=await create("items",{locationId:l,categoryId:cat,name:"Hambúrguer",priceCents:2500,availability:"available"});
  const addon=await create("addons",{locationId:l,itemId:item,name:"Queijo",priceCents:300});
  assert.equal((await mutation("addons",{locationId:l2,itemId:item,name:"X",priceCents:10})).status,404);
  assert.equal((await mutation("items",{locationId:l,categoryId:cat2,name:"X",priceCents:10},item)).status,404);
  assert.equal((await mutation("items",{locationId:l,categoryId:cat,name:"X",priceCents:10},item,"qb")).status,404);
  assert.equal((await mutation("categories",{locationId:b.location.id,name:"X"})).status,404);
  assert.equal((await request("qb","GET",`/${t}/catalog`)).status,404);
  assert.equal((await mutation("addons",{locationId:l,itemId:item,name:"Queijo",priceCents:400,isAvailable:false},addon)).status,200);
  const first=await (await request("qa","GET",`/${t}/catalog`)).json();
  assert.deepEqual(first.items,[{id:item,locationId:l,categoryId:cat,name:"Hambúrguer",description:null,priceCents:2500,availability:"available"}]);
  assert.deepEqual(first.addons,[{id:addon,locationId:l,itemId:item,name:"Queijo",priceCents:400,isAvailable:false}]);
  assert.equal(first.categories.find(c=>c.id===cat).isActive,true);
  assert.equal((await mutation("items",{locationId:l,categoryId:null,name:"Hambúrguer",priceCents:2600,availability:"sold_out"},item)).status,200);
  const final=await (await request("qa","GET",`/${t}/catalog`)).json();
  assert.equal(final.items[0].categoryId,null);
  assert.equal(final.items[0].priceCents,2600);
  assert.equal(store.prepare("SELECT role FROM order_staff_memberships WHERE location_id=?").get(l2).role,"owner");
  store.prepare("UPDATE merchant_owners SET status='suspended' WHERE tenant_id=?").run(t);
  assert.equal((await request("qa","GET",`/${t}/catalog`)).status,404);
  assert.equal((await mutation("locations",{name:"Não"})).status,404);
});
