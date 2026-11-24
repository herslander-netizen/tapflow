-- TapFlow — 0200 mesas, acesso por QR/NFC, sessões de convidado e cardápio.
-- Chaves estrangeiras compostas (tenant_id, id) impedem que um registro aponte para outro tenant.

-- ---------------------------------------------------------------------------------------------
-- Mesas
-- ---------------------------------------------------------------------------------------------

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  location_id uuid not null,
  public_number text not null check (length(btrim(public_number)) between 1 and 12),
  label text check (label is null or length(label) <= 60),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  unique (location_id, public_number),
  unique (tenant_id, id),
  unique (tenant_id, location_id, id)
);

-- Guarda só o hash do token; a URL do QR/NFC contém o token puro e pode ser rotacionada
-- sem perder o histórico (PRD, seção 08, item 5).
create table public.table_access_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  table_id uuid not null,
  token_hash bytea not null unique check (length(token_hash) = 32),
  token_hint text not null check (length(token_hint) = 4),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id, table_id) references public.dining_tables (tenant_id, location_id, id)
);
-- No máximo um token vigente por mesa.
create unique index table_access_tokens_one_active on public.table_access_tokens (table_id) where revoked_at is null;

-- Sessão anônima do cliente (um aparelho). Carrinho e pedidos ficam presos a ela;
-- duas pessoas na mesma mesa têm sessões separadas (PRD, seção 5.4, item 3).
create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  table_id uuid,
  service_mode text not null check (service_mode in ('table', 'pickup')),
  origin text not null default 'link' check (origin in ('nfc', 'qr', 'link')),
  session_token_hash bytea not null unique check (length(session_token_hash) = 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, location_id, table_id) references public.dining_tables (tenant_id, location_id, id),
  check ((service_mode = 'table') = (table_id is not null)),
  unique (tenant_id, id)
);
create index guest_sessions_location_idx on public.guest_sessions (tenant_id, location_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Cardápio
-- Visibilidade (published/hidden) e operação (available/sold_out) são eixos separados (PRD 9.3).
-- ---------------------------------------------------------------------------------------------

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  visibility text not null default 'published' check (visibility in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  category_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 1000),
  ingredients text check (ingredients is null or length(ingredients) <= 1000),
  allergens text[] not null default '{}',
  price_cents integer not null check (price_cents >= 0 and price_cents <= 10000000),
  currency text not null default 'BRL' check (currency = 'BRL'),
  visibility text not null default 'hidden' check (visibility in ('published', 'hidden')),
  availability text not null default 'available' check (availability in ('available', 'sold_out')),
  -- Estoque opcional: nulo = sem controle de quantidade.
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  position integer not null default 0,
  -- Incrementa a cada mudança de preço/adicionais; cotações antigas deixam de valer.
  price_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, category_id) references public.menu_categories (tenant_id, id),
  unique (tenant_id, id)
);
create index menu_items_catalog_idx on public.menu_items (tenant_id, category_id, position) where visibility = 'published';

-- Mídia guardada no Storage do próprio projeto, no caminho "<tenant_id>/...".
create table public.item_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  item_id uuid not null,
  kind text not null check (kind in ('poster', 'photo', 'video')),
  storage_path text not null,
  mime_type text not null check (mime_type ~ '^(image|video)/[a-z0-9.+-]+$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms between 1 and 120000),
  bytes bigint check (bytes is null or bytes > 0),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed', 'archived')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, item_id) references public.menu_items (tenant_id, id),
  check (storage_path like tenant_id::text || '/%' and storage_path !~ '\.\.'),
  check ((kind = 'video') = (mime_type like 'video/%'))
);
create index item_media_item_idx on public.item_media (tenant_id, item_id, position);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1 and max_select <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_select >= min_select),
  unique (tenant_id, id)
);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  group_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  price_delta_cents integer not null default 0 check (price_delta_cents between 0 and 1000000),
  availability text not null default 'available' check (availability in ('available', 'sold_out')),
  visibility text not null default 'published' check (visibility in ('published', 'hidden')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, group_id) references public.modifier_groups (tenant_id, id),
  unique (tenant_id, id)
);

create table public.item_modifier_groups (
  tenant_id uuid not null,
  item_id uuid not null,
  group_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (item_id, group_id),
  foreign key (tenant_id, item_id) references public.menu_items (tenant_id, id),
  foreign key (tenant_id, group_id) references public.modifier_groups (tenant_id, id)
);

-- Mudança de preço registra uma nova versão. A confirmação do pedido compara preço do item e dos
-- adicionais com a cotação de novo, então qualquer mudança invalida cotações abertas.
create function private.bump_price_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.price_cents is distinct from old.price_cents then
    new.price_version := old.price_version + 1;
  end if;
  return new;
end $$;
create trigger menu_items_price_version before update on public.menu_items
  for each row execute function private.bump_price_version();

create trigger dining_tables_updated_at before update on public.dining_tables for each row execute function private.set_updated_at();
create trigger menu_categories_updated_at before update on public.menu_categories for each row execute function private.set_updated_at();
create trigger menu_items_updated_at before update on public.menu_items for each row execute function private.set_updated_at();
create trigger item_media_updated_at before update on public.item_media for each row execute function private.set_updated_at();
create trigger modifier_groups_updated_at before update on public.modifier_groups for each row execute function private.set_updated_at();
create trigger modifiers_updated_at before update on public.modifiers for each row execute function private.set_updated_at();

-- Itens referenciados por pedidos não somem; usar visibility = 'hidden'.
create trigger dining_tables_no_delete before delete or truncate on public.dining_tables for each statement execute function private.no_delete();
create trigger table_access_tokens_no_delete before delete or truncate on public.table_access_tokens for each statement execute function private.no_delete();
create trigger menu_categories_no_delete before delete or truncate on public.menu_categories for each statement execute function private.no_delete();
create trigger menu_items_no_delete before delete or truncate on public.menu_items for each statement execute function private.no_delete();
create trigger modifier_groups_no_delete before delete or truncate on public.modifier_groups for each statement execute function private.no_delete();
create trigger modifiers_no_delete before delete or truncate on public.modifiers for each statement execute function private.no_delete();
