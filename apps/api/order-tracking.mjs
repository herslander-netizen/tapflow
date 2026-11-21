// Continuação somente de leitura, interna e desligada por padrão. Nenhuma rota é registrada aqui.
import {createOrderSessionAuthorizer} from "./order-session.mjs";

export const ORDER_TRACKING_TTL_MS=24*60*60*1000;
const ORDER_ID=/^ord_[a-f0-9]{40}$/;
const SESSION_HEADER=/^Bearer ([A-Za-z0-9_-]{43})$/i;
const TRACKING_HEADER=/^Bearer (tftrk_[A-Za-z0-9_-]{43})$/i;
const MINT=`INSERT INTO order_tracking_tokens
  (token_hash,tenant_id,order_id,issued_at_ms,expires_at_ms)
  SELECT ?,o.tenant_id,o.id,?,?
  FROM orders o
  JOIN order_sessions s ON s.session_hash=o.actor_session_hash AND s.tenant_id=o.tenant_id
    AND s.location_id=o.location_id AND s.table_id=o.table_id
  JOIN dining_tables d ON d.id=o.table_id AND d.tenant_id=o.tenant_id AND d.location_id=o.location_id
  JOIN locations l ON l.id=o.location_id AND l.tenant_id=o.tenant_id
  JOIN tenants t ON t.id=o.tenant_id
  WHERE o.id=? AND s.session_hash=? AND s.expires_at_ms>? AND s.revoked_at_ms IS NULL
    AND d.is_active=1 AND l.status='active' AND t.status='active'
  ON CONFLICT (tenant_id,order_id) DO UPDATE SET issued_at_ms=order_tracking_tokens.issued_at_ms
    WHERE order_tracking_tokens.token_hash=excluded.token_hash
      AND order_tracking_tokens.revoked_at_ms IS NULL
      AND order_tracking_tokens.issued_at_ms<=excluded.issued_at_ms
      AND order_tracking_tokens.expires_at_ms>excluded.issued_at_ms
  RETURNING token_hash,expires_at_ms`;
const LOOKUP=`SELECT o.id,o.status,o.updated_at FROM order_tracking_tokens k
  JOIN orders o ON o.id=k.order_id AND o.tenant_id=k.tenant_id
  JOIN tenants t ON t.id=o.tenant_id
  WHERE k.token_hash=? AND k.order_id=? AND k.expires_at_ms>? AND k.issued_at_ms<=?
    AND k.revoked_at_ms IS NULL AND t.status='active'`;

async function hashToken(token){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function recoverableToken(sessionToken,orderId){
  // Session token is already an opaque random 256-bit capability. Never use its
  // stored hash here: the database alone must not be able to recreate the grant.
  const encode=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",encode.encode(sessionToken),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,encode.encode("tapflow/tracking/v1:"+orderId)));
  return "tftrk_"+btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function validTime(timestamp){
  return Number.isSafeInteger(timestamp)&&timestamp>=0&&timestamp<=Number.MAX_SAFE_INTEGER-ORDER_TRACKING_TTL_MS;
}

export function createOrderTracking({db,now=Date.now,enabled=false}={}){
  const authorize=createOrderSessionAuthorizer({db,now});
  return {
    // Retry com a sessão autora válida retorna o mesmo token sem estender validade.
    // O banco grava apenas o hash e nunca recebe a sessão original.
    async issue(request,orderId){
      if(enabled!==true || typeof orderId!=="string" || !ORDER_ID.test(orderId)) return null;
      const context=await authorize(request);
      if(!context) return null;
      const timestamp=now();
      if(!validTime(timestamp)) return null;
      const sessionToken=SESSION_HEADER.exec(request.headers.get("authorization")??"")?.[1];
      if(!sessionToken) return null;
      const token=await recoverableToken(sessionToken,orderId), hash=await hashToken(token);
      const expiresAtMs=timestamp+ORDER_TRACKING_TTL_MS;
      const row=await db.prepare(MINT).bind(hash,timestamp,expiresAtMs,
        orderId,context.sessionHash,timestamp).first();
      return row?.token_hash===hash && Number.isSafeInteger(row.expires_at_ms)
        ? {token,expiresAtMs:row.expires_at_ms} : null;
    },
    // Token aceita exclusivamente cabeçalho, GET, um pedido e campos mínimos.
    async read(request,orderId){
      if(enabled!==true || request.method!=="GET" || typeof orderId!=="string" || !ORDER_ID.test(orderId)) return null;
      const token=TRACKING_HEADER.exec(request.headers.get("authorization")??"")?.[1];
      if(!token) return null;
      const timestamp=now();
      if(!validTime(timestamp)) return null;
      if(typeof db?.prepare!=="function") throw new Error("Banco de acompanhamento indisponível");
      const hash=await hashToken(token);
      const row=await db.prepare(LOOKUP).bind(hash,orderId,timestamp,timestamp).first();
      return row ? {id:row.id,status:row.status,updatedAt:row.updated_at} : null;
    }
  };
}
