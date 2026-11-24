-- TapFlow — 0500 permissões e RLS.
-- Regra geral: anon não lê nenhuma tabela (o cardápio público sai por public.public_menu);
-- authenticated só enxerga o próprio tenant/unidade conforme o papel; escrita sensível
-- (pedido, pagamento, token de mesa) só por funções. service_role é usado apenas pela API.

-- O Supabase concede tudo em public para anon/authenticated por padrão. Tiramos e concedemos
-- caso a caso.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------------------------------

grant select on public.tenants to authenticated;
grant update (name, theme, service_fee_bps) on public.tenants to authenticated;
create policy tenants_select on public.tenants for select to authenticated
  using (private.is_member(id) or private.support_can_read(id) or private.is_platform_admin());
create policy tenants_update_owner on public.tenants for update to authenticated
  using (private.has_role(id, null, array['owner']))
  with check (private.has_role(id, null, array['owner']));

grant select on public.locations to authenticated;
grant insert (tenant_id, slug, name, status, service_modes) on public.locations to authenticated;
grant update (slug, name, status, service_modes) on public.locations to authenticated;
create policy locations_select on public.locations for select to authenticated
  using (private.is_member(tenant_id, id) or private.support_can_read(tenant_id) or private.is_platform_admin());
create policy locations_insert_owner on public.locations for insert to authenticated
  with check (private.has_role(tenant_id, null, array['owner']));
create policy locations_update_owner on public.locations for update to authenticated
  using (private.has_role(tenant_id, null, array['owner']))
  with check (private.has_role(tenant_id, null, array['owner']));

grant select on public.tenant_memberships to authenticated;
grant insert (tenant_id, location_id, user_id, role, status, invited_by) on public.tenant_memberships to authenticated;
grant update (status) on public.tenant_memberships to authenticated;
create policy memberships_select on public.tenant_memberships for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_role(tenant_id, location_id, array['owner', 'manager'])
         or private.support_can_read(tenant_id));
-- Proprietário convida qualquer papel. Gerente só convida atendente/cozinha na própria unidade,
-- sem conseguir criar proprietário ou outro gerente.
create policy memberships_insert on public.tenant_memberships for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and status = 'invited'
    and (private.has_role(tenant_id, null, array['owner'])
         or (role in ('attendant', 'kitchen') and location_id is not null
             and private.has_role(tenant_id, location_id, array['manager'])))
  );
create policy memberships_update on public.tenant_memberships for update to authenticated
  using (
    user_id <> (select auth.uid())
    and (private.has_role(tenant_id, null, array['owner'])
         or (role in ('attendant', 'kitchen') and location_id is not null
             and private.has_role(tenant_id, location_id, array['manager'])))
  )
  with check (status in ('invited', 'revoked'));
-- Ativação do convite: o próprio convidado aceita (invited -> active).
create policy memberships_accept on public.tenant_memberships for update to authenticated
  using (user_id = (select auth.uid()) and status = 'invited')
  with check (user_id = (select auth.uid()) and status = 'active');

grant select on public.platform_staff to authenticated;
create policy platform_staff_select on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

grant select on public.support_access_grants to authenticated;
grant insert (tenant_id, staff_user_id, reason, granted_by, starts_at, expires_at) on public.support_access_grants to authenticated;
grant update (revoked_at) on public.support_access_grants to authenticated;
create policy support_grants_select on public.support_access_grants for select to authenticated
  using (staff_user_id = (select auth.uid())
         or private.has_role(tenant_id, null, array['owner'])
         or private.is_platform_admin());
create policy support_grants_insert_admin on public.support_access_grants for insert to authenticated
  with check (private.is_platform_admin() and granted_by = (select auth.uid()) and staff_user_id <> (select auth.uid()));
-- Proprietário ou administrador podem revogar a qualquer momento.
create policy support_grants_revoke on public.support_access_grants for update to authenticated
  using (private.is_platform_admin() or private.has_role(tenant_id, null, array['owner']))
  with check (revoked_at is not null);

-- ---------------------------------------------------------------------------------------------
-- Mesas
-- ---------------------------------------------------------------------------------------------

grant select on public.dining_tables to authenticated;
grant insert (tenant_id, location_id, public_number, label, status) on public.dining_tables to authenticated;
grant update (public_number, label, status) on public.dining_tables to authenticated;
create policy dining_tables_select on public.dining_tables for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager', 'attendant', 'kitchen']));
create policy dining_tables_insert on public.dining_tables for insert to authenticated
  with check (private.has_role(tenant_id, location_id, array['owner', 'manager']));
create policy dining_tables_update on public.dining_tables for update to authenticated
  using (private.has_role(tenant_id, location_id, array['owner', 'manager']))
  with check (private.has_role(tenant_id, location_id, array['owner', 'manager']));

-- Token novo só por public.rotate_table_token; aqui só se vê hash/dica e situação.
grant select (id, tenant_id, location_id, table_id, token_hint, expires_at, revoked_at, revoked_reason, created_by, created_at)
  on public.table_access_tokens to authenticated;
create policy table_tokens_select on public.table_access_tokens for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager']));

grant select (id, tenant_id, location_id, table_id, service_mode, origin, expires_at, revoked_at, last_seen_at, created_at)
  on public.guest_sessions to authenticated;
create policy guest_sessions_select on public.guest_sessions for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager', 'attendant']));

-- ---------------------------------------------------------------------------------------------
-- Cardápio (do tenant inteiro). Equipe lê; proprietário e gerente editam. Disponibilidade
-- operacional pela equipe toda via public.set_item_availability.
-- ---------------------------------------------------------------------------------------------

grant select on public.menu_categories, public.menu_items, public.item_media,
  public.modifier_groups, public.modifiers, public.item_modifier_groups to authenticated;
grant insert, update on public.menu_categories, public.modifier_groups, public.modifiers to authenticated;
grant insert (tenant_id, category_id, name, description, ingredients, allergens, price_cents, visibility,
              availability, stock_quantity, position) on public.menu_items to authenticated;
grant update (category_id, name, description, ingredients, allergens, price_cents, visibility,
              availability, stock_quantity, position) on public.menu_items to authenticated;
grant insert (tenant_id, item_id, kind, storage_path, mime_type, width, height, duration_ms, bytes, position)
  on public.item_media to authenticated;
grant update (status, position) on public.item_media to authenticated;
grant insert, delete on public.item_modifier_groups to authenticated;

do $$
declare t text;
begin
  foreach t in array array['menu_categories', 'menu_items', 'item_media', 'modifier_groups', 'modifiers', 'item_modifier_groups'] loop
    execute format($p$create policy %1$s_select on public.%1$I for select to authenticated
      using (private.is_member(tenant_id) or private.support_can_read(tenant_id))$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (private.has_role(tenant_id, null, array['owner', 'manager']))$p$, t);
  end loop;
  foreach t in array array['menu_categories', 'menu_items', 'item_media', 'modifier_groups', 'modifiers'] loop
    execute format($p$create policy %1$s_update on public.%1$I for update to authenticated
      using (private.has_role(tenant_id, null, array['owner', 'manager']))
      with check (private.has_role(tenant_id, null, array['owner', 'manager']))$p$, t);
  end loop;
end $$;
create policy item_modifier_groups_delete on public.item_modifier_groups for delete to authenticated
  using (private.has_role(tenant_id, null, array['owner', 'manager']));
-- Mídia nova entra como "processing"; "ready" só depois da validação do arquivo pela API.
create policy item_media_insert_processing on public.item_media as restrictive for insert to authenticated
  with check (status = 'processing');
create policy item_media_update_not_ready on public.item_media as restrictive for update to authenticated
  using (true)
  with check (status <> 'ready');

-- ---------------------------------------------------------------------------------------------
-- Carrinho e cotação: só a API (service_role). Nenhuma concessão a anon/authenticated.
-- Pedido e operação: leitura pela equipe da unidade; mudanças por public.transition_order.
-- ---------------------------------------------------------------------------------------------

grant select (id, tenant_id, location_id, table_id, guest_session_id, service_mode, public_code, status,
              payment_mode, payment_status, subtotal_cents, fees_cents, total_cents, refunded_cents, currency,
              customer_name, customer_note, version, status_reason, is_demo, submitted_at, accepted_at,
              ready_at, completed_at, closed_at, created_at, updated_at)
  on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager', 'attendant', 'kitchen']));

grant select on public.order_items, public.order_item_modifiers, public.order_events, public.kitchen_tickets to authenticated;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_item_modifiers_select on public.order_item_modifiers for select to authenticated
  using (exists (select 1 from public.order_items oi where oi.id = order_item_id));
create policy order_events_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy kitchen_tickets_select on public.kitchen_tickets for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager', 'attendant', 'kitchen']));

grant select on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;
create policy service_requests_select on public.service_requests for select to authenticated
  using (private.can_read(tenant_id, location_id, array['owner', 'manager', 'attendant']));
create policy service_requests_update on public.service_requests for update to authenticated
  using (private.has_role(tenant_id, location_id, array['owner', 'manager', 'attendant']))
  with check (private.has_role(tenant_id, location_id, array['owner', 'manager', 'attendant']));

-- ---------------------------------------------------------------------------------------------
-- Pagamentos: proprietário e gerente da unidade (cozinha e atendimento não veem dados financeiros
-- além do payment_status do pedido). Escrita só pela API.
-- ---------------------------------------------------------------------------------------------

grant select on public.payment_intents, public.payment_events, public.refunds to authenticated;
create policy payment_intents_select on public.payment_intents for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and private.can_read(o.tenant_id, o.location_id, array['owner', 'manager'])));
create policy payment_events_select on public.payment_events for select to authenticated
  using (exists (select 1 from public.payment_intents p where p.id = payment_intent_id));
create policy refunds_select on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and private.can_read(o.tenant_id, o.location_id, array['owner', 'manager'])));

-- webhook_inbox, outbox_events, idempotency_keys, privacy_safe_events: sem acesso fora da API.

-- ---------------------------------------------------------------------------------------------
-- Auditoria, SaaS e métricas
-- ---------------------------------------------------------------------------------------------

grant select on public.audit_log to authenticated;
create policy audit_log_select_owner on public.audit_log for select to authenticated
  using (tenant_id is not null and private.has_role(tenant_id, null, array['owner']));

grant select on public.security_events to authenticated;
create policy security_events_select_admin on public.security_events for select to authenticated
  using (private.is_platform_admin());

grant select on public.subscriptions, public.usage_counters, public.tenant_integrations to authenticated;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.has_role(tenant_id, null, array['owner']) or private.is_platform_admin());
create policy usage_counters_select on public.usage_counters for select to authenticated
  using (private.has_role(tenant_id, null, array['owner']) or private.is_platform_admin());
create policy tenant_integrations_select on public.tenant_integrations for select to authenticated
  using (private.has_role(tenant_id, null, array['owner']) or private.is_platform_admin());

grant select on public.daily_metrics to authenticated;
create policy daily_metrics_select on public.daily_metrics for select to authenticated
  using (private.has_role(tenant_id, location_id, array['owner', 'manager']));
