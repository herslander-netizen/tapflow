import test from "node:test";
import assert from "node:assert/strict";
import {startMerchantLogin} from "../../apps/web/merchant-auth0.mjs";
import worker from "../../apps/api/preview-worker.mjs";

const origin="https://tapflow.example.test";
const config={issuer:"https://pilot-id.example.test/",clientId:"staff_client",audience:"https://pilot-api.example.test"};
function fixture(query="",overrides={}){
  const events=[],state={callbackFail:false,token:"synthetic-token",authUrl:config.issuer+"authorize"};
  const ui={feedback:x=>events.push(["message",x]),signedIn:x=>events.push(["signed",x]),
    navigate:x=>events.push(["navigate",x]),connect:x=>{state.buttons=x;}};
  const fake=class {
    constructor(opts){state.opts=opts;}
    async loginWithRedirect({openUrl}){openUrl(state.authUrl);}
    async logout({logoutParams,openUrl}){assert.equal(logoutParams.returnTo,origin+"/merchant.html");openUrl(config.issuer+"v2/logout");}
    async handleRedirectCallback(url){events.push(["callback",url]);if(state.callbackFail)throw Error("fixture");}
    async getTokenSilently(opts){assert.deepEqual(opts,{cacheMode:"cache-only"});return state.token;}
  };
  const deps={origin,url:origin+"/merchant.html"+query,fetchConfig:async()=>{events.push(["config"]);return config;},
    scrubUrl:()=>events.push(["scrub"]),loadSdk:async()=>({Auth0Client:fake}),ui,...overrides};
  return {state,events,deps,go:()=>startMerchantLogin(deps)};
}

test("hosted redirect uses only configured origin, memory only and no refresh tokens",async()=>{
  const {go,state,events}=fixture();
  assert.deepEqual(await go(),{managed:true});
  assert.equal(state.opts.cacheLocation,"memory");
  assert.equal(state.opts.useRefreshTokens,false);
  assert.deepEqual(state.opts.authorizationParams,{audience:config.audience,scope:"openid",redirect_uri:origin+"/merchant.html"});
  await state.buttons.login();
  assert.deepEqual(events.at(-1),["navigate",config.issuer+"authorize"]);
  state.authUrl="https://other.example.test/authorize";
  await state.buttons.login();
  assert.equal(events.filter(x=>x[0]==="navigate").length,1);
  await state.buttons.logout();
  assert.deepEqual(events.at(-1),["navigate",config.issuer+"v2/logout"]);
});
test("callback clears URL before network, does not expose a raw token, expiry signs out locally",async()=>{
  const {go,state,events}=fixture("?code=fixture-code&state=fixture-state");
  const result=await go();
  assert.equal(result.managed,true);
  assert.deepEqual(events.slice(0,2),[["scrub"],["config"]]);
  assert.equal(events.find(x=>x[0]==="callback")[1],origin+"/merchant.html?code=fixture-code&state=fixture-state");
  assert.equal(await result.getAccessToken(),"synthetic-token");
  state.token=null;
  assert.equal(await result.getAccessToken(),null);
  assert.ok(events.some(x=>x[0]==="signed"&&x[1]===false));
});
test("invalid callback does not enter panel; missing config never loads the SDK",async()=>{
  const {state,go}=fixture("?error=access_denied&state=fixture");
  state.callbackFail=true;
  assert.deepEqual(await go(),{managed:true});
  const disabled=fixture("",{fetchConfig:async()=>null,loadSdk:async()=>assert.fail("should not load SDK")});
  assert.deepEqual(await disabled.go(),{});
});
test("auth config publishes only exact pilot public metadata, gated by origin and valid provider config",async()=>{
 const request=(path,host=origin)=>new Request(host+path);
 const env={DB:{},ASSETS:{fetch:async()=>new Response("vitrine")},TAPFLOW_MERCHANT_PREVIEW:"true",
  TAPFLOW_MERCHANT_ORIGIN:origin,TAPFLOW_MERCHANT_ISSUER:config.issuer,TAPFLOW_MERCHANT_AUDIENCE:config.audience,
  TAPFLOW_MERCHANT_IDENTITY_PROVIDER:"auth0",TAPFLOW_MERCHANT_CLIENT_ID:config.clientId,
  TAPFLOW_MERCHANT_PUBLIC_JWKS:JSON.stringify({keys:[{kty:"RSA",kid:"qa",n:"public-fixture",e:"AQAB"}]})};
 const route="/api/merchant/login-config";
 assert.equal((await worker.fetch(request(route,"https://other.example.test"),env)).status,404);
 assert.equal((await worker.fetch(request(route),{...env,TAPFLOW_MERCHANT_CLIENT_ID:undefined})).status,404);
 const res=await worker.fetch(request(route),env);
 assert.deepEqual(await res.json(),config);
 assert.equal(res.headers.get("cache-control"),"no-store");
 const page=await worker.fetch(request("/merchant.html"),env);
 assert.match(page.headers.get("content-security-policy"),/connect-src 'self' https:\/\/pilot-id\.example\.test$/);
});
