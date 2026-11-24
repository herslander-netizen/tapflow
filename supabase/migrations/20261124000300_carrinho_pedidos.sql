-- TapFlow — 0300 carrinho, cotação, pedido e operação (cozinha e chamados da mesa).
-- O carrinho não é confiável: o preço final nasce na cotação do servidor e vira snapshot imutável
-- no pedido (PRD, seções 08 e 9.4).

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  guest_session_id uuid not null,
  status text not null default 'open' check (status in ('open', 'checked_out', 'abandoned', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, guest_session_id) references public.guest_sessions (tenant_id, id),
  unique (tenant_id, id)
);
create unique index carts_one_open_per_session on public.carts (guest_session_id) where status = 'open';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cart_id uuid not null,
  item_id uuid not null,
  quantity integer not null check (quantity between 1 and 99),
  modifier_ids uuid[] not null default '{}',
  notes text check (notes is null or length(notes) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, cart_id) references public.carts (tenant_id, id),
  foreign key (tenant_id, item_id) references public.menu_items (tenant_id, id),
  check (cardinality(modifier_ids) <= 30)
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- Cotação calculada no servidor, com prazo de validade (POST /checkout/quote).
create table public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  cart_id uuid not null,
  guest_session_id uuid not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) >= 1),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, cart_id) references public.carts (tenant_id, id),
  foreign key (tenant_id, guest_session_id) references public.guest_sessions (tenant_id, id),
  check (total_cents = subtotal_cents + fees_cents),
  unique (tenant_id, id)
);

-- ---------------------------------------------------------------------------------------------
-- Pedido
-- Estado operacional e estado financeiro são independentes (PRD 9.1 e 9.2).
-- ---------------------------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  table_id uuid,
  guest_session_id uuid,
  quote_id uuid not null unique,
  service_mode text not null check (service_mode in ('table', 'pickup')),
  -- Identificador curto para chamar na retirada; não dá acesso ao pedido.
  public_code text not null check (public_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'preparing', 'ready', 'completed', 'rejected', 'cancelled')),
  payment_mode text not null check (payment_mode in ('in_person', 'online')),
  payment_status text not null
    check (payment_status in ('not_required', 'pending', 'authorized', 'paid', 'failed', 'expired',
                              'refund_pending', 'refunded', 'partially_refunded')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  customer_name text check (customer_name is null or length(customer_name) <= 60),
  customer_note text check (customer_note is null or length(customer_note) <= 280),
  -- Concorrência otimista: cada transição exige a versão lida.
  version integer not null default 1,
  status_reason text check (status_reason is null or length(status_reason) <= 280),
  -- Credencial de acompanhamento restrita a este pedido; só o hash fica no banco.
  tracking_token_hash bytea not null unique check (length(tracking_token_hash) = 32),
  tracking_expires_at timestamptz not null,
  tracking_revoked_at timestamptz,
  is_demo boolean not null default false,
  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, location_id, table_id) references public.dining_tables (tenant_id, location_id, id),
  foreign key (tenant_id, guest_session_id) references public.guest_sessions (tenant_id, id),
  foreign key (tenant_id, quote_id) references public.checkout_quotes (tenant_id, id),
  check (total_cents = subtotal_cents + fees_cents),
  check (refunded_cents <= total_cents),
  check ((service_mode = 'table') = (table_id is not null)),
  check (payment_mode = 'online' or payment_status in ('not_required', 'refund_pending', 'refunded', 'partially_refunded')),
  unique (tenant_id, public_code),
  unique (tenant_id, id)
);
create index orders_queue_idx on public.orders (tenant_id, location_id, status, created_at desc);
create index orders_session_idx on public.orders (guest_session_id) where guest_session_id is not null;

-- Snapshot imutável: nome, preço unitário, adicionais, quantidade e subtotal do momento do pedido.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  item_id uuid not null,
  name_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  modifiers_total_cents integer not null default 0 check (modifiers_total_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_cents integer not null check (line_total_cents >= 0),
  notes text check (notes is null or length(notes) <= 280),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id),
  foreign key (tenant_id, item_id) references public.menu_items (tenant_id, id),
  check (line_total_cents = (unit_price_cents + modifiers_total_cents) * quantity),
  unique (tenant_id, id)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_item_id uuid not null,
  modifier_id uuid not null,
  group_name_snapshot text not null,
  name_snapshot text not null,
  price_delta_cents integer not null check (price_delta_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, order_item_id) references public.order_items (tenant_id, id),
  foreign key (tenant_id, modifier_id) references public.modifiers (tenant_id, id)
);
create index order_item_modifiers_item_idx on public.order_item_modifiers (order_item_id);

-- Trilha de transições: origem, ator, motivo e versão (PRD, seção 08, item 4).
create table public.order_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  order_id uuid not null,
  event_type text not null check (event_type ~ '^(order|payment|refund)\.[a-z_]+$'),
  from_status text,
  to_status text,
  actor_type text not null check (actor_type in ('staff', 'guest', 'system', 'psp', 'support')),
  actor_user_id uuid references auth.users (id),
  reason text check (reason is null or length(reason) <= 280),
  order_version integer not null,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id)
);
create index order_events_order_idx on public.order_events (order_id, id);

create table public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  order_id uuid not null unique,
  station text not null default 'cozinha' check (length(station) between 1 and 40),
  status text not null default 'queued' check (status in ('queued', 'preparing', 'ready', 'delivered', 'cancelled')),
  started_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id)
);
create index kitchen_tickets_queue_idx on public.kitchen_tickets (tenant_id, location_id, status, created_at);

-- Chamados da mesa (C08): chamar atendimento, pedir a conta, recuperar acesso ao pedido.
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  table_id uuid,
  guest_session_id uuid,
  kind text not null check (kind in ('call_staff', 'request_bill', 'recover_order')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'cancelled')),
  handled_by uuid references auth.users (id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, location_id, table_id) references public.dining_tables (tenant_id, location_id, id),
  foreign key (tenant_id, guest_session_id) references public.guest_sessions (tenant_id, id)
);
create index service_requests_open_idx on public.service_requests (tenant_id, location_id, created_at) where status in ('open', 'acknowledged');

create trigger carts_updated_at before update on public.carts for each row execute function private.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function private.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function private.set_updated_at();
create trigger kitchen_tickets_updated_at before update on public.kitchen_tickets for each row execute function private.set_updated_at();
create trigger service_requests_updated_at before update on public.service_requests for each row execute function private.set_updated_at();

create trigger orders_no_delete before delete or truncate on public.orders for each statement execute function private.no_delete();
create trigger checkout_quotes_no_delete before delete or truncate on public.checkout_quotes for each statement execute function private.no_delete();
create trigger kitchen_tickets_no_delete before delete or truncate on public.kitchen_tickets for each statement execute function private.no_delete();
create trigger service_requests_no_delete before delete or truncate on public.service_requests for each statement execute function private.no_delete();
create trigger order_items_append_only before update or delete or truncate on public.order_items for each statement execute function private.append_only();
create trigger order_item_modifiers_append_only before update or delete or truncate on public.order_item_modifiers for each statement execute function private.append_only();
create trigger order_events_append_only before update or delete or truncate on public.order_events for each statement execute function private.append_only();

-- O snapshot financeiro do pedido não muda depois de criado.
create function private.orders_freeze_snapshot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.tenant_id, new.location_id, new.table_id, new.guest_session_id, new.quote_id, new.service_mode,
      new.public_code, new.payment_mode, new.subtotal_cents, new.fees_cents, new.total_cents, new.currency,
      new.tracking_token_hash, new.is_demo, new.submitted_at)
     is distinct from
     (old.tenant_id, old.location_id, old.table_id, old.guest_session_id, old.quote_id, old.service_mode,
      old.public_code, old.payment_mode, old.subtotal_cents, old.fees_cents, old.total_cents, old.currency,
      old.tracking_token_hash, old.is_demo, old.submitted_at) then
    raise exception using errcode = 'P0001', message = 'snapshot_imutavel';
  end if;
  return new;
end $$;
create trigger orders_freeze_snapshot before update on public.orders
  for each row execute function private.orders_freeze_snapshot();
