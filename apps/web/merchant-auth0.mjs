// The vendor SDK handles the hosted transaction/state/nonce/PKCE. Do not cache bearer tokens.
export async function startMerchantLogin({
  origin, url, fetchConfig, scrubUrl, loadSdk, ui
}){
  const callback = new URL(url);
  const returning = callback.searchParams.has("code") || callback.searchParams.has("error");
  if(returning) scrubUrl();
  let config;
  try{config=await fetchConfig();}catch{
    ui.feedback("Não foi possível consultar a configuração do login. Recarregue e tente de novo.");
    return {};
  }
  if(!config)return {};
  let issuer;
  try{issuer=new URL(config.issuer);}catch{return {};}
  if(issuer.protocol!=="https:"||issuer.pathname!=="/"||issuer.username||issuer.password||issuer.search||issuer.hash||
    typeof config.clientId!=="string"||typeof config.audience!=="string")return {};
  const returnTo=origin+"/merchant.html";
  try{
    const {Auth0Client}=await loadSdk();
    const client=new Auth0Client({
      domain:issuer.host,issuer:issuer.href,clientId:config.clientId,
      authorizationParams:{audience:config.audience,scope:"openid",redirect_uri:returnTo},
      cacheLocation:"memory",useRefreshTokens:false
    });
    const login=async()=>{
      try{await client.loginWithRedirect({openUrl:target=>{
        const u=new URL(target);
        if(u.origin!==issuer.origin||u.pathname!=="/authorize")throw Error("Origem de login inválida");
        ui.navigate(u.href);
      }});}catch{ui.feedback("Não foi possível abrir o login. Tente de novo.");}
    };
    const logout=async()=>{
      ui.signedIn(false);
      try{await client.logout({logoutParams:{returnTo},openUrl:target=>{
        const u=new URL(target);
        if(u.origin!==issuer.origin||!["/v2/logout","/oidc/logout"].includes(u.pathname))throw Error("Origem de saída inválida");
        ui.navigate(u.href);
      }});}catch{ui.feedback("Sua sessão local foi encerrada. Feche esta aba se estiver em um computador compartilhado.");}
    };
    ui.connect({login,logout});
    ui.signedIn(false);
    if(!returning){ui.feedback("Entre para gerenciar o cardápio do seu estabelecimento.");return {managed:true};}
    await client.handleRedirectCallback(callback.href);
    const getAccessToken=async()=>{
      let token;
      try{token=await client.getTokenSilently({cacheMode:"cache-only"});}catch{}
      if(!token){
        ui.signedIn(false);
        ui.feedback("Sua sessão expirou. Entre de novo para continuar.");
        return null;
      }
      return token;
    };
    if(!await getAccessToken()) return {managed:true};
    ui.signedIn(true);
    return {managed:true,getAccessToken};
  }catch{
    ui.feedback("Não foi possível concluir o login. Volte e tente novamente.");
    // An explicitly configured hosted provider never falls back to manual credentials.
    return {managed:true};
  }
}

export async function loadMerchantSession(){
  return startMerchantLogin({
    origin:location.origin,url:location.href,
    fetchConfig:async()=>{
      const r=await fetch("/api/merchant/login-config",{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(6000)});
      if(r.status===404)return null;
      if(!r.ok)throw Error("Login indisponível");
      return r.json();
    },
    scrubUrl:()=>history.replaceState(null,"",location.pathname),
    loadSdk:()=>import("/vendor/auth0-spa.production.mjs"),
    ui:{
      navigate:url=>location.assign(url),
      feedback:message=>{
        document.getElementById("merchant-login").hidden=false;
        document.getElementById("merchant-login-feedback").textContent=message;
      },
      connect:({login,logout})=>{
        document.getElementById("merchant-login").hidden=false;
        document.getElementById("merchant-signin").addEventListener("click",login);
        document.getElementById("merchant-signout").addEventListener("click",logout);
      },
      signedIn:yes=>{
        document.getElementById("merchant-signin").hidden=yes;
        document.getElementById("merchant-signout").hidden=!yes;
        if(!yes)document.getElementById("panel").hidden=true;
      }
    }
  });
}
