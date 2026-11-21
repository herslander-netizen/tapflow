import test from "node:test";
import assert from "node:assert/strict";
import {handleTapflowAI} from "../../infra/free-stack/ai-preview-route.mjs";
const url="https://tapflow.example/api/admin/ai/description";
const secret="test-admin-token-with-more-than-32-characters";
const env={TAPFLOW_ADMIN_TOKEN:secret,GEMINI_API_KEY:"fake-test-only-key-longer-than-20",GEMINI_FREE_TIER_CONFIRMED:"true",GEMINI_ENABLED:"true"};
const req=(authorization,body={name:"Burger",ingredients:"pão, carne e queijo"})=>new Request(url,{method:"POST",headers:{"content-type":"application/json","authorization":authorization},body:JSON.stringify(body)});
const db={prepare(){return{bind(){return{first:async()=>({request_count:1})}}}}};
test("ignora outras rotas",async()=>assert.equal(await handleTapflowAI(new Request("https://tapflow.example"),env),null));
test("bloqueia sem credencial de administrador",async()=>assert.equal((await handleTapflowAI(req("Bearer errada"),{...env,DB:db})).status,401));
test("exige Free Tier confirmado",async()=>assert.equal((await handleTapflowAI(req("Bearer "+secret),{...env,GEMINI_FREE_TIER_CONFIRMED:"false",DB:db})).status,503));
test("exige D1 com limite configurado",async()=>assert.equal((await handleTapflowAI(req("Bearer "+secret),env)).status,503));
test("quota diária impede chamadas",async()=>{
 const exhausted={prepare(){return{bind(){return{first:async()=>null}}}}};
 assert.equal((await handleTapflowAI(req("Bearer "+secret),{...env,DB:exhausted})).status,429);
});
test("gera descrição sem expor chave ou alterar acentos",async()=>{
 let call;
 const fetcher=async(url,options)=>{call={url,options};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:"Pão, carne e queijo."}]}}]})};};
 const r=await handleTapflowAI(req("Bearer "+secret),{...env,DB:db},{fetcher});
 const answer=await r.json();
 assert.equal(r.status,200);assert.equal(answer.description,"Pão, carne e queijo.");
 assert.equal(answer.published,false);assert.equal(answer.reviewRequired,true);
 assert.equal(call.options.headers["x-goog-api-key"],env.GEMINI_API_KEY);
 assert.ok(!call.url.includes(env.GEMINI_API_KEY)&&!call.options.body.includes(env.GEMINI_API_KEY)&&!JSON.stringify(answer).includes(env.GEMINI_API_KEY));
});
test("rejeita payload gigante sem gastar tokens",async()=>{
 const r=await handleTapflowAI(req("Bearer "+secret,{name:"Burger",ingredients:"x".repeat(4000)}),{...env,DB:db});
 assert.equal(r.status,400);
});
