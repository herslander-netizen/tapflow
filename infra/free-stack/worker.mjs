// Cloudflare Worker preparatório. NÃO foi implantado e não acessa banco ou clientes.
const JSON_HEADERS=Object.freeze({"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY"});
export default {
  async fetch(request){
    const url=new URL(request.url);
    if(request.method!=="GET")return new Response(JSON.stringify({error:"Método não permitido"}),{status:405,headers:{...JSON_HEADERS,allow:"GET"}});
    if(url.pathname==="/api/health")return new Response(JSON.stringify({product:"TapFlow",environment:"unconfigured-preview",status:"prototype-only",payments:false,persistentOrders:false}),{headers:JSON_HEADERS});
    return new Response(JSON.stringify({error:"Nenhuma API de pedidos foi ativada"}),{status:404,headers:JSON_HEADERS});
  }
};
