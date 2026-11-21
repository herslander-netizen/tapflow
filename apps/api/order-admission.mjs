// Uso interno: não expõe rota e não concede autorização de emissão a funcionários.
const OPAQUE_CODE = /^[A-Za-z0-9_-]{43}$/;
const SESSION_TTL_MS = 30 * 60 * 1000;
const REDEEM_SQL = `UPDATE order_admissions AS a
  SET redeemed_at_ms=?, session_hash=?
  WHERE a.admission_hash=? AND a.issued_at_ms<=? AND a.expires_at_ms>?
    AND a.revoked_at_ms IS NULL AND a.redeemed_at_ms IS NULL
    AND EXISTS (
      SELECT 1 FROM dining_tables d
      JOIN locations l ON l.id=d.location_id AND l.tenant_id=d.tenant_id
      JOIN tenants t ON t.id=d.tenant_id
      WHERE d.id=a.table_id AND d.tenant_id=a.tenant_id AND d.location_id=a.location_id
        AND d.is_active=1 AND l.status='active' AND t.status='active'
    )
  RETURNING session_hash`;

async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}

export function createOrderAdmissionRedeemer({db,now=Date.now}={}) {
  return async function redeemAdmission(code) {
    if (typeof code!=="string" || !OPAQUE_CODE.test(code)) return null;
    const timestamp=now();
    if (!Number.isSafeInteger(timestamp) || timestamp<0 || timestamp>Number.MAX_SAFE_INTEGER-SESSION_TTL_MS) return null;
    if (typeof db?.prepare!=="function") throw new Error("Banco de admissões indisponível");
    const token=createToken();
    const [admissionHash,sessionHash]=await Promise.all([hash(code),hash(token)]);
    const row=await db.prepare(REDEEM_SQL)
      .bind(timestamp,sessionHash,admissionHash,timestamp,timestamp).first();
    if (row?.session_hash!==sessionHash) return null;
    return {token,expiresAtMs:timestamp+SESSION_TTL_MS};
  };
}

const ID=/^[A-Za-z0-9_-]{1,64}$/;
const ADMISSION_TTL_MS=5*60*1000;
const ISSUE_WINDOW_MS=60*1000;
const MAX_RECENT_PER_TABLE=6;
const MAX_ACTIVE_PER_TABLE=3;
const ISSUE_SQL=`INSERT INTO order_admissions
  (admission_hash,tenant_id,location_id,table_id,issued_at_ms,expires_at_ms)
  SELECT ?,d.tenant_id,d.location_id,d.id,?,?
  FROM dining_tables d
  JOIN locations l ON l.id=d.location_id AND l.tenant_id=d.tenant_id
  JOIN tenants t ON t.id=d.tenant_id
  WHERE d.id=? AND d.tenant_id=? AND d.location_id=?
    AND d.is_active=1 AND l.status='active' AND t.status='active'
    AND (SELECT COUNT(*) FROM order_admissions a
         WHERE a.tenant_id=d.tenant_id AND a.location_id=d.location_id AND a.table_id=d.id
           AND a.issued_at_ms>?)<?
    AND (SELECT COUNT(*) FROM order_admissions a
         WHERE a.tenant_id=d.tenant_id AND a.location_id=d.location_id AND a.table_id=d.id
           AND a.expires_at_ms>? AND a.revoked_at_ms IS NULL AND a.redeemed_at_ms IS NULL)<?
  RETURNING admission_hash`;

/**
 * Comando interno. authorizeStaff(ctx, capability) precisa autenticar o operador
 * usando uma sessão confiável e conferir a permissão e associação ATUAIS na
 * unidade. Nunca copie identidade, permissão ou escopo de headers/JSON do cliente.
 * Sucesso do adaptador: { staffId, tenantId, locationId, permission }.
 * O contexto opaco não é enviado ao banco; tableId é só seletor no escopo verificado.
 */
export function createOrderAdmissionIssuer({db,authorizeStaff,now=Date.now}={}){
  return async function issueOrderAdmission(staffContext,tableId){
    if(typeof tableId!=="string" || !ID.test(tableId) || typeof authorizeStaff!=="function") return null;
    const permission="issue_table_admission";
    const staff=await authorizeStaff(staffContext,permission);
    if(staff?.permission!==permission || ![staff.staffId,staff.tenantId,staff.locationId].every(
      id=>typeof id==="string" && ID.test(id)
    )) return null;
    const {tenantId,locationId}=staff;
    const timestamp=now();
    if(!Number.isSafeInteger(timestamp) || timestamp<0 || timestamp>Number.MAX_SAFE_INTEGER-ADMISSION_TTL_MS) return null;
    if(typeof db?.prepare!=="function") throw new Error("Banco de admissões indisponível");
    const code=createToken(), admissionHash=await hash(code);
    const expiresAtMs=timestamp+ADMISSION_TTL_MS;
    // As duas cotas e a inserção fazem parte da mesma escrita SQLite.
    const row=await db.prepare(ISSUE_SQL).bind(
      admissionHash,timestamp,expiresAtMs,tableId,tenantId,locationId,
      timestamp-ISSUE_WINDOW_MS,MAX_RECENT_PER_TABLE,timestamp,MAX_ACTIVE_PER_TABLE
    ).first();
    return row?.admission_hash===admissionHash ? {code,expiresAtMs} : null;
  };
}
