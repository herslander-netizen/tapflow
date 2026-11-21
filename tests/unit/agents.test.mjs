import test from "node:test";
import assert from "node:assert/strict";
import {AGENTS,FORBIDDEN,listAgentCapabilities} from "../../packages/agents/registry.mjs";
import {prepareAgentDraft} from "../../packages/agents/engine.mjs";
const principal={tenantId:"restaurant_a",role:"owner"};
const prepare=(agentId,input={},context={})=>prepareAgentDraft({agentId,input,principal,context:{tenantId:"restaurant_a",...context}});
test("cinco módulos sem capacidades destrutivas",()=>{
 assert.equal(Object.keys(AGENTS).length,5);
 for(const a of Object.values(AGENTS))assert.ok(a.capabilities.every(p=>!FORBIDDEN.includes(p)));
 assert.deepEqual(listAgentCapabilities("staff").map(x=>x.id),["atendimento","notificacoes"]);
});
test("identidade e tenant divergentes não podem produzir respostas",()=>{
 assert.throws(()=>prepareAgentDraft({agentId:"atendimento",input:{faqId:"hours"},principal,context:{tenantId:"restaurant_b"}}),/Autenticação/);
});
test("atendimento só usa respostas aprovadas",()=>{
 const unknown=prepare("atendimento",{faqId:"hours"},{});assert.equal(unknown.requiresHuman,true);
 const known=prepare("atendimento",{faqId:"hours"},{approvedFaqs:[{id:"hours",answer:"Aberto até 22h.",approved:true}]});
 assert.equal(known.output,"Aberto até 22h.");assert.equal(known.published,false);
});
test("conteúdo e cardápio criam rascunhos sem IA nem publicação",()=>{
 const a=prepare("catalogo",{name:"Burger",ingredients:"pão e queijo"});
 const b=prepare("conteudo",{name:"Burger",ingredients:"pão e queijo"});
 assert.equal(a.needsAIReview,true);assert.equal(b.videoGenerated,false);
 assert.deepEqual(a.sideEffects,[]);assert.equal(b.published,false);
});
test("notificações usam Evolution só como rascunho, sem envio",()=>{
 const n=prepare("notificacoes",{orderCode:"ABC123",status:"ready"},{orderEventVerified:true,restaurantName:"Demo"});
 assert.equal(n.channel,"evolution-alvo");assert.equal(n.sendApproved,false);assert.match(n.output,/pronto para retirada/);
 assert.throws(()=>prepare("notificacoes",{orderCode:"ABC123",status:"ready"},{restaurantName:"Demo"}),/não confirmado/);
});
test("gestão exige números agregados coerentes",()=>{
 const n=prepare("gestao",{}, {approvedAggregateMetrics:{views:50,cartAdds:10,orders:2}});
 assert.equal(n.published,false);
 assert.throws(()=>prepare("gestao",{}, {approvedAggregateMetrics:{views:1,cartAdds:10,orders:2}}),/inconsistentes/);
});
test("nenhum agente publica ou envia mensagens",()=>{
 for(const id of ["catalogo","atendimento","conteudo","gestao","notificacoes"]){
  const cases={
   catalogo:{input:{name:"Burger",ingredients:"carne e queijo"},context:{}},
   atendimento:{input:{faqId:"none"},context:{}},
   conteudo:{input:{name:"Burger",ingredients:"carne e queijo"},context:{}},
   gestao:{input:{},context:{approvedAggregateMetrics:{views:0,cartAdds:0,orders:0}}},
   notificacoes:{input:{orderCode:"ABC123",status:"ready"},context:{restaurantName:"Demo",orderEventVerified:true}}
  };
  const result=prepare(id,cases[id].input,cases[id].context);
  assert.equal(result.published,false);assert.equal(result.sendApproved,false);
  assert.deepEqual(result.sideEffects,[]);
 }
});
