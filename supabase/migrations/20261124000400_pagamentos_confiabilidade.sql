-- TapFlow — 0400 pagamentos, confiabilidade (inbox, outbox, idempotência), auditoria, SaaS e analytics.
-- Nenhum PSP está integrado. "paid" só é gravado por servico.record_payment_event a partir de um
-- evento com assinatura verificada pela API (PRD 9.2). Não há número de cartão, CVV ou segredo aqui.

-- ---------------------------------------------------------------------------------------------
-- Pagamento
-- ---------------------------------------------------------------------------------------------

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  provider text not null check (provider in ('mercado_pago', 'asaas', 'sandbox')),
  provider_reference text not null check (length(provider_reference) between 1 and 200),
  method text not null check (method in ('pix', 'card')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'paid', 'failed', 'expired', 'cancelled')),
  attempt integer not null check (attempt >= 1),
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id),
  unique (provider, provider_reference),
  unique (order_id, attempt),
  unique (tenant_id, id)
);
-- Uma tentativa em aberto por pedido.
create unique index payment_intents_one_open on public.payment_intents (order_id) where status in ('pending', 'authorized');

create table public.payment_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  payment_intent_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  status text not null,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  applied boolean not null,
  note text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  foreign key (tenant_id, payment_intent_id) references public.payment_intents (tenant_id, id),
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  payment_intent_id uuid,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested', 'pending', 'completed', 'failed')),
  reason text not null check (length(btrim(reason)) between 3 and 280),
  requested_by uuid references auth.users (id),
  provider_refund_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id),
  foreign key (tenant_id, payment_intent_id) references public.payment_intents (tenant_id, id)
);

-- ---------------------------------------------------------------------------------------------
-- Confiabilidade
-- ---------------------------------------------------------------------------------------------

-- Webhooks recebidos, deduplicados por provedor + id do evento.
create table public.webhook_inbox (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id),
  provider text not null,
  provider_event_id text not null check (length(provider_event_id) between 1 and 200),
  signature_valid boolean not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

-- Eventos a publicar (notificações, realtime, integrações). Falha de envio não apaga o pedido.
create table public.outbox_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  aggregate_type text not null check (aggregate_type in ('order', 'payment', 'refund', 'table', 'media')),
  aggregate_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z]+\.[a-z_]+$'),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dead')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_events_pending_idx on public.outbox_events (next_attempt_at) where status in ('pending', 'failed');

-- Chave de idempotência por escopo; repete a resposta da tentativa original.
create table public.idempotency_keys (
  tenant_id uuid not null references public.tenants (id),
  scope text not null check (scope in ('place_order', 'start_payment')),
  key text not null check (length(key) between 16 and 200),
  request_hash bytea not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (tenant_id, scope, key)
);

-- ---------------------------------------------------------------------------------------------
-- Auditoria (append-only)
-- ---------------------------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id),
  actor_type text not null check (actor_type in ('staff', 'guest', 'system', 'psp', 'support', 'platform')),
  actor_user_id uuid references auth.users (id),
  action text not null,
  resource_type text not null,
  resource_id text,
  result text not null check (result in ('success', 'denied', 'error')),
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);

create table public.security_events (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id),
  kind text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  -- Nunca IP puro: só hash com sal guardado fora do banco.
  source_hash text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- SaaS
-- ---------------------------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  plan_code text not null check (plan_code ~ '^[a-z0-9_]{2,40}$'),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  -- Limites do plano (ADR-010 pendente), ex.: {"video_minutes": 0, "items": 50}.
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_one_current on public.subscriptions (tenant_id) where status <> 'cancelled';

create table public.usage_counters (
  tenant_id uuid not null references public.tenants (id),
  metric text not null check (metric in ('orders', 'media_bytes_stored', 'media_bytes_delivered', 'video_seconds_delivered', 'uploads')),
  period date not null,
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, metric, period)
);

-- Integrações configuradas. Segredos ficam fora das tabelas (cofre/variáveis do servidor);
-- aqui só o nome da referência.
create table public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  kind text not null check (kind in ('psp', 'storage', 'video', 'notifications')),
  provider text not null,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  secret_ref text check (secret_ref is null or secret_ref ~ '^[A-Za-z0-9_./-]{3,120}$'),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kind, provider, environment),
  -- Defesa simples contra segredo colado na configuração.
  check (not (config ?| array['secret', 'api_key', 'access_token', 'password', 'private_key', 'client_secret']))
);

-- ---------------------------------------------------------------------------------------------
-- Analytics sem dados pessoais (ADR-001, "Medição")
-- ---------------------------------------------------------------------------------------------

create table public.privacy_safe_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  location_id uuid,
  event_name text not null check (event_name in ('menu_opened', 'item_impression', 'item_detail_opened', 'item_added',
    'checkout_started', 'order_submitted', 'order_accepted', 'order_completed', 'media_bytes_delivered')),
  -- Referência de sessão já anonimizada pela API (hash com sal rotativo), nunca o token.
  session_ref text check (session_ref is null or session_ref ~ '^[a-f0-9]{16,64}$'),
  origin text check (origin in ('nfc', 'qr', 'link')),
  navigation text check (navigation in ('feed', 'list')),
  item_id uuid,
  media_bytes bigint check (media_bytes is null or media_bytes >= 0),
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, item_id) references public.menu_items (tenant_id, id)
);
create index privacy_safe_events_tenant_idx on public.privacy_safe_events (tenant_id, occurred_at);

create table public.daily_metrics (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  location_id uuid,
  day date not null,
  metric text not null,
  origin text not null default 'all',
  navigation text not null default 'all',
  value bigint not null default 0,
  unique nulls not distinct (tenant_id, day, metric, origin, navigation, location_id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id)
);

create trigger payment_intents_updated_at before update on public.payment_intents for each row execute function private.set_updated_at();
create trigger refunds_updated_at before update on public.refunds for each row execute function private.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function private.set_updated_at();
create trigger tenant_integrations_updated_at before update on public.tenant_integrations for each row execute function private.set_updated_at();

create trigger payment_intents_no_delete before delete or truncate on public.payment_intents for each statement execute function private.no_delete();
create trigger refunds_no_delete before delete or truncate on public.refunds for each statement execute function private.no_delete();
create trigger webhook_inbox_no_delete before delete or truncate on public.webhook_inbox for each statement execute function private.no_delete();
create trigger payment_events_append_only before update or delete or truncate on public.payment_events for each statement execute function private.append_only();
create trigger audit_log_append_only before update or delete or truncate on public.audit_log for each statement execute function private.append_only();
create trigger security_events_append_only before update or delete or truncate on public.security_events for each statement execute function private.append_only();
