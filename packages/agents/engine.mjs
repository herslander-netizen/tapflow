import {AGENTS} from "./registry.mjs";
import {draftOrderNotification} from "../../infra/free-stack/evolution-alvo.mjs";
const TENANT=/^[A-Za-z0-9_-]{1,64}$/;
const sanitize=(v,n)=>String(v??"").replace(/[<>\u0000-\u001F]/g,"").trim().slice(0,n);
const asDraft=(agentId,output,extra={})=>({agentId,status:"draft",output,reviewRequired:true,published:false,sendApproved:false,sideEffects:[],...extra});
export function prepareAgentDraft({agentId,principal,context,input}={}){
 if(!principal||!context||!TENANT.test(principal.tenantId||"")||principal.tenantId!==context.tenantId)
  throw new Error("Autenticação e estabelecimento válidos são obrigatórios");
 const agent=Object.hasOwn(AGENTS,agentId)?AGENTS[agentId]:null;
 if(!agent||!agent.roles.includes(principal.role))throw new Error("Agente ou permissão inválidos");
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Entrada inválida");
 if(agentId==="catalogo"){
  const name=sanitize(input.name,80),ingredients=sanitize(input.ingredients,300);
  if(name.length<2||ingredients.length<3)throw new Error("Dados do prato insuficientes");
  return asDraft(agentId,name+": "+ingredients+".",{source:"provided-input-only",needsAIReview:true});
 }
 if(agentId==="atendimento"){
  const faqId=sanitize(input.faqId,64);
  const approved=Array.isArray(context.approvedFaqs)?context.approvedFaqs:[];
  const match=approved.find(f=>f.id===faqId&&f.approved===true&&typeof f.answer==="string");
  return asDraft(agentId,match?sanitize(match.answer,700):"Não tenho essa informação confirmada. Vou encaminhar ao estabelecimento.",{requiresHuman:!match,source:"approved-faq"});
 }
 if(agentId==="conteudo"){
  const name=sanitize(input.name,80),ingredients=sanitize(input.ingredients,300);
  if(name.length<2||ingredients.length<3)throw new Error("Dados do prato insuficientes");
  return asDraft(agentId,"Cena 1: apresentar "+name+". Cena 2: destacar "+ingredients+". Cena 3: convite para conhecer o cardápio. Revisar mídia e direitos de uso.",{format:"reels-brief",videoGenerated:false});
 }
 if(agentId==="gestao"){
  const metrics=context.approvedAggregateMetrics;
  if(!metrics||!["views","cartAdds","orders"].every(k=>Number.isSafeInteger(metrics[k])&&metrics[k]>=0))throw new Error("Métricas agregadas inválidas");
  if(metrics.orders>metrics.cartAdds||metrics.cartAdds>metrics.views)throw new Error("Métricas inconsistentes");
  return asDraft(agentId,"Visualizações: "+metrics.views+"; carrinhos: "+metrics.cartAdds+"; pedidos: "+metrics.orders+".",{source:"approved-aggregate"});
 }
 if(agentId==="notificacoes"){
  if(context.orderEventVerified!==true)throw new Error("Evento de pedido não confirmado");
  const draft=draftOrderNotification({orderCode:input.orderCode,status:input.status,restaurantName:context.restaurantName});
  return asDraft(agentId,draft.text,{channel:"evolution-alvo",source:"verified-order-status"});
 }
 throw new Error("Agente desconhecido");
}
