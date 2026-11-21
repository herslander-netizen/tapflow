import test from "node:test";
import assert from "node:assert/strict";
import {suggestProductDescription,normalizeProductDraft} from "../../infra/free-stack/gemini.mjs";
const dish={name:"Burger especial",category:"Hambúrguer",ingredients:"pão, carne, queijo"};
const safe={GEMINI_ENABLED:"true",GEMINI_FREE_TIER_CONFIRMED:"true",GEMINI_API_KEY:"fake-test-only-secret-0123456789"};
test("bloqueia a integração sem ativação explícita e confirmação de Free Tier",async()=>{
  await assert.rejects(()=>suggestProductDescription(dish,{env:{}}),/desativada/);
  await assert.rejects(()=>suggestProductDescription(dish,{env:{GEMINI_ENABLED:"true"}}),/desativada/);
});
test("chave nunca vai na URL nem no prompt",async()=>{
  let url,body,header;
  const fetcher=async(u,options)=>{url=u;header=options.headers["x-goog-api-key"];body=options.body;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:"Pão artesanal, carne e queijo."}]}}]})};};
  const result=await suggestProductDescription(dish,{env:safe,fetcher});
  assert.equal(header,safe.GEMINI_API_KEY);
  assert.equal(url.includes(safe.GEMINI_API_KEY),false);
  assert.equal(body.includes(safe.GEMINI_API_KEY),false);
  assert.equal(result.published,false);assert.equal(result.reviewRequired,true);
  assert.equal(result.description,"Pão artesanal, carne e queijo.");
});
test("rejeita descrição de produto incompleta",()=>{
  assert.throws(()=>normalizeProductDraft({name:"A",ingredients:"x"}));
});
test("erro remoto não expõe credencial nem corpo do provedor",async()=>{
  const fetcher=async()=>({ok:false,status:429});
  await assert.rejects(()=>suggestProductDescription(dish,{env:safe,fetcher}),/indisponível \(429\)/);
});
test("rejeita modelo controlado por configuração inválida",async()=>{
  await assert.rejects(()=>suggestProductDescription(dish,{env:{...safe,GEMINI_MODEL:"../../bad"}}),/não permitido/);
});
