-- TapFlow | Proposta aditiva, não aplicada. Não concede acessos por padrão.
CREATE TABLE IF NOT EXISTS order_staff_memberships (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','attendant','viewer')),
  status TEXT NOT NULL DEFAULT 'suspended' CHECK(status IN ('active','suspended')),
  PRIMARY KEY(issuer,subject,tenant_id,location_id),
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id)
);
