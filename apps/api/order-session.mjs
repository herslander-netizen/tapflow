// Pedido local: apenas resolve sessão já emitida. Não emite nem ativa pedidos.
const SESSION_TOKEN = /^Bearer ([A-Za-z0-9_-]{43})$/i;
const SESSION_HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const AUTH_QUERY = `SELECT s.tenant_id, s.location_id, s.table_id, s.session_hash
  FROM order_sessions s
  JOIN dining_tables d ON d.id=s.table_id AND d.tenant_id=s.tenant_id AND d.location_id=s.location_id
  JOIN locations l ON l.id=s.location_id AND l.tenant_id=s.tenant_id
  JOIN tenants t ON t.id=s.tenant_id
  WHERE s.session_hash=? AND s.expires_at_ms>? AND s.revoked_at_ms IS NULL
    AND d.is_active=1 AND l.status='active' AND t.status='active'`;

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createOrderSessionAuthorizer({ db, now = Date.now } = {}) {
  return async function authorizeSession(request) {
    const token = SESSION_TOKEN.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return null;
    // Expiração e revogação são resolvidas no servidor, nunca pelo QR ou corpo.
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) return null;
    if (typeof db?.prepare !== "function") throw new Error("Banco de sessões indisponível");
    const hash = await hashToken(token);
    const row = await db.prepare(AUTH_QUERY).bind(hash, timestamp).first();
    if (!row || ![row.tenant_id, row.location_id, row.table_id].every(
      (id) => typeof id === "string" && ID.test(id)
    ) || typeof row.session_hash !== "string" || !SESSION_HASH.test(row.session_hash) || row.session_hash !== hash) return null;
    return { tenantId: row.tenant_id, locationId: row.location_id, tableId: row.table_id, sessionHash: hash };
  };
}
