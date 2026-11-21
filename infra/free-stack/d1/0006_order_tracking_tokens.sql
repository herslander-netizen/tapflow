-- TapFlow | Proposta aditiva, não aplicada. Credencial de leitura de um único pedido.
-- Validade e retenção proposta: 24 horas; limpeza exigida antes de ativar a funcionalidade.
CREATE TABLE IF NOT EXISTS order_tracking_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK(length(token_hash)=64 AND token_hash NOT GLOB '*[^a-f0-9]*'),
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  issued_at_ms INTEGER NOT NULL CHECK(typeof(issued_at_ms)='integer' AND issued_at_ms>=0),
  expires_at_ms INTEGER NOT NULL CHECK(typeof(expires_at_ms)='integer'
    AND expires_at_ms>issued_at_ms AND expires_at_ms-issued_at_ms<=86400000),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR (
    typeof(revoked_at_ms)='integer' AND revoked_at_ms>=issued_at_ms)),
  UNIQUE(tenant_id,order_id),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS order_tracking_tokens_expiry_idx ON order_tracking_tokens(expires_at_ms);
