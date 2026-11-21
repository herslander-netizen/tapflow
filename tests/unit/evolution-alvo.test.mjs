import test from "node:test";
import assert from "node:assert/strict";
import {evolutionConnection,sendApprovedEvolutionText,draftOrderNotification} from "../../infra/free-stack/evolution-alvo.mjs";
const token="fake-test-only-evolution-project-token-0123456789";
const base={EVOLUTION_ENABLED:"true",EVOLUTION_SEND_ENABLED:"true",EVOLUTION_PROJECT_SLUG:"tapflow",EVOLUTION_ALVO_BASE_URL:"https://evolution.example/",EVOLUTION_PROJECT_TOKEN:token};
const good={tenantId:"restaurant_a",principal:{tenantId:"restaurant_a",role:"manager"},humanApproved:true,optInVerified:true,sourceEventVerified:true,number:"5579999999999",text:"Seu pedido está pronto",eventId:"order_event_00001"};
test("consulta de conexão exige projeto tapflow e retorna estado do gateway",async()=>{
 const fetcher=async(url,options)=>{
  assert.equal(url,"https://evolution.example/v1/connection");
  assert.equal(options.headers.authorization,"Bearer "+token);
  return {ok:true,json:async()=>({project:"tapflow",state:"connected"})};
 };
 assert.equal((await evolutionConnection({env:base,fetcher})).state,"connected");
 await assert.rejects(()=>evolutionConnection({env:{...base,EVOLUTION_PROJECT_SLUG:"flow"},fetcher}),/não configurada/);
});
test("nunca confunde token de outro projeto com tapflow",async()=>{
 await assert.rejects(()=>evolutionConnection({env:base,fetcher:async()=>({ok:true,json:async()=>({project:"flow",state:"connected"})})}),/outro projeto/);
});
test("envio desativado nunca executa chamada de rede",async()=>{
 let calls=0;
 await assert.rejects(()=>sendApprovedEvolutionText(good,{env:{...base,EVOLUTION_SEND_ENABLED:"false"},fetcher:async()=>{calls++;throw Error("Não esperado")}}),/desativado/);
 assert.equal(calls,0);
});
test("consentimento, aprovação e evento real são obrigatórios",async()=>{
 for(const field of ["optInVerified","humanApproved","sourceEventVerified"]){
   await assert.rejects(()=>sendApprovedEvolutionText({...good,[field]:false},{env:base}),/necessária/);
 }
});
test("isola tenant e usuário",async()=>{
 await assert.rejects(()=>sendApprovedEvolutionText({...good,tenantId:"restaurant_b"},{env:base}),/não autorizado/);
 await assert.rejects(()=>sendApprovedEvolutionText({...good,principal:{tenantId:"restaurant_a",role:"customer"}},{env:base}),/sem permissão/);
});
test("usa mesma chave de idempotência para duplicatas, sem enviar token no corpo",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({status:"accepted"})};};
 const first=await sendApprovedEvolutionText(good,{env:base,fetcher});
 const second=await sendApprovedEvolutionText(good,{env:base,fetcher});
 assert.equal(first.status,"accepted");assert.equal(first.deliveryConfirmed,false);
 assert.equal(first.request,second.request);
 assert.match(first.request,/^tf_[a-f0-9]{48}$/);
 assert.equal(calls[0].options.headers.authorization,"Bearer "+token);
 assert.ok(!calls[0].options.body.includes(token));
 assert.equal(JSON.parse(calls[0].options.body).number,good.number);
});
test("tenant diferente usa chave diferente no mesmo evento",async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({status:"accepted"})});
 const a=await sendApprovedEvolutionText(good,{env:base,fetcher});
 const b=await sendApprovedEvolutionText({...good,tenantId:"restaurant_b",principal:{tenantId:"restaurant_b",role:"owner"}},{env:base,fetcher});
 assert.notEqual(a.request,b.request);
});
test("status desconhecido não vira mensagem entregue",async()=>{
 const result=await sendApprovedEvolutionText(good,{env:base,fetcher:async()=>({ok:false,status:502})});
 assert.equal(result.status,"unknown");assert.equal(result.deliveryConfirmed,false);
});
test("não admite grupo, número local, mensagem vazia ou ID curto",async()=>{
 for(const change of [{number:"55119999@g.us"},{number:"7999999999"},{text:" "},{eventId:"1"}]){
  await assert.rejects(()=>sendApprovedEvolutionText({...good,...change},{env:base}));
 }
});
test("notificações são apenas rascunhos e só refletem status confirmado",()=>{
 const result=draftOrderNotification({orderCode:"ABC123",status:"ready",restaurantName:"Restaurante Demo"});
 assert.equal(result.sendApproved,false);assert.match(result.text,/pronto para retirada/);
 assert.throws(()=>draftOrderNotification({orderCode:"ABC123",status:"paid",restaurantName:"Demo"}));
});
