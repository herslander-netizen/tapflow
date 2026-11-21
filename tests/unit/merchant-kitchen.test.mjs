import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createMerchantKitchen } from "../../apps/api/merchant-kitchen.mjs";

const origin="https://kitchen.example.invalid",issuer="https://issuer.example.invalid",base="/v1/merchant/kitchen";
function pilot(extra={}){
  const data=new DatabaseSync(":memory:");
  for(const name of ["0001_schema","0007_order_staff_memberships","0010_merchant_kitchen"])
    data.exec(readFileSync(new URL(`../../infra/free-stack/d1/${name}.sql`,import.meta.url),"utf8"));
  data.exec(`
    INSERT INTO tenants(id,slug,name,status) VALUES ('t1','fixture','QA1','active'),('t2','separate','QA2','active');
    INSERT INTO locations(id,tenant_id,name,status) VALUES ('l1','t1','A','active'),('l2','t1','B','active'),('l3','t2','C','active');
    INSERT INTO dining_tables(id,tenant_id,location_id,label) VALUES ('dt','t1','l1','Mesa A');
    INSERT INTO orders(id,tenant_id,location_id,table_id,actor_session_hash,total_cents,payment_status)
      VALUES ('order','t1','l1','dt','private-hash',1000,'not_required'),('second','t1','l2',NULL,'hash2',1000,'not_required'),
      ('third','t2','l3',NULL,'hash3',1000,'not_required'),('paid','t1','l1',NULL,'hash4',1000,'paid');
    INSERT INTO order_lines(id,tenant_id,order_id,item_id,name_snapshot,quantity,unit_price_cents,total_cents,notes)
      VALUES ('ln','t1','order','product','Hambúrguer fictício',1,1000,1000,'Sem cebola');
  `);
  const add=data.prepare("INSERT INTO order_staff_memberships(issuer,subject,staff_id,tenant_id,location_id,role,status) VALUES (?,?,?,'t1','l1',?,?)");
  for(const [sub,role,status] of [["own","owner","active"],["mgr","manager","active"],["att","attendant","active"],["view","viewer","active"],["no","owner","suspended"]])
    add.run(issuer,sub,"staff-"+sub,role,status);
  const db={
    prepare(sql){return {bind(...args){
      const load=()=>data.prepare(sql);
      const read=()=>({success:true,results:load().all(...args),meta:{changes:0}});
      return {all:async()=>read(), run:()=>/\bINSERT INTO merchant_kitchen_transitions\b/.test(sql)?
        ({success:true,meta:{changes:load().run(...args).changes}}):read()};
    }};},
    async batch(stmts){data.exec("BEGIN");try{const result=stmts.map(s=>s.run());data.exec("COMMIT");return result;}
      catch(error){data.exec("ROLLBACK");throw error;}}
  };
  const handler=createMerchantKitchen({origin,db,enabled:true,verifyIdentity:async request=>{
    const raw=request.headers.get("authorization");
    return /^Bearer [a-z]+$/.test(raw??"")?{issuer,subject:raw.slice(7)}:null;
  },...extra});
  const request=(path,sub="own",body,extraHeaders={})=>handler(new Request(origin+base+path,{
    method:body!==undefined?"POST":"GET",headers:{authorization:`Bearer ${sub}`,origin,"content-type":"application/json",...extraHeaders},
    ...(body!==undefined?{body:typeof body==="string"?body:JSON.stringify(body)}:{})
  }));
  return {data,request};
}
const queue="/t1/l1/orders";
const write=queue+"/order/transition";
test("off by default; signed identity and active scoped unit membership required on reads",async()=>{
  assert.equal((await pilot({enabled:false}).request("/units")).status,404);
  const {request}=pilot();
  assert.equal((await request("/units","")).status,401);
  assert.deepEqual((await (await request("/units")).json()).units,[{tenantId:"t1",tenantName:"QA1",locationId:"l1",locationName:"A",role:"owner"}]);
  assert.deepEqual((await (await request("/units","no")).json()).units,[]);
  for(const url of ["/t1/l2/orders","/t1/l2/orders/second","/t2/l3/orders","/t2/l3/orders/third",queue+"/second",queue+"/third"])
    assert.equal((await request(url)).status,404,url);
  const listing=await (await request(queue)).json();
  assert.deepEqual(new Set(listing.orders.map(o=>o.id)),new Set(["order","paid"]));
  const {order}=await (await request(queue+"/order")).json();
  assert.equal(order.tableLabel,"Mesa A");
  assert.equal(order.lines[0].notes,"Sem cebola");
  assert.deepEqual(order.allowedTransitions,["accepted","rejected"]);
  assert.ok(!JSON.stringify(order).includes("private-hash"));
});

test("staff permissions, expected status, origin, payment and role are checked atomically",async()=>{
  const {request,data}=pilot();
  const accept={expectedStatus:"submitted",status:"accepted"};
  assert.equal((await request(write,"view",accept)).status,409);
  assert.equal((await request(write,"no",accept)).status,404);
  assert.equal((await request(write,"att",accept,{origin:"https://other.example.invalid"})).status,403);
  assert.equal((await request(write,"own",{...accept,paymentStatus:"not_required"})).status,400);
  assert.equal((await request(write,"own"," ".repeat(3000))).status,400);
  assert.equal((await request(write,"own",{status:"rejected",expectedStatus:"submitted",reason:" "})).status,400);
  assert.equal((await request(queue+"/paid/transition","own",accept)).status,409);
  const results=await Promise.all([request(write,"att",accept),request(write,"att",accept)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await request(write,"att",{expectedStatus:"accepted",status:"preparing"})).status,409);
  for(const [expectedStatus,status,role] of [["accepted","preparing","mgr"],["preparing","ready","mgr"],["ready","completed","att"]]){
    const response=await request(write,role,{expectedStatus,status});
    assert.equal(response.status,200);
    assert.equal((await response.json()).status,status);
  }
  assert.deepEqual(data.prepare("SELECT action,actor_id FROM order_events ORDER BY rowid").all().map(r=>[r.action,r.actor_id]),
    [["accepted","staff-att"],["preparing","staff-mgr"],["ready","staff-mgr"],["completed","staff-att"]]);
  assert.equal(data.prepare("SELECT COUNT(*) n FROM merchant_kitchen_transitions").get().n,4);
  assert.equal(data.prepare("SELECT status FROM orders WHERE id='second'").get().status,"submitted");
  assert.equal(data.prepare("SELECT payment_status FROM orders WHERE id='paid'").get().payment_status,"paid");
});
test("audit failure rolls back status and command; rejection reason only kept in audit",async()=>{
  const {request,data}=pilot();
  const reject={status:"rejected",expectedStatus:"submitted",reason:" Produto indisponível "};
  data.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON order_events BEGIN SELECT RAISE(ABORT,'QA'); END;");
  assert.equal((await request(write,"own",reject)).status,503);
  assert.equal(data.prepare("SELECT COUNT(*) n FROM merchant_kitchen_transitions").get().n,0);
  assert.equal(data.prepare("SELECT status FROM orders WHERE id='order'").get().status,"submitted");
  data.exec("DROP TRIGGER fail_audit;");
  const response=await request(write,"att",reject);
  assert.equal(response.status,200);
  assert.equal(data.prepare("SELECT reason FROM order_events").get().reason,"Produto indisponível");
  assert.doesNotMatch(await response.text(),/indisponível/);
});
