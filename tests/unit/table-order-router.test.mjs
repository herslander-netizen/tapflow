import test from "node:test";
import assert from "node:assert/strict";
import {createTableOrderRouter} from "../../apps/api/table-order-router.mjs";

const origin="https://pilot.example.invalid";
const admission="/v1/table-admissions";
const session="/v1/order-sessions";
const tracking="/v1/order-tracking/ord_"+"a".repeat(40);
function req(path,{method="POST",from=origin,body,headers,host=origin}={}){
  return new Request(host+path,{method,headers:{
    ...(from!==null?{origin:from}:{}),"content-type":"application/json",...headers},
    ...(body===undefined?{}:{body,...(body instanceof ReadableStream?{duplex:"half"}:{})})});
}

function context(overrides={}){
  const actions=[];
  const config={enabled:true,origin,
    db:{prepare(){ actions.push("db"); throw new Error("never reveal provider credentials"); }},
    resolveIngress:async(request)=>{
      actions.push("resolve");
      return {source:"fixture-verified",address:"127.0.0.1"};
    },
    attemptGuard:{
      ingress:async(action,ingress)=>{ actions.push(action+"@"+ingress.source); return {ok:true}; },
      staffIssue:async(staff)=>{actions.push("staff:"+staff.staffId); return {ok:true}; }
    },
    authorizeStaff:async()=>{actions.push("verify");return null;},
    ...overrides
  };
  return {actions,route:createTableOrderRouter(config)};
}

test("rotas de mesa fecham por padrão e exigem infraestrutura explícita",async()=>{
  const dependencies=["enabled","authorizeStaff","resolveIngress","attemptGuard","origin","db"];
  for(const dependency of dependencies){
    const {route,actions}=context({[dependency]:undefined});
    for(const path of [admission,session,tracking,"/v1/quotes","/v1/orders"]){
      const res=await route(req(path));
      assert.equal(res.status,503,dependency);
      assert.equal(res.headers.get("cache-control"),"no-store");
    }
    assert.deepEqual(actions,[]);
    assert.equal(await route(req("/outra-rota")),null);
  }
});

test("HTTPS de origem fixo, sem query, CORS ou método alternativo",async()=>{
  const {route,actions}=context();
  for(const request of [
    req(admission,{from:"https://x.example.invalid"}),
    req(admission,{from:null}),
    req(admission,{from:"null"}),
    req(admission,{host:"https://x.example.invalid"}),
    req(tracking,{method:"GET",from:"https://x.example.invalid"})
  ]) assert.equal((await route(request)).status,403);
  assert.equal((await route(req(admission+"?code=forbidden"))).status,400);
  const option=await route(req(admission,{method:"OPTIONS"}));
  assert.equal(option.status,405);
  assert.equal(option.headers.get("allow"),"POST");
  assert.equal(option.headers.get("access-control-allow-origin"),null);
  assert.deepEqual(actions,[]);
});

test("freio de borda roda antes do corpo e login; falhas fecham sem atingir banco",async()=>{
  for(const outcome of [{ok:false,status:429},{ok:false,status:503},{success:true}]){
    let resolved=false;
    const {route,actions}=context({attemptGuard:{
      ingress:async(action,ingress)=>{resolved=action==="issue"&&ingress.address==="127.0.0.1";return outcome;},
      staffIssue:async()=>{throw Error("unexpected");}
    }});
    const request=req(admission,{body:'{"tableId":"ma"}'});
    assert.equal((await route(request)).status,outcome.status??503);
    assert.equal(request.bodyUsed,false);
    assert.equal(resolved,true);
    assert.deepEqual(actions,["resolve"]);
  }
});

test("emissão valida um seletor limitado, ignora cabeçalhos de papel e não loga dados",async()=>{
  const {route,actions}=context();
  for(const body of ['{"tableId":"ma","tenantId":"x"}','[1]','{"tableId":"?"}','{']){
    assert.equal((await route(req(admission,{body}))).status,400);
  }
  const oversized=new ReadableStream({start(controller){
    controller.enqueue(new Uint8Array(257));controller.close();
  }});
  assert.equal((await route(req(admission,{body:oversized}))).status,413);
  assert.equal((await route(req(admission,{body:'{}',headers:{"content-type":"text/plain"}}))).status,415);
  assert.equal(actions.includes("verify"),false);
  assert.equal((await route(req(admission,{body:'{"tableId":"ma"}',headers:{"x-staff-role":"owner"}}))).status,403);
  assert.equal(actions.at(-1),"verify");
  assert.equal(actions.includes("db"),false);
});

test("falha no banco não vaza detalhes do servidor",async()=>{
  const {route,actions}=context();
  const res=await route(req(session,{body:JSON.stringify({code:"a".repeat(43)})}));
  assert.equal(res.status,503);
  assert.equal((await res.text()).includes("provider credentials"),false);
  assert.deepEqual(actions,["resolve","redeem@fixture-verified","db"]);
});
