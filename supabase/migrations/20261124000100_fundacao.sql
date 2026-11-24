-- TapFlow — 0100 fundação: esquemas auxiliares, organização (tenants, unidades, equipe) e plataforma ALVO.
-- Banco próprio do TapFlow. Não aplicar em projetos de Flow, Alvo OS ou Evolution Alvo.
-- Convenções (PRD, seção 08): id uuid, tenant_id onde aplicável, created_at/updated_at,
-- dinheiro em centavos inteiros e moeda BRL explícita. Estados em texto com CHECK.

create schema if not exists private;   -- funções auxiliares de autorização; não exposto na API
create schema if not exists servico;   -- operações chamadas só pela API (service_role)

revoke all on schema private from public;
revoke all on schema servico from public;
grant usage on schema private to anon, authenticated, service_role;
grant usage on schema servico to service_role;

-- Padrão do Postgres: funções novas podem ser executadas por PUBLIC. Aqui o acesso é concedido
-- função a função, então tiramos o padrão nos esquemas deste projeto.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema servico revoke execute on functions from public;

-- updated_at automático
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Bloqueia UPDATE/DELETE em tabelas append-only (eventos, snapshots, auditoria).
create function private.append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'somente_insercao',
    detail = format('A tabela %I.%I não aceita %s.', tg_table_schema, tg_table_name, tg_op);
end $$;

-- Bloqueia só DELETE (registros que mudam de estado mas nunca somem, como pedidos).
create function private.no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'exclusao_proibida',
    detail = format('Registros de %I.%I não são apagados; use o estado.', tg_table_schema, tg_table_name);
end $$;

-- Token opaco com 244 bits aleatórios (gen_random_uuid usa gerador criptográfico).
create function private.random_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

create function private.hash_token(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

-- ---------------------------------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended', 'closed')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  timezone text not null default 'America/Sao_Paulo',
  -- Taxa de serviço em pontos-base (100 = 1%). Padrão desativada (PRD, seção 02).
  service_fee_bps integer not null default 0 check (service_fee_bps between 0 and 2000),
  -- White-label do cardápio público: cores e logotipo. Contraste é conferido na aplicação.
  theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.tenants is 'Estabelecimento contratante (tenant). is_demo marca dados fictícios.';

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  service_modes text[] not null default array['table']
    check (cardinality(service_modes) >= 1 and service_modes <@ array['table', 'pickup']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (tenant_id, id)
);

-- Papéis por tenant/unidade (PRD, seção 03). location_id nulo = todas as unidades do tenant.
create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  location_id uuid,
  user_id uuid not null references auth.users (id),
  role text not null check (role in ('owner', 'manager', 'attendant', 'kitchen')),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  -- O proprietário responde pelo tenant inteiro.
  check (role <> 'owner' or location_id is null),
  unique nulls not distinct (tenant_id, location_id, user_id, role)
);
create index tenant_memberships_user_idx on public.tenant_memberships (user_id, tenant_id) where status = 'active';

-- Equipe da ALVO Digital. Administrador não lê dados de clientes; suporte só com concessão ativa.
create table public.platform_staff (
  user_id uuid primary key references auth.users (id),
  role text not null check (role in ('admin', 'support')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Acesso de suporte: autorizado, com motivo, prazo curto e registro (PRD, seção 03).
create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  staff_user_id uuid not null references public.platform_staff (user_id),
  reason text not null check (length(btrim(reason)) between 10 and 500),
  granted_by uuid references auth.users (id),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at and expires_at <= starts_at + interval '72 hours')
);
create index support_access_grants_lookup_idx on public.support_access_grants (staff_user_id, tenant_id, expires_at);
create trigger support_access_grants_no_delete before delete or truncate on public.support_access_grants
  for each statement execute function private.no_delete();

create trigger tenants_updated_at before update on public.tenants for each row execute function private.set_updated_at();
create trigger locations_updated_at before update on public.locations for each row execute function private.set_updated_at();
create trigger tenant_memberships_updated_at before update on public.tenant_memberships for each row execute function private.set_updated_at();
create trigger platform_staff_updated_at before update on public.platform_staff for each row execute function private.set_updated_at();
create trigger tenants_no_delete before delete or truncate on public.tenants for each statement execute function private.no_delete();
create trigger locations_no_delete before delete or truncate on public.locations for each statement execute function private.no_delete();
create trigger tenant_memberships_no_delete before delete or truncate on public.tenant_memberships for each statement execute function private.no_delete();

-- ---------------------------------------------------------------------------------------------
-- Funções de autorização (usadas pelas políticas de RLS). SECURITY DEFINER para não depender
-- da RLS da própria tabela de vínculos; search_path vazio e nomes qualificados.
-- ---------------------------------------------------------------------------------------------

-- O usuário atual tem um dos papéis no tenant, valendo para a unidade informada?
-- p_location nulo: recurso do tenant inteiro (qualquer vínculo ativo com o papel serve).
create function private.has_role(p_tenant uuid, p_location uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships m
    where m.user_id = (select auth.uid())
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and m.role = any (p_roles)
      and (m.location_id is null or p_location is null or m.location_id = p_location)
  );
$$;

create function private.is_member(p_tenant uuid, p_location uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(p_tenant, p_location, array['owner', 'manager', 'attendant', 'kitchen']);
$$;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_staff s
    where s.user_id = (select auth.uid()) and s.role = 'admin' and s.active
  );
$$;

-- Suporte com concessão vigente para este tenant (somente leitura).
create function private.support_can_read(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.support_access_grants g
    join public.platform_staff s on s.user_id = g.staff_user_id and s.active
    where g.staff_user_id = (select auth.uid())
      and g.tenant_id = p_tenant
      and g.revoked_at is null
      and now() >= g.starts_at and now() < g.expires_at
  );
$$;

-- Leitura operacional: equipe com o papel certo na unidade, ou suporte autorizado.
create function private.can_read(p_tenant uuid, p_location uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(p_tenant, p_location, p_roles) or private.support_can_read(p_tenant);
$$;

grant execute on function private.has_role(uuid, uuid, text[]) to authenticated, service_role;
grant execute on function private.is_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.support_can_read(uuid) to authenticated, service_role;
grant execute on function private.can_read(uuid, uuid, text[]) to authenticated, service_role;
