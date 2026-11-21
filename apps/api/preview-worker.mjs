// TapFlow integrated preview — closed-by-default API. Not yet deployed.
import {createOrderApi} from "./order-service.mjs";
import {handleTapflowAI} from "../../infra/free-stack/ai-preview-route.mjs";

const json=(status,value)=>new Response(JSON.stringify(value),{status,
  headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const noStore={"cache-control":"no-store","x-content-type-options":"nosniff"};
export default {
 async fetch(request,env){
   const url=new URL(request.url);
   if(url.pathname==="/api/health"){
     if(request.method!=="GET")return json(405,{error:"Método não permitido"});
     let connected=false;
     try{
       const row=await env.DB.prepare("SELECT COUNT(*) AS total FROM tenants").first();
       connected=Number.isInteger(row?.total);
     }catch{}
     return json(connected?200:503,{
       product:"TapFlow",environment:"preview",databaseConnected:connected,
       ordersPersistent:false,ordersEnabled:false,paymentsEnabled:false,
       evolutionSendEnabled:false,agentActionsEnabled:false,
       aiAdministrativeOnly:true
     });
   }
   if(url.pathname==="/api/admin/ai/description")
     return handleTapflowAI(request,env);
   if(url.pathname.startsWith("/v1/")){
     // Previne que configuração de ambiente indevida libere pedidos reais.
     // authorizeSession precisa ser implementado e validado antes de alterar este literal.
     const response=await createOrderApi({db:env.DB,enabled:false})(request);
     return response??json(404,{error:"Rota não disponível"});
   }
   if(!["GET","HEAD"].includes(request.method))
     return new Response("Método não permitido",{status:405,headers:{...noStore,allow:"GET, HEAD"}});
   if(typeof env.ASSETS?.fetch!=="function")return json(503,{error:"Static Assets indisponível"});
   return env.ASSETS.fetch(request);
 }
};
