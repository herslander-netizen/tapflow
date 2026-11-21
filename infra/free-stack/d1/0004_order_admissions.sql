-- TapFlow | Proposta aditiva local; não aplicada ao D1.
-- O QR/NFC físico não é uma admissão permanente. Só o servidor emite códigos efêmeros.
CREATE TABLE IF NOT EXISTS order_admissions (
  admission_hash TEXT PRIMARY KEY NOT NULL
    CHECK(length(admission_hash)=64 AND admission_hash NOT GLOB '*[^a-f0-9]*'),
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  issued_at_ms INTEGER NOT NULL CHECK(typeof(issued_at_ms)='integer' AND issued_at_ms>=0),
  expires_at_ms INTEGER NOT NULL CHECK(typeof(expires_at_ms)='integer'
    AND expires_at_ms>issued_at_ms AND expires_at_ms-issued_at_ms<=300000),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR (typeof(revoked_at_ms)='integer' AND revoked_at_ms>=0)),
  redeemed_at_ms INTEGER,
  session_hash TEXT CHECK(session_hash IS NULL
    OR (length(session_hash)=64 AND session_hash NOT GLOB '*[^a-f0-9]*')),
  CHECK((redeemed_at_ms IS NULL AND session_hash IS NULL)
    OR (typeof(redeemed_at_ms)='integer' AND session_hash IS NOT NULL
      AND redeemed_at_ms>=issued_at_ms AND redeemed_at_ms<expires_at_ms AND revoked_at_ms IS NULL)),
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  FOREIGN KEY(tenant_id,table_id) REFERENCES dining_tables(tenant_id,id)
);

-- O mesmo UPDATE que consome a admissão cria a sessão; se o INSERT falhar, tudo reverte.
CREATE TRIGGER IF NOT EXISTS order_admissions_form_session
AFTER UPDATE OF redeemed_at_ms ON order_admissions
WHEN OLD.redeemed_at_ms IS NULL AND NEW.redeemed_at_ms IS NOT NULL
BEGIN
  INSERT INTO order_sessions (session_hash,tenant_id,location_id,table_id,expires_at_ms)
  VALUES(NEW.session_hash,NEW.tenant_id,NEW.location_id,NEW.table_id,NEW.redeemed_at_ms+1800000);
END;
