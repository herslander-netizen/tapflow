// TapFlow integrated preview — closed-by-default API. Not yet deployed.
import {createMerchantAdmin} from "./merchant-admin.mjs";
import {createMerchantAppearanceHandler} from "./merchant-appearance.mjs";
import {createMerchantPreviewConfig} from "./merchant-preview-config.mjs";
import {handlePublicMenu,validMenuPath} from "./public-menu.mjs";
import {createOrderApi} from "./order-service.mjs";
import {handleTapflowAI} from "../../infra/free-stack/ai-preview-route.mjs";

const json=(status,value)=>new Response(JSON.stringify(value),{status,
  headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const merchantPath=/^\/api\/merchant\/([A-Za-z0-9_-]{1,64})\/appearance(?:\/(publish))?$/;
const menuPath=/^\/cardapio\/([^/]{1,64})\/([^/]{1,64})\/?$/;
const menuApiPath=/^\/api\/public\/menu\/([^/]{1,64})\/([^/]{1,64})$/;
const noStore={"cache-control":"no-store","x-content-type-options":"nosniff"};
async function serveAsset(env,url,path,method,{storefront=false}={}){
  if(typeof env.ASSETS?.fetch!=="function")return json(503,{error:"Página temporariamente indisponível"});
  const asset=new URL(path,url);
  const response=await env.ASSETS.fetch(new Request(asset,{method}));
  const headers=new Headers(response.headers);
  headers.set("x-robots-tag","noindex");
  headers.set("cache-control","no-store");
  headers.set("referrer-policy",storefront?"no-referrer":"same-origin");
  headers.set("content-security-policy","default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action "+(storefront?"'none'":"'self'")+"; style-src 'self' 'unsafe-inline'");
  return new Response(response.body,{status:response.status,headers});
}
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
   const enabledMenu=env.TAPFLOW_STOREFRONT_PREVIEW==="true"&&url.origin===env.TAPFLOW_MERCHANT_ORIGIN;
   if(url.pathname.startsWith("/api/public/menu/")){
     const m=menuApiPath.exec(url.pathname);
     return handlePublicMenu(request,{enabled:enabledMenu,db:env.DB,slug:m?.[1],locationId:m?.[2]});
   }
   if(url.pathname.startsWith("/cardapio/")){
     const m=menuPath.exec(url.pathname);
     if(!enabledMenu||!m||!validMenuPath(m[1],m[2]))return json(404,{error:"Cardápio não publicado"});
     if(!["GET","HEAD"].includes(request.method))return json(405,{error:"Método não permitido"});
     return serveAsset(env,url,"/public-menu.html",request.method,{storefront:true});
   }
   if(url.pathname==="/merchant.html"){
     if(!createMerchantPreviewConfig(request,env))return json(404,{error:"Não disponível"});
     if(!["GET","HEAD"].includes(request.method))return json(405,{error:"Método não permitido"});
     return serveAsset(env,url,"/merchant.html",request.method);
   }
   const appearance=merchantPath.exec(url.pathname);
   if(appearance||url.pathname.startsWith("/v1/merchant/")){
     const config=createMerchantPreviewConfig(request,env);
     if(!config)return json(404,{error:"Não disponível"});
     if(appearance){
       if(!["GET","POST"].includes(request.method))return json(405,{error:"Método não permitido"});
       if(request.method==="POST"&&request.headers.get("origin")!==config.origin)return json(403,{error:"Origem não autorizada"});
       const action=appearance[2]?"publish":request.method==="GET"?"read":"save";
       return createMerchantAppearanceHandler(config)(request,appearance[1],action);
     }
     return await createMerchantAdmin(config)(request)??json(404,{error:"Não disponível"});
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
