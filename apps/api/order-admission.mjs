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
