// Evolution Alvo — integração isolada do TapFlow. Nenhum envio automático.
const apiPaths=Object.freeze({connection:"/v1/connection",text:"/v1/messages/text"});
const PHONE=/^55[1-9][0-9]{9,10}$/;
const ID=/^[A-Za-z0-9_.:-]{8,128}$/;
const TENANT=/^[a-zA-Z0-9_-]{1,64}$/;
function configuration(env,forSending=false){
  if(env?.EVOLUTION_ENABLED!=="true" || env?.EVOLUTION_PROJECT_SLUG!=="tapflow" || !env?.EVOLUTION_PROJECT_TOKEN)
    throw new Error("Evolution Alvo TapFlow não configurada");
  if(forSending && env.EVOLUTION_SEND_ENABLED!=="true")
    throw new Error("Envio Evolution desativado");
  const raw=env.EVOLUTION_ALVO_BASE_URL;
  if(typeof raw!=="string")throw new Error("URL do gateway não configurada");
  let url;
  try{url=new URL(raw)}catch{throw new Error("URL do gateway inválida")}
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")
    throw new Error("Gateway precisa de HTTPS e origem simples");
  if(!/^[a-z0-9.-]+$/i.test(url.hostname)||url.hostname==="localhost"||/^[0-9.]+$/.test(url.hostname))
    throw new Error("Origem Evolution não permitida");
  return {base:url.origin,token:env.EVOLUTION_PROJECT_TOKEN};
}
function requireAuthorizedSend(input){
  if(!input||typeof input!=="object")throw new Error("Mensagem inválida");
  if(!TENANT.test(input.tenantId||"") || !input.principal || input.principal.tenantId!==input.tenantId)
    throw new Error("Estabelecimento não autorizado");
  if(!["owner","manager","staff"].includes(input.principal.role))
    throw new Error("Usuário sem permissão");
  if(input.humanApproved!==true||input.optInVerified!==true||input.sourceEventVerified!==true)
    throw new Error("É necessária confirmação humana, consentimento e evento verificado");
  if(typeof input.number!=="string"||!PHONE.test(input.number))throw new Error("Telefone internacional inválido");
  if(typeof input.text!=="string"||!input.text.trim()||input.text.length>1000)
    throw new Error("Texto inválido");
  if(typeof input.eventId!=="string"||!ID.test(input.eventId))throw new Error("ID de evento inválido");
  return {tenantId:input.tenantId,eventId:input.eventId,number:input.number,text:input.text.trim()};
}
async function stableRequestKey(tenantId,eventId){
  const bytes=new TextEncoder().encode("tapflow\n"+tenantId+"\n"+eventId);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return "tf_"+[...digest.slice(0,24)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function evolutionConnection({env,fetcher=fetch}={}){
  const {base,token}=configuration(env);
  const r=await fetcher(base+apiPaths.connection,{method:"GET",headers:{"authorization":"Bearer "+token},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("Conexão Evolution indisponível ("+r.status+")");
  const data=await r.json();
  if(data?.project!=="tapflow")throw new Error("Gateway respondeu para outro projeto");
  return {project:"tapflow",state:data?.state??"unknown"};
}
export async function sendApprovedEvolutionText(input,{env,fetcher=fetch}={}){
  const msg=requireAuthorizedSend(input);
  const {base,token}=configuration(env,true);
  const key=await stableRequestKey(msg.tenantId,msg.eventId);
  const r=await fetcher(base+apiPaths.text,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+token,"Idempotency-Key":key},
    body:JSON.stringify({number:msg.number,text:msg.text}),
    signal:AbortSignal.timeout(16000)
  });
  // A resposta 202 confirma aceitação pela Evolution, não entrega no WhatsApp.
  // Em timeout/502/unknown, não gerar chave nova no retry.
  if(!r.ok){
    if(r.status===409)throw new Error("Conflito de idempotência na Evolution");
    if(r.status===401||r.status===403)throw new Error("Token Evolution TapFlow recusado");
    return {status:"unknown",request:key,deliveryConfirmed:false};
  }
  const result=await r.json();
  if(!["accepted","unknown"].includes(result?.status))
    return {status:"unknown",request:key,deliveryConfirmed:false};
  return {status:result.status,request:key,deliveryConfirmed:false};
}
export function draftOrderNotification({orderCode,status,restaurantName}){
  if(typeof orderCode!=="string"||!/^[A-Za-z0-9_-]{3,24}$/.test(orderCode))
    throw new Error("Código do pedido inválido");
  if(!["accepted","preparing","ready"].includes(status))throw new Error("Status não confirmado");
  const name=typeof restaurantName==="string"?restaurantName.trim().replace(/[<>\x00-\x1f]/g,"").slice(0,60):"";
  if(!name)throw new Error("Estabelecimento inválido");
  const labels={accepted:"recebido e aceito",preparing:"em preparo",ready:"pronto para retirada"};
  return {text:name+" — seu pedido "+orderCode+" está "+labels[status]+".",reviewRequired:true,sendApproved:false};
}
