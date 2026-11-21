-- TapFlow merchant pilot. Additive; no access granted by applying this migration.
CREATE TABLE merchant_owners (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  staff_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'suspended' CHECK(status IN ('active','suspended')),
  PRIMARY KEY(tenant_id,issuer,subject)
);
CREATE TABLE merchant_provisioning (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  slug TEXT NOT NULL,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(issuer,subject,slug)
);
CREATE TABLE menu_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 999),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  UNIQUE(tenant_id,location_id,id)
);
CREATE UNIQUE INDEX merchant_menu_item_location ON menu_items(tenant_id,location_id,id);
CREATE TABLE menu_item_categories (
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY(tenant_id,location_id,item_id),
  FOREIGN KEY(tenant_id,location_id,item_id) REFERENCES menu_items(tenant_id,location_id,id),
  FOREIGN KEY(tenant_id,location_id,category_id) REFERENCES menu_categories(tenant_id,location_id,id)
);
CREATE INDEX merchant_owners_identity ON merchant_owners(issuer,subject,status);
CREATE INDEX merchant_menu_categories_location ON menu_categories(tenant_id,location_id,is_active,sort_order,id);
CREATE INDEX merchant_menu_addons_item ON menu_addons(tenant_id,menu_item_id,id);
