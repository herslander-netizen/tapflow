import test from "node:test";
import assert from "node:assert/strict";
import {suggestProductDescriptionGroq} from "../../infra/free-stack/groq.mjs";
const product={name:"Burger especial",category:"Hambúrguer",ingredients:"pão, carne, queijo"};
const env={GROQ_ENABLED:"true",GROQ_FREE_TIER_CONFIRMED:"true",GROQ_API_KEY:"test-only-groq-secret-long-0123456789",GROQ_MODEL:"llama-3.3-70b-versatile"};
test("Groq não dispara sem habilitação explícita",async()=>{
 await assert.rejects(()=>suggestProductDescriptionGroq(product,{env:{}}),/desativado/);
 await assert.rejects(()=>suggestProductDescriptionGroq(product,{env:{GROQ_ENABLED:"true"}}),/desativado/);
});
test("Groq exige chave e modelo, sem enviar chave no prompt ou URL",async()=>{
 const seen={};
 const fetcher=async(url,opts)=>{seen.url=url;seen.body=opts.body;seen.authorization=opts.headers.authorization;
   return {ok:true,json:async()=>({choices:[{message:{content:"Burger com pão, carne e queijo."}}]})};};
 const v=await suggestProductDescriptionGroq(product,{env,fetcher});
 assert.equal(v.published,false);assert.equal(v.reviewRequired,true);assert.equal(v.source,"groq");
 assert.ok(seen.authorization.includes(env.GROQ_API_KEY));
 assert.ok(!seen.url.includes(env.GROQ_API_KEY) && !seen.body.includes(env.GROQ_API_KEY));
});
test("Groq erro remoto não vaza credencial",async()=>{
 await assert.rejects(()=>suggestProductDescriptionGroq(product,{env,fetcher:async()=>({ok:false,status:429})}),/indisponível \(429\)/);
});
test("Groq não aceita modelo inválido",async()=>{
 await assert.rejects(()=>suggestProductDescriptionGroq(product,{env:{...env,GROQ_MODEL:"../../?secret"}}),/Configure um modelo/);
});
