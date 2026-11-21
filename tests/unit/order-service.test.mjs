import test from "node:test";
import assert from "node:assert/strict";
import {createOrderApi} from "../../apps/api/order-service.mjs";

const session={tenantId:"tenant_a",locationId:"unit_a",tableId:"mesa_08",sessionHash:"a".repeat(64)};
const cart={lines:[{itemId:"burger",quantity:2,addonIds:["cheese"],notes:"sem cebola"}]};
const url="https://tapflow.example/v1/orders";
const post=(path="/v1/orders",data=cart,key="order-test-001")=>new Request("https://tapflow.example"+path,{method:"POST",
 headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(data)});
const fakeDb=({tenant=session.tenantId,available=true,price=3500}={})=>{
 const state={orders:new Map(),idem:new Map(),lines:new Map(),events:new Map(),batches:[]};
 const prepare=sql=>({bind(...args){return {
  sql,args,async first(){
   if(sql.startsWith("SELECT dt.id AS table_id"))return tenant===session.tenantId?{table_id:session.tableId}:null;
   if(sql.startsWith("SELECT id,status,payment_status,total_cents FROM orders")){
     const row=state.orders.get(args[0]);return row?.tenant_id===args[1]&&row?.location_id===args[2]&&row?.table_id===args[3]&&row?.actor_session_hash===args[4]?row:null;
   }
   throw Error("SELECT inesperado: "+sql);
  },async all(){
   if(sql.startsWith("SELECT m.id AS item_id")){
    if(tenant!==args[0]||!args.slice(2).includes("burger"))return {results:[]};
    return {results:[{item_id:"burger",item_name:"Burger",item_price:price,availability:available?"available":"sold_out",
      addon_id:"cheese",addon_name:"Queijo",addon_price:500,addon_available:1}]};
   }
   throw Error("QUERY inesperada: "+sql);
  }
 }}});
 const db={prepare,async batch(statements){
  state.batches.push(statements);
  const [order,idempotency,...others]=statements;
  const orderId=order.args[0],tenantId=order.args[1];
  const key=[idempotency.args[0],idempotency.args[1],idempotency.args[2]].join("|");
  const current=state.idem.get(key);
  let made=0;
  if(!current){
    if(tenant!==tenantId||!available||price!==order.args[9])throw Error("Guard conflict");
    state.orders.set(orderId,{id:orderId,tenant_id:tenantId,location_id:order.args[2],
      table_id:order.args[3],actor_session_hash:order.args[4],status:"submitted",payment_status:"not_required",
      total_cents:order.args[5]});
    state.idem.set(key,{request_hash:idempotency.args[3],order_id:orderId});made=1;
  }
  for(const statement of others.slice(0,-1)){
    if(current&&current.request_hash!==idempotency.args[3])continue;
    if(statement.sql.startsWith("INSERT OR IGNORE INTO order_lines"))state.lines.set(statement.args[0],statement.args);
    if(statement.sql.startsWith("INSERT OR IGNORE INTO order_events"))state.events.set(statement.args[0],statement.args);
  }
  const record=state.idem.get(key),saved=state.orders.get(record.order_id);
  return [{meta:{changes:made}},{meta:{changes:made}},...others.slice(0,-1).map(()=>({meta:{changes:1}})),
    {results:[{request_hash:record.request_hash,order_id:record.order_id,total_cents:saved.total_cents,
      status:saved.status,payment_status:saved.payment_status}]}];
 }};
 return {db,state};
};
test("API desativada por padrão; não aceita pedidos reais",async()=>{
 const r=await createOrderApi({})(post());assert.equal(r.status,503);
});
test("não inventa uma sessão do navegador",async()=>{
 const {db}=fakeDb();
 const r=await createOrderApi({db,enabled:true})(post());assert.equal(r.status,503);
});
test("o tenant é derivado do verificador, nunca do JSON",async()=>{
 const {db}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 const r=await api(post("/v1/orders",{...cart,tenantId:"tenant_b"}));
 assert.equal(r.status,400);
});
test("cota usando somente cardápio do servidor",async()=>{
 const {db}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 const r=await api(post("/v1/quotes",{lines:[{itemId:"burger",quantity:2,addonIds:["cheese"],unitPrice:1}]}));
 assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.total,8000);assert.equal(data.quoteOnly,true);
});
test("recusa item esgotado",async()=>{
 const {db}=fakeDb({available:false});
 const r=await createOrderApi({db,enabled:true,authorizeSession:async()=>session})(post());
 assert.equal(r.status,422);
});
test("cria um único pedido e evento por chave; replay não duplica",async()=>{
 const {db,state}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 const a=await api(post()),b=await api(post());
 assert.equal(a.status,201);assert.equal(b.status,200);
 const first=await a.json(),second=await b.json();
 assert.equal(first.id,second.id);assert.equal(first.total,8000);assert.equal(first.paymentStatus,"not_required");
 assert.equal(second.replayed,true);assert.equal(state.orders.size,1);
 assert.equal(state.lines.size,1);assert.equal(state.events.size,1);
 assert.ok(state.batches[0][0].sql.includes("availability='available'"));
 assert.ok(state.batches[0][0].sql.includes("price_cents=?"));
});
test("reutilizar chave com outro conteúdo retorna 409 sem novas linhas",async()=>{
 const {db,state}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 await api(post());
 const clash=await api(post("/v1/orders",{lines:[{itemId:"burger",quantity:1,addonIds:[]}]}));
 assert.equal(clash.status,409);assert.equal(state.lines.size,1);
});
test("consulta de pedido restringe sessão e tenant",async()=>{
 const {db}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 const newOrder=await (await api(post())).json();
 const own=await api(new Request("https://tapflow.example/v1/orders/"+newOrder.id));
 assert.equal(own.status,200);
 const other=createOrderApi({db,enabled:true,authorizeSession:async()=>({...session,sessionHash:"b".repeat(64)})});
 const notFound=await other(new Request("https://tapflow.example/v1/orders/"+newOrder.id));
 assert.equal(notFound.status,404);
});
test("scope inválido e contexto malformado não escrevem",async()=>{
 const {db,state}=fakeDb({tenant:"tenant_b"});
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 const r=await api(post());assert.equal(r.status,403);assert.equal(state.batches.length,0);
});
test("recusa chave curta e solicitação grande",async()=>{
 const {db}=fakeDb();
 const api=createOrderApi({db,enabled:true,authorizeSession:async()=>session});
 assert.equal((await api(post("/v1/orders",cart,"x"))).status,400);
 const huge=post("/v1/orders",{lines:Array.from({length:500},()=>({itemId:"burger",quantity:1,addonIds:[]}))});
 assert.equal((await api(huge)).status,413);
});
