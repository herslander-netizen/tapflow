-- TapFlow | Proposta aditiva local; não aplicada ao D1.
-- Atende o filtro de escopo e a janela de emissão; não cria usuários ou permissões.
CREATE INDEX IF NOT EXISTS order_admissions_table_issued_idx
  ON order_admissions (tenant_id,location_id,table_id,issued_at_ms);
CREATE INDEX IF NOT EXISTS order_admissions_table_active_idx
  ON order_admissions (tenant_id,location_id,table_id,expires_at_ms)
  WHERE redeemed_at_ms IS NULL AND revoked_at_ms IS NULL;
