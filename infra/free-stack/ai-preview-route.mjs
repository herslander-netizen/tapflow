// TapFlow AI — uso administrativo, NÃO é uma API pública para clientes.
// Funciona somente com credenciais server-side e Free Tier explicitamente confirmado.
const PATH="/api/admin/ai/description";
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
async function isAdmin(value,secret){
 if(typeof secret!=="string"||secret.length<32||!value?.startsWith("Bearer "))return false;
 const token=value.slice(7);if(token.length<32||token.length>256)return false;
 const t=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",t.encode(token)),crypto.subtle.digest("SHA-256",t.encode(secret))]);
 let diff=0;const x=new Uint8Array(a),y=new Uint8Array(b);
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 return diff===0;
}
function clean(v,n){return String(v||"").trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,n);}
async function readBounded(request){
 if(Number(request.headers.get("content-length")||0)>1600)throw Error("payload");
 const reader=request.body?.getReader();if(!reader)return "";
 const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1600){await reader.cancel();throw Error("payload");}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
export async function handleTapflowAI(request,env,{fetcher=fetch}={}){
 if(new URL(request.url).pathname!==PATH)return null;
 if(request.method!=="POST")return response(405,{error:"Método não permitido"});
 if(!await isAdmin(request.headers.get("authorization"),env?.TAPFLOW_ADMIN_TOKEN))return response(401,{error:"Não autorizado"});
 if(env?.GEMINI_FREE_TIER_CONFIRMED!=="true"||env?.GEMINI_ENABLED!=="true"||!env?.GEMINI_API_KEY)return response(503,{error:"IA não ativada"});
 if(!env.DB?.prepare)return response(503,{error:"Controle de cota indisponível"});
 if(!request.headers.get("content-type")?.startsWith("application/json"))return response(415,{error:"Envie JSON"});
 let payload;try{payload=JSON.parse(await readBounded(request));}catch{return response(400,{error:"JSON inválido ou extenso"});}
 const name=clean(payload?.name,80),category=clean(payload?.category,60),ingredients=clean(payload?.ingredients,400);
 if(name.length<2||ingredients.length<3)return response(422,{error:"Informe nome e ingredientes"});
 const model=env.GEMINI_MODEL||"gemini-3.5-flash-lite";
 if(!/^gemini-[a-z0-9.-]{3,48}$/.test(model))return response(503,{error:"Modelo inválido"});
 try{
  const counter=await env.DB.prepare("INSERT INTO ai_daily_usage(day_utc,request_count) VALUES (?,1) ON CONFLICT(day_utc) DO UPDATE SET request_count=request_count+1 WHERE request_count<5 RETURNING request_count").bind(new Date().toISOString().slice(0,10)).first();
  if(!counter)return response(429,{error:"Limite de 5 tentativas diárias atingido"});
 }catch{return response(503,{error:"Cota não disponível"});}
 const prompt="Crie uma descrição curta em português brasileiro com até 180 caracteres. Use só o que foi fornecido; não invente ingredientes, preços, alergênicos ou benefícios. Nome: "+name+". Categoria: "+category+". Ingredientes: "+ingredients;
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),8000);
 try{
  const r=await fetcher("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
   method:"POST",headers:{"x-goog-api-key":env.GEMINI_API_KEY,"content-type":"application/json"},
   body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.3,maxOutputTokens:120}}),signal:abort.signal
  });
  if(!r.ok)return response(r.status===429?429:502,{error:"Modelo indisponível"});
  const data=await r.json();
  const description=clean(data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join(" ")||"",180);
  if(!description)return response(502,{error:"Sem resposta válida"});
  return response(200,{description,model,reviewRequired:true,published:false});
 }catch{return response(502,{error:"Falha ao consultar IA"});}
 finally{clearTimeout(timeout);}
}
