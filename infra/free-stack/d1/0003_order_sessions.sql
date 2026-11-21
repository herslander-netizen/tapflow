-- TapFlow (prévia): proposta aditiva. Não aplicada a nenhum banco.
-- Armazenar só SHA-256 de token opaco gerado por CSPRNG; jamais armazenar o bearer.
CREATE TABLE IF NOT EXISTS order_sessions (
  session_hash TEXT PRIMARY KEY NOT NULL
    CHECK(length(session_hash) = 64 AND session_hash NOT GLOB '*[^a-f0-9]*'),
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK(typeof(expires_at_ms) = 'integer' AND expires_at_ms > 0),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR (typeof(revoked_at_ms) = 'integer' AND revoked_at_ms >= 0)),
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  FOREIGN KEY(tenant_id,table_id) REFERENCES dining_tables(tenant_id,id)
);
