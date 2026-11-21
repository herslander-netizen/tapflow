// TapFlow: API de pedidos em preparação. Nunca publicar com ORDER_API_ENABLED desligado
// ou sem implementar authorizeSession a partir de credenciais verificadas pelo backend.
import {validateOrder,quoteOrder} from "../../packages/contracts/order.mjs";

const ID=/^[A-Za-z0-9_-]{1,64}$/;
const KEY=/^[A-Za-z0-9_.:-]{8,128}$/;
const HASH=/^[a-f0-9]{64}$/;
const MAX_BYTES=12*1024;
const json=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const failure=(status,message)=>json(status,{error:message});
const sha=async value=>{
  const data=new TextEncoder().encode(value);
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
  return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
};

async function boundedBody(request){
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw Object.assign(new Error("Envie JSON"),{httpStatus:415});
  if(Number(request.headers.get("content-length")||0)>MAX_BYTES)
    throw Object.assign(new Error("Pedido muito grande"),{httpStatus:413});
  if(!request.body)throw Object.assign(new Error("Corpo obrigatório"),{httpStatus:400});
  const reader=request.body.getReader(),parts=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BYTES){await reader.cancel();throw Object.assign(new Error("Pedido muito grande"),{httpStatus:413});}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  const body=new Uint8Array(size);let offset=0;
  for(const part of parts){body.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body));}
  catch{throw Object.assign(new Error("JSON inválido"),{httpStatus:400});}
}
function trustedContext(value){
  if(!value||typeof value!=="object"||![value.tenantId,value.locationId,value.tableId].every(id=>ID.test(id||""))||!HASH.test(value.sessionHash||""))
    throw Object.assign(new Error("Sessão verificada obrigatória"),{httpStatus:401});
  return {tenantId:value.tenantId,locationId:value.locationId,tableId:value.tableId,sessionHash:value.sessionHash};
}
function normalizeCart(input,context){
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.hasOwn(input,"tenantId")||Object.hasOwn(input,"tableId")||Object.hasOwn(input,"total"))
    throw Object.assign(new Error("Estabelecimento, mesa e preços são definidos pelo servidor"),{httpStatus:400});
  return validateOrder({tenantId:context.tenantId,tableId:context.tableId,lines:input.lines});
}
async function verifyTable(db,ctx){
  const row=await db.prepare(
    "SELECT dt.id AS table_id FROM dining_tables dt "+
    "JOIN locations l ON l.tenant_id=dt.tenant_id AND l.id=dt.location_id "+
    "JOIN tenants t ON t.id=dt.tenant_id "+
    "WHERE dt.id=? AND dt.tenant_id=? AND dt.location_id=? "+
    "AND dt.is_active=1 AND l.status='active' AND t.status='active'"
  ).bind(ctx.tableId,ctx.tenantId,ctx.locationId).first();
  if(!row)throw Object.assign(new Error("Mesa ou estabelecimento indisponível"),{httpStatus:403});
}
async function catalogFor(db,ctx,cart){
  const unique=[...new Set(cart.lines.map(x=>x.itemId))];
  const marks=unique.map(()=>"?").join(",");
  const statement="SELECT m.id AS item_id,m.name AS item_name,m.price_cents AS item_price,m.availability, "+
    "a.id AS addon_id,a.name AS addon_name,a.price_cents AS addon_price,a.is_available AS addon_available "+
    "FROM menu_items m LEFT JOIN menu_addons a ON a.tenant_id=m.tenant_id AND a.menu_item_id=m.id "+
    "WHERE m.tenant_id=? AND m.location_id=? AND m.id IN ("+marks+")";
  const query=await db.prepare(statement).bind(ctx.tenantId,ctx.locationId,...unique).all();
  const byId=new Map();
  for(const row of query.results||[]){
    if(!byId.has(row.item_id)){
      byId.set(row.item_id,{id:row.item_id,name:row.item_name,price:row.item_price,
        tenantId:ctx.tenantId,available:row.availability==="available",addons:[]});
    }
    if(row.addon_id!=null)byId.get(row.item_id).addons.push({id:row.addon_id,name:row.addon_name,
      price:row.addon_price,available:row.addon_available===1});
  }
  return [...byId.values()];
}
async function priceQuote(db,ctx,input){
  const cart=normalizeCart(input,ctx);
  await verifyTable(db,ctx);
  const catalog=await catalogFor(db,ctx,cart);
  const quote=quoteOrder(cart,catalog);
  return {quote,catalog};
}
const guardedSql=(ctx,quote,catalog)=>{
  const clauses=[
    "EXISTS (SELECT 1 FROM dining_tables dt JOIN locations l ON l.id=dt.location_id AND l.tenant_id=dt.tenant_id "+
    "JOIN tenants t ON t.id=dt.tenant_id WHERE dt.id=? AND dt.tenant_id=? AND dt.location_id=? AND dt.is_active=1 "+
    "AND l.status='active' AND t.status='active')"
  ];
  const bind=[ctx.tableId,ctx.tenantId,ctx.locationId];
  for(const line of quote.lines){
    const item=catalog.find(x=>x.id===line.itemId);
    clauses.push("EXISTS (SELECT 1 FROM menu_items WHERE tenant_id=? AND location_id=? AND id=? "+
      "AND availability='available' AND price_cents=?)");
    bind.push(ctx.tenantId,ctx.locationId,line.itemId,item.price);
    for(const addon of line.addons){
      clauses.push("EXISTS (SELECT 1 FROM menu_addons WHERE tenant_id=? AND menu_item_id=? "+
        "AND id=? AND is_available=1 AND price_cents=?)");
      bind.push(ctx.tenantId,line.itemId,addon.id,addon.price);
    }
  }
  return {where:clauses.join(" AND "),bind};
};
async function repeatOrder(db,ctx,input,key){
  const cart=normalizeCart(input,ctx);
  const canonical=JSON.stringify({tenantId:ctx.tenantId,locationId:ctx.locationId,tableId:ctx.tableId,lines:cart.lines});
  const hash=await sha(canonical);
  const existing=await db.prepare("SELECT i.request_hash,i.order_id,o.total_cents,o.status,o.payment_status "+
    "FROM order_idempotency i JOIN orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id "+
    "WHERE i.tenant_id=? AND i.actor_session_hash=? AND i.idempotency_key=?")
    .bind(ctx.tenantId,ctx.sessionHash,key).first();
  if(!existing)return null;
  if(existing.request_hash!==hash)return {status:409,body:{error:"Chave de idempotência usada para outro pedido"}};
  return {status:200,body:{id:existing.order_id,status:existing.status,
    paymentStatus:existing.payment_status,total:existing.total_cents,currency:"BRL",
    persisted:true,replayed:true}};
}
async function submit(db,ctx,quote,catalog,key){
  const canonical=JSON.stringify({tenantId:ctx.tenantId,locationId:ctx.locationId,tableId:ctx.tableId,
    lines:quote.lines.map(l=>({itemId:l.itemId,quantity:l.quantity,addonIds:l.addonIds,notes:l.notes}))});
  const requestHash=await sha(canonical);
  const short=(await sha("tapflow-order\n"+ctx.tenantId+"\n"+ctx.sessionHash+"\n"+key)).slice(0,40);
  const orderId="ord_"+short;
  const guard=guardedSql(ctx,quote,catalog);
  const idWhere="EXISTS (SELECT 1 FROM order_idempotency WHERE tenant_id=? "+
    "AND actor_session_hash=? AND idempotency_key=? AND request_hash=?)";
  const idem=[ctx.tenantId,ctx.sessionHash,key,requestHash];
  const stmts=[
    db.prepare("INSERT OR IGNORE INTO orders(id,tenant_id,location_id,table_id,actor_session_hash,status,payment_status,total_cents,currency) "+
      "SELECT ?,?,?,?,?,'submitted','not_required',?,'BRL' WHERE "+guard.where)
      .bind(orderId,ctx.tenantId,ctx.locationId,ctx.tableId,ctx.sessionHash,quote.total,...guard.bind),
    db.prepare("INSERT OR IGNORE INTO order_idempotency(tenant_id,actor_session_hash,idempotency_key,request_hash,order_id) "+
      "VALUES (?,?,?,?,?)").bind(...idem,orderId)
  ];
  for(let i=0;i<quote.lines.length;i++){
    const l=quote.lines[i];
    stmts.push(db.prepare("INSERT OR IGNORE INTO order_lines(id,tenant_id,order_id,item_id,name_snapshot,addons_json,quantity,unit_price_cents,total_cents,notes) "+
      "SELECT ?,?,?,?,?,?,?,?,?,? WHERE "+idWhere)
      .bind("ln_"+short+"_"+i,ctx.tenantId,orderId,l.itemId,l.name,
        JSON.stringify(l.addons),l.quantity,l.unitPrice,l.total,l.notes,...idem));
  }
  stmts.push(db.prepare("INSERT OR IGNORE INTO order_events(id,tenant_id,order_id,action,actor_type,actor_id) "+
    "SELECT ?,?,?,'submitted','table_session',? WHERE "+idWhere)
    .bind("ev_"+short,ctx.tenantId,orderId,ctx.sessionHash,...idem));
  stmts.push(db.prepare("SELECT i.request_hash,i.order_id,o.total_cents,o.status,o.payment_status "+
    "FROM order_idempotency i JOIN orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id "+
    "WHERE i.tenant_id=? AND i.actor_session_hash=? AND i.idempotency_key=?").bind(ctx.tenantId,ctx.sessionHash,key));
  const results=await db.batch(stmts);
  const saved=results.at(-1)?.results?.[0];
  if(!saved)throw Error("Pedido não confirmado no banco");
  if(saved.request_hash!==requestHash)return {status:409,body:{error:"Chave de idempotência usada para outro pedido"}};
  const created=results[1]?.meta?.changes===1;
  return {status:created?201:200,body:{id:saved.order_id,status:saved.status,
    paymentStatus:saved.payment_status,total:saved.total_cents,currency:"BRL",
    persisted:true,replayed:!created}};
}
// Integration gate: no built-in authentication! Only an auth module that verifies a
// signed, scoped session may supply authorizeSession. Never pass client headers directly.
export function createOrderApi({db,authorizeSession,enabled=false}={}){
  return async function handle(request){
    const path=new URL(request.url).pathname,method=request.method;
    if(!["/v1/quotes","/v1/orders"].includes(path)&&!/^\/v1\/orders\/ord_[a-f0-9]{40}$/.test(path))return null;
    if(!enabled||!db||typeof authorizeSession!=="function")
      return failure(503,"Pedidos persistentes ainda não estão ativados");
    const isGetOrder=/^\/v1\/orders\/ord_[a-f0-9]{40}$/.test(path);
    if((path==="/v1/quotes"||path==="/v1/orders")&&method!=="POST")
      return failure(405,"Método não permitido");
    if(isGetOrder&&method!=="GET")return failure(405,"Método não permitido");
    try{
      const ctx=trustedContext(await authorizeSession(request));
      if(isGetOrder){
        await verifyTable(db,ctx);
        const row=await db.prepare("SELECT id,status,payment_status,total_cents FROM orders "+
          "WHERE id=? AND tenant_id=? AND location_id=? AND table_id=? AND actor_session_hash=?")
          .bind(path.split("/").at(-1),ctx.tenantId,ctx.locationId,ctx.tableId,ctx.sessionHash).first();
        return row?json(200,{id:row.id,status:row.status,paymentStatus:row.payment_status,
          total:row.total_cents,currency:"BRL"}):failure(404,"Pedido não encontrado");
      }
      const input=await boundedBody(request);
      const key=request.headers.get("idempotency-key");
      if(path==="/v1/orders"){
        if(!key||!KEY.test(key))return failure(400,"Idempotency-Key inválida (8–128 caracteres)");
        await verifyTable(db,ctx);
        const old=await repeatOrder(db,ctx,input,key);
        if(old)return json(old.status,old.body);
      }
      const {quote,catalog}=await priceQuote(db,ctx,input);
      if(path==="/v1/quotes")return json(200,{total:quote.total,currency:"BRL",lines:quote.lines,
        paymentStatus:"not_required",quoteOnly:true});
      const res=await submit(db,ctx,quote,catalog,key);
      return json(res.status,res.body);
    }catch(err){
      if(err?.httpStatus)return failure(err.httpStatus,err.message);
      if(/Pedido|Produto|Adicionais|Total|Tenant|mesa|itens|quantidade|preço|inválidos|indisponível/i.test(err?.message||""))
        return failure(422,"Pedido ou preço indisponível; confira o cardápio");
      return failure(503,"Serviço de pedidos temporariamente indisponível");
    }
  };
}
