import {createVerifiedStaffIdentity} from "./staff-identity.mjs";

// Authentication is only available in an explicitly enabled isolated Worker.
// No keys fetched from token-supplied URLs; rotate pinned public JWKs via deploy.
export function createMerchantPreviewConfig(request,env){
  const origin=env.TAPFLOW_MERCHANT_ORIGIN;
  const url=new URL(request.url);
  if(env.TAPFLOW_MERCHANT_PREVIEW!=="true"||url.origin!==origin||!env.DB)return null;
  try{
    const keys=JSON.parse(env.TAPFLOW_MERCHANT_PUBLIC_JWKS??"{}");
    if(!keys||!Array.isArray(keys.keys)||keys.keys.length===0||keys.keys.length>5)return null;
    const entries=new Map();
    for(const jwk of keys.keys){
      if(jwk?.kty!=="RSA"||typeof jwk.kid!=="string"||entries.has(jwk.kid)||
        typeof jwk.n!=="string"||typeof jwk.e!=="string"||["d","p","q","dp","dq","qi","oth","k"].some(k=>Object.hasOwn(jwk,k)))return null;
      // Keep only public RSA key material. Scope and algorithm are pinned by the verifier.
      entries.set(jwk.kid,{kty:"RSA",n:jwk.n,e:jwk.e});
    }
    const provisioningAllowlist=JSON.parse(env.TAPFLOW_MERCHANT_PROVISION_ALLOWLIST??"[]");
    if(!Array.isArray(provisioningAllowlist)||provisioningAllowlist.length>20)return null;
    const verifyIdentity=createVerifiedStaffIdentity({
      enabled:true,issuer:env.TAPFLOW_MERCHANT_ISSUER,audience:env.TAPFLOW_MERCHANT_AUDIENCE,
      getVerificationKey:async kid=>{
        const pub=entries.get(kid);
        if(!pub)return null;
        return crypto.subtle.importKey("jwk",pub,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
      }
    });
    return {enabled:true,db:env.DB,origin,verifyIdentity,provisioningAllowlist};
  }catch{return null;}
}
