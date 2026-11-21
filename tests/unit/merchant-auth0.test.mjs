import test from "node:test";
import assert from "node:assert/strict";
import {createVerifiedStaffIdentity} from "../../apps/api/staff-identity.mjs";
import {createMerchantPreviewConfig} from "../../apps/api/merchant-preview-config.mjs";

const issuer="https://merchant-id.example.test/";
const audience="https://merchant-api.example.test";
const userinfoAudience="https://merchant-id.example.test/userinfo";
const clientId="TapFlowPilotClient";
const now=1_800_000_000_000;
const iat=now/1000;
const key=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const part=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
const header={alg:"RS256",typ:"at+jwt",kid:"pinned"};
const claims={iss:issuer,aud:audience,sub:"auth0|owner-fixture",iat,exp:iat+900,client_id:clientId,jti:"fixture"};
const origin="https://tapflow-pilot.example.test";
async function signed(c={},h={}){
  const msg=part({...header,...h})+"."+part({...claims,...c});
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key.privateKey,Buffer.from(msg));
  return new Request(origin,{headers:{Authorization:"Bearer "+msg+"."+Buffer.from(sig).toString("base64url")}});
}
const args={enabled:true,issuer,audience,now:()=>now,getVerificationKey:async id=>id==="pinned"?key.publicKey:null};
const identity={issuer,subject:claims.sub};

test("Auth0 opt-in accepts only the configured exact pair or the valid singleton",async()=>{
  const strict=createVerifiedStaffIdentity(args);
  const auth0=createVerifiedStaffIdentity({...args,auth0:{clientId,userinfoAudience}});
  const singleton=createVerifiedStaffIdentity({...args,auth0:{clientId}});
  for(const aud of [audience,[audience]]){
    assert.deepEqual(await auth0(await signed({aud})),identity);
    assert.deepEqual(await singleton(await signed({aud})),identity);
  }
  for(const aud of [[audience,userinfoAudience],[userinfoAudience,audience]]){
    const req=await signed({aud});
    assert.deepEqual(await auth0(req),identity);
    assert.equal(await strict(req),null);
    assert.equal(await singleton(req),null);
  }
  for(const aud of [userinfoAudience,[userinfoAudience],[audience,audience],[audience,"https://else.example.test/userinfo"],
    [audience,userinfoAudience,"other"],[userinfoAudience,userinfoAudience]]){
    assert.equal(await auth0(await signed({aud})),null);
  }
});

test("Auth0 opt-in pins signed client and preserves signature/type/time/issuer limits",async()=>{
  const verify=createVerifiedStaffIdentity({...args,auth0:{clientId,userinfoAudience}});
  const wrongs=[
    await signed({client_id:undefined,azp:clientId}),
    await signed({client_id:"OtherClient"}),
    await signed({sub:"OtherClient@clients"}),
    await signed({gty:"client-credentials"}),
    await signed({exp:iat+901}),
    await signed({exp:iat}),
    await signed({iss:issuer.slice(0,-1)}),
    await signed({}, {typ:"JWT"}),
    await signed({}, {kid:"other"}),
    new Request(origin,{headers:{Authorization:"Bearer opaque-token"}})
  ];
  for(const req of wrongs)assert.equal(await verify(req),null);
});

test("preview configuration refuses misspelled provider, missing pin and unbound UserInfo",async()=>{
  const request=new Request(origin);
  const jwk={...await crypto.subtle.exportKey("jwk",key.publicKey),kid:"pinned"};
  const base={DB:{},TAPFLOW_MERCHANT_PREVIEW:"true",TAPFLOW_MERCHANT_ORIGIN:origin,
    TAPFLOW_MERCHANT_ISSUER:issuer,TAPFLOW_MERCHANT_AUDIENCE:audience,
    TAPFLOW_MERCHANT_PUBLIC_JWKS:JSON.stringify({keys:[jwk]})};
  assert.ok(createMerchantPreviewConfig(request,base));
  assert.equal(createMerchantPreviewConfig(request,{...base,TAPFLOW_MERCHANT_IDENTITY_PROVIDER:"Auth0"}),null);
  assert.equal(createMerchantPreviewConfig(request,{...base,TAPFLOW_MERCHANT_CLIENT_ID:clientId}),null);
  const optin={...base,TAPFLOW_MERCHANT_IDENTITY_PROVIDER:"auth0"};
  assert.equal(createMerchantPreviewConfig(request,optin),null);
  const pinned={...optin,TAPFLOW_MERCHANT_CLIENT_ID:clientId};
  assert.ok(createMerchantPreviewConfig(request,pinned));
  for(const bad of ["https://else.example.test/userinfo",userinfoAudience+"/",userinfoAudience+"?x=1",""]){
    assert.equal(createMerchantPreviewConfig(request,{...pinned,TAPFLOW_MERCHANT_AUTH0_USERINFO_AUDIENCE:bad}),null);
  }
  assert.ok(createMerchantPreviewConfig(request,{...pinned,TAPFLOW_MERCHANT_AUTH0_USERINFO_AUDIENCE:userinfoAudience}));
});
