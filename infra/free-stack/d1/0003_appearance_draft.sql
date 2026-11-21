-- TapFlow / ALVO Digital — proposta de migração D1 NÃO APLICADA.
-- Executar somente no D1 exclusivo do TapFlow após autenticação e validação
-- das regras de escopo. Nenhuma escrita deve ser exposta publicamente.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenant_appearances (
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT '',
  draft_json TEXT NOT NULL DEFAULT '{"preset":"tapflow","mode":"dark","accent":null,"background":null}',
  published_json TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  PRIMARY KEY (tenant_id, location_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CHECK (json_valid(draft_json)),
  CHECK (published_json IS NULL OR json_valid(published_json))
);
CREATE INDEX IF NOT EXISTS idx_tapflow_appearance_tenant ON tenant_appearances(tenant_id, location_id);

-- O código backend deve verificar tenant_id/location_id contra a sessão;
-- validar semântica dos campos, impedir edição por membros sem privilégio,
-- garantir revisões concorrentes e publicar de forma atômica/auditável.
-- D1 não possui RLS: somente o backend controla acesso por unidade.
