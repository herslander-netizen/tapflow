// Adaptador interno e desligado por padrão. Não instala login, rota ou serviço.
const PERMISSION="issue_table_admission";
const ROLES=new Set(["owner","manager","attendant"]);
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const SEGMENT=/^[A-Za-z0-9_-]+$/;
const MAX_TOKEN=8192;
const MAX_TTL_S=900;
const FIND=`SELECT s.staff_id,s.tenant_id,s.location_id,s.role,d.id AS table_id
  FROM order_staff_memberships s
  JOIN tenants t ON t.id=s.tenant_id
  JOIN locations l ON l.id=s.location_id AND l.tenant_id=s.tenant_id
  JOIN dining_tables d ON d.tenant_id=s.tenant_id AND d.location_id=s.location_id
  WHERE s.issuer=? AND s.subject=? AND d.id=? AND d.is_active=1
    AND s.status='active' AND t.status='active' AND l.status='active'`;

function bytes(segment){
  if (!SEGMENT.test(segment) || segment.length%4===1) throw new Error("JWT inválido");
  return Uint8Array.from(atob(segment.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));
}
function json(segment){
  const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes(segment)));
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("JWT inválido");
  return value;
}
const id=value=>typeof value==="string" && ID.test(value);
function safeIssuer(s){
  if(typeof s!=="string")return false;
  try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash;}
  catch{return false;}
}

// Opt-in only. Do not generalize audience matching to arbitrary arrays.
export function isValidAuth0IdentityConfig(issuer,audience,auth0){
  if(!safeIssuer(issuer)||!auth0||typeof auth0.clientId!=="string"||
    !/^[A-Za-z0-9_-]{1,128}$/.test(auth0.clientId))return false;
  if(auth0.userinfoAudience===undefined)return true;
  const url=new URL(issuer);
  return (url.pathname==="/"||url.pathname==="")&&
    auth0.userinfoAudience===url.origin+"/userinfo"&&auth0.userinfoAudience!==audience;
}

function matchesAudience(value,audience,userinfo){
  if(value===audience)return true;
  if(!Array.isArray(value))return false;
  if(value.length===1)return value[0]===audience;
  return userinfo!==undefined&&value.length===2&&
    ((value[0]===audience&&value[1]===userinfo)||(value[0]===userinfo&&value[1]===audience));
}

export function createD1StaffMembershipRepository(db){
  return async function findActiveMembership({issuer,subject,tableId}){
    if(typeof db?.prepare!=="function")throw new Error("Banco de funcionários indisponível");
    return db.prepare(FIND).bind(issuer,subject,tableId).first();
  };
}

/**
 * getVerificationKey recebe somente o kid e resolve uma CryptoKey pública RS256 do
 * emissor fixo e confiável. Não segue URLs de cabeçalhos/tokens; o aplicativo deve
 * manter JWKS pinado e rotacionado fora deste módulo. Escopo da chamada é seletor:
 * todas as permissões vêm da associação ativa no banco, não do JWT/cliente.
 */
export function createVerifiedStaffIdentity({
  enabled=false,issuer,audience,getVerificationKey,auth0,now=Date.now
}={}){
  const configured=enabled===true&&safeIssuer(issuer)&&typeof audience==="string"&&
    audience.length>0&&typeof getVerificationKey==="function"&&
    (auth0===undefined||isValidAuth0IdentityConfig(issuer,audience,auth0));
  const auth0ClientId=auth0?.clientId, userinfoAudience=auth0?.userinfoAudience;
  return async function verifyIdentity(request){
    if(!configured)return null;
    const raw=request?.headers?.get("authorization");
    if(typeof raw!=="string"||raw.length>MAX_TOKEN+7)return null;
    const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(raw)?.[1];
    if(!token)return null;
    let claims;
    try{
      const [header,payload,signature]=token.split(".");
      const h=json(header);
      if(h.alg!=="RS256"||h.typ!=="at+jwt"||!id(h.kid)||
        Object.keys(h).some(field=>!["alg","typ","kid"].includes(field)))return null;
      const key=await getVerificationKey(h.kid);
      if(key?.type!=="public"||key.algorithm?.name!=="RSASSA-PKCS1-v1_5"||
        key.algorithm?.hash?.name!=="SHA-256"||key.algorithm?.modulusLength<2048||
        !key.usages?.includes("verify"))return null;
      if(!await crypto.subtle.verify(key.algorithm.name,key,bytes(signature),
        new TextEncoder().encode(header+"."+payload)))return null;
      claims=json(payload);
    }catch{return null;}
    const timeMs=now();
    if(!Number.isSafeInteger(timeMs)||timeMs<0)return null;
    const time=Math.floor(timeMs/1000);
    const aud=claims.aud;
    if(claims.iss!==issuer||!matchesAudience(aud,audience,userinfoAudience)||
      typeof claims.sub!=="string"||!/^[\x21-\x7e]{1,255}$/.test(claims.sub)||
      !Number.isSafeInteger(claims.iat)||claims.iat<0||claims.iat>time||
      !Number.isSafeInteger(claims.exp)||claims.exp<=time||claims.exp-claims.iat>MAX_TTL_S||
      (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf<0||claims.nbf>time)))return null;
    if(auth0ClientId!==undefined&&(claims.client_id!==auth0ClientId||
      claims.sub.endsWith("@clients")||claims.gty==="client-credentials"))return null;
    return {issuer,subject:claims.sub};
  };
}

export function createStaffIdentityAuthorizer({findActiveMembership,...options}={}){
  const verifyIdentity=createVerifiedStaffIdentity(options);
  return async function authorizeStaff(context,permission){
    const {request,tableId}=context??{};
    if(permission!==PERMISSION||!id(tableId)||typeof findActiveMembership!=="function")return null;
    const identity=await verifyIdentity(request);
    if(!identity)return null;
    const {issuer,subject}=identity;
    const member=await findActiveMembership({issuer,subject,tableId});
    if(!member||!id(member.staff_id)||!id(member.tenant_id)||!id(member.location_id)||member.table_id!==tableId||
      !ROLES.has(member.role))return null;
    return {staffId:member.staff_id,tenantId:member.tenant_id,locationId:member.location_id,permission,
      membershipProof:{issuer,subject,tableId}};
  };
}
