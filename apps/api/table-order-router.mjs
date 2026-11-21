// Isolated composition for a future private preview. No deployed Worker imports it.
import {createOrderAdmissionIssuer, createOrderAdmissionRedeemer} from "./order-admission.mjs";
import {createOrderSessionAuthorizer} from "./order-session.mjs";
import {createOrderApi} from "./order-service.mjs";
import {createOrderTracking} from "./order-tracking.mjs";

const ORDER = /^\/v1\/orders\/ord_[a-f0-9]{40}$/;
const TRACK = /^\/v1\/order-tracking\/(ord_[a-f0-9]{40})$/;
const ADMISSION = "/v1/table-admissions";
const SESSION = "/v1/order-sessions";
const QUOTE = "/v1/quotes";
const ORDERS = "/v1/orders";
const headers = {
  "cache-control":"no-store", "content-type":"application/json; charset=utf-8",
  "x-content-type-options":"nosniff", "referrer-policy":"no-referrer"
};
const json = (status, body, extra={}) => new Response(JSON.stringify(body), {status,headers:{...headers,...extra}});
const error = (status, message, extra) => json(status,{error:message},extra);
const unavailable = () => error(503,"Pedidos por mesa indisponíveis");
const MAX_BYTES = 256;

async function oneField(request, field, pattern) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))
    return [415];
  if (!request.body) return [400];
  const size = request.headers.get("content-length");
  if (size !== null && (!/^\d+$/.test(size) || Number(size)>MAX_BYTES)) return [413];
  const reader = request.body.getReader();
  const payload = new Uint8Array(MAX_BYTES);
  let offset=0;
  try{
    while (true) {
      const {value,done}=await reader.read();
      if(done) break;
      if(offset+value.byteLength>MAX_BYTES){ void reader.cancel().catch(()=>{}); return [413]; }
      payload.set(value,offset);
      offset+=value.byteLength;
    }
  }finally{ reader.releaseLock(); }
  try {
    const input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(payload.subarray(0,offset)));
    if (input && Object.keys(input).length===1 && Object.hasOwn(input,field) &&
        typeof input[field]==="string" && pattern.test(input[field])) return [200,input[field]];
  } catch {}
  return [400];
}

function trustedOrigin(raw) {
  if (typeof raw!=="string") return null;
  try {
    const url=new URL(raw);
    if (url.origin!==raw) return null;
    if (url.protocol==="https:" || (url.protocol==="http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname)))
      return raw;
  } catch {}
  return null;
}

function edgeFailure(result){
  if (result?.ok===true) return null;
  if (result?.status===429) return error(429,"Muitas tentativas. Aguarde um momento.");
  if (result?.status===403) return error(403,"Operação não autorizada");
  return unavailable();
}

/**
 * Opt-in only. The caller must supply verified staff authorization and a
 * platform-owned ingress resolver; never construct that resolver from a
 * forwarded client header. Rate guard results are denied unless explicitly OK.
 */
export function createTableOrderRouter({
  db, enabled=false, origin, authorizeStaff, resolveIngress, attemptGuard, now=Date.now
}={}) {
  const allowedOrigin=trustedOrigin(origin);
  const available=enabled===true && allowedOrigin && typeof authorizeStaff==="function" &&
    typeof resolveIngress==="function" && typeof attemptGuard?.ingress==="function" &&
    typeof attemptGuard?.staffIssue==="function" && typeof db?.prepare==="function";
  const redeem=createOrderAdmissionRedeemer({db,now});
  const authorizeSession=createOrderSessionAuthorizer({db,now});
  const orders=createOrderApi({db,authorizeSession,enabled:!!available});
  const tracking=createOrderTracking({db,now,enabled:!!available});
  return async function route(request){
    const url=new URL(request.url);
    const path=url.pathname;
    const track=TRACK.exec(path);
    if(!track && ![ADMISSION,SESSION,QUOTE,ORDERS].includes(path) && !ORDER.test(path)) return null;
    if(!available) return unavailable();
    if(url.origin!==allowedOrigin) return error(403,"Origem não autorizada");
    if(url.search) return error(400,"Parâmetros não permitidos");
    const methods=track?["GET","POST"]:ORDER.test(path)?["GET"]:["POST"];
    if(!methods.includes(request.method)) return error(405,"Método não permitido",{allow:methods.join(", ")});
    const requestOrigin=request.headers.get("origin");
    if ((request.method==="POST" || requestOrigin!==null) && requestOrigin!==allowedOrigin)
      return error(403,"Origem não autorizada");
    try {
      if(path===ADMISSION || path===SESSION){
        const action=path===ADMISSION?"issue":"redeem";
        const preflight=edgeFailure(await attemptGuard.ingress(action,await resolveIngress(request)));
        if(preflight) return preflight;
        const [status,value]=action==="issue"?
          await oneField(request,"tableId",/^[A-Za-z0-9_-]{1,64}$/):
          await oneField(request,"code",/^[A-Za-z0-9_-]{43}$/);
        if(status!==200) return error(status,"Corpo da solicitação inválido");
        if(action==="redeem") {
          const grant=await redeem(value);
          return grant?json(201,grant):error(401,"Código de mesa inválido ou expirado");
        }
        const permission="issue_table_admission";
        const staff=await authorizeStaff({request,tableId:value},permission);
        if(staff?.permission!==permission) return error(403,"Operação não autorizada");
        const staffRejected=edgeFailure(await attemptGuard.staffIssue(staff));
        if(staffRejected) return staffRejected;
        const issue=createOrderAdmissionIssuer({db,now,requireCurrentStaffMembership:true,authorizeStaff:async()=>staff});
        const grant=await issue(null,value);
        return grant?json(201,grant):error(409,"Não foi possível emitir o código nesta mesa agora");
      }
      if(track){
        // No body is used for tracking issuance; only the order path and bearer are accepted.
        const result=request.method==="POST"?await tracking.issue(request,track[1]):await tracking.read(request,track[1]);
        return result?json(request.method==="POST"?201:200,result):error(404,"Acompanhamento indisponível");
      }
      const response=await orders(request);
      return new Response(response.body,{status:response.status,headers:{...headers}});
    } catch {
      return unavailable();
    }
  };
}
