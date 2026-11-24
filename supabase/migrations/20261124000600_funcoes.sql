-- TapFlow — 0600 funções de domínio.
-- public.*  : chamadas pelo app (anon para catálogo/mesa/acompanhamento; authenticated para equipe).
-- servico.* : chamadas só pela API com service_role (sessão de convidado, cotação, pedido, pagamento).
-- Erros de negócio saem com errcode P0001 e mensagem curta em português (código estável para a API).

create function private.fail(p_code text, p_detail text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end $$;

create function private.audit(p_tenant uuid, p_actor_type text, p_action text, p_resource_type text,
                              p_resource_id text, p_result text default 'success', p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (tenant_id, actor_type, actor_user_id, action, resource_type, resource_id, result, metadata)
  values (p_tenant, p_actor_type, (select auth.uid()), p_action, p_resource_type, p_resource_id, p_result, p_metadata);
$$;

create function private.outbox(p_tenant uuid, p_aggregate_type text, p_aggregate_id uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
  values (p_tenant, p_aggregate_type, p_aggregate_id, p_event, p_payload);
$$;

-- Código de retirada: 6 caracteres sem 0/O/1/I.
create function private.public_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

-- ---------------------------------------------------------------------------------------------
-- Público (anon): mesa e cardápio
-- ---------------------------------------------------------------------------------------------

-- Resolve o token da URL do QR/NFC. Devolve só o necessário para a tela C01; nulo se o token
-- não existir, estiver revogado/vencido ou a unidade não estiver aberta.
create function public.resolve_table(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object('slug', t.slug, 'name', t.name, 'theme', t.theme, 'is_demo', t.is_demo),
    'location', jsonb_build_object('slug', l.slug, 'name', l.name, 'service_modes', to_jsonb(l.service_modes)),
    'table', jsonb_build_object('number', d.public_number, 'label', d.label))
  from public.table_access_tokens k
  join public.dining_tables d on d.id = k.table_id and d.status = 'active'
  join public.locations l on l.id = d.location_id and l.status = 'active'
  join public.tenants t on t.id = d.tenant_id and t.status = 'active'
  where length(coalesce(p_token, '')) between 32 and 128
    and k.token_hash = private.hash_token(p_token)
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());
$$;

-- Catálogo público de uma unidade: só categorias e itens publicados, mídia pronta e adicionais
-- publicados. Não expõe estoque, ids de usuários nem nada operacional (PRD, seção 08, item 8).
create function public.public_menu(p_tenant_slug text, p_location_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ctx as (
    select t.id as tenant_id, t.slug, t.name, t.theme, t.is_demo, t.service_fee_bps, l.slug as location_slug,
           l.name as location_name, l.service_modes
    from public.tenants t
    join public.locations l on l.tenant_id = t.id and l.slug = p_location_slug and l.status = 'active'
    where t.slug = p_tenant_slug and t.status = 'active'
  )
  select jsonb_build_object(
    'tenant', jsonb_build_object('slug', c.slug, 'name', c.name, 'theme', c.theme, 'is_demo', c.is_demo,
                                 'service_fee_bps', c.service_fee_bps, 'currency', 'BRL'),
    'location', jsonb_build_object('slug', c.location_slug, 'name', c.location_name, 'service_modes', to_jsonb(c.service_modes)),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mc.id, 'name', mc.name,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', mi.id, 'name', mi.name, 'description', mi.description, 'ingredients', mi.ingredients,
            'allergens', to_jsonb(mi.allergens), 'price_cents', mi.price_cents,
            'available', mi.availability = 'available' and coalesce(mi.stock_quantity, 1) > 0,
            'media', coalesce((
              select jsonb_agg(jsonb_build_object('kind', m.kind, 'path', m.storage_path, 'mime_type', m.mime_type,
                                                  'width', m.width, 'height', m.height, 'duration_ms', m.duration_ms)
                               order by m.position, m.created_at)
              from public.item_media m where m.item_id = mi.id and m.status = 'ready'), '[]'::jsonb),
            'modifier_groups', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', g.id, 'name', g.name, 'min', g.min_select, 'max', g.max_select,
                'options', coalesce((
                  select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price_delta_cents', o.price_delta_cents,
                                                      'available', o.availability = 'available')
                                   order by o.position, o.name)
                  from public.modifiers o where o.group_id = g.id and o.visibility = 'published'), '[]'::jsonb))
                order by img.position)
              from public.item_modifier_groups img join public.modifier_groups g on g.id = img.group_id
              where img.item_id = mi.id), '[]'::jsonb))
            order by mi.position, mi.name)
          from public.menu_items mi
          where mi.category_id = mc.id and mi.visibility = 'published'), '[]'::jsonb))
        order by mc.position, mc.name)
      from public.menu_categories mc
      where mc.tenant_id = c.tenant_id and mc.visibility = 'published'), '[]'::jsonb))
  from ctx c;
$$;

-- Acompanhamento pelo cliente com o token do pedido (C07). Sem nomes da equipe.
create function public.track_order(p_tracking_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'public_code', o.public_code, 'status', o.status, 'payment_status', o.payment_status,
    'payment_mode', o.payment_mode, 'service_mode', o.service_mode, 'status_reason', o.status_reason,
    'total_cents', o.total_cents, 'refunded_cents', o.refunded_cents, 'currency', o.currency,
    'version', o.version, 'is_demo', o.is_demo, 'submitted_at', o.submitted_at,
    'tenant', jsonb_build_object('name', t.name, 'slug', t.slug),
    'table', (select d.public_number from public.dining_tables d where d.id = o.table_id),
    'items', (select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity,
                                                  'line_total_cents', oi.line_total_cents,
                                                  'modifiers', (select coalesce(jsonb_agg(m.name_snapshot), '[]'::jsonb)
                                                                from public.order_item_modifiers m where m.order_item_id = oi.id))
                               order by oi.position)
              from public.order_items oi where oi.order_id = o.id),
    'timeline', (select jsonb_agg(jsonb_build_object('event', e.event_type, 'status', e.to_status, 'at', e.created_at) order by e.id)
                 from public.order_events e where e.order_id = o.id))
  from public.orders o join public.tenants t on t.id = o.tenant_id
  where length(coalesce(p_tracking_token, '')) between 32 and 128
    and o.tracking_token_hash = private.hash_token(p_tracking_token)
    and o.tracking_revoked_at is null
    and o.tracking_expires_at > now();
$$;

-- ---------------------------------------------------------------------------------------------
-- Equipe (authenticated)
-- ---------------------------------------------------------------------------------------------

-- Gera token novo para a mesa e revoga o anterior. O token puro só aparece nesta resposta.
create function public.rotate_table_token(p_table_id uuid, p_reason text default 'rotação') returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_table public.dining_tables;
  v_token text := private.random_token();
begin
  select * into v_table from public.dining_tables where id = p_table_id;
  if v_table.id is null or not private.has_role(v_table.tenant_id, v_table.location_id, array['owner', 'manager']) then
    perform private.fail('sem_permissao');
  end if;
  update public.table_access_tokens
     set revoked_at = now(), revoked_reason = left(coalesce(p_reason, 'rotação'), 120)
   where table_id = p_table_id and revoked_at is null;
  insert into public.table_access_tokens (tenant_id, location_id, table_id, token_hash, token_hint, created_by)
  values (v_table.tenant_id, v_table.location_id, v_table.id, private.hash_token(v_token), right(v_token, 4), auth.uid());
  perform private.outbox(v_table.tenant_id, 'table', v_table.id, 'table.token_rotated', jsonb_build_object('table_id', v_table.id));
  perform private.audit(v_table.tenant_id, 'staff', 'table.token_rotated', 'dining_table', v_table.id::text);
  return jsonb_build_object('table_id', v_table.id, 'token', v_token, 'hint', right(v_token, 4));
end $$;

-- Esgotar/voltar um item: qualquer pessoa da equipe (cozinha inclusive), sem poder mexer em preço.
create function public.set_item_availability(p_item_id uuid, p_availability text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  if p_availability not in ('available', 'sold_out') then perform private.fail('valor_invalido'); end if;
  select tenant_id into v_tenant from public.menu_items where id = p_item_id;
  if v_tenant is null or not private.is_member(v_tenant) then perform private.fail('sem_permissao'); end if;
  update public.menu_items set availability = p_availability where id = p_item_id;
  perform private.audit(v_tenant, 'staff', 'menu_item.availability', 'menu_item', p_item_id::text, 'success',
                        jsonb_build_object('availability', p_availability));
end $$;

-- Máquina de estados do pedido (PRD 9.1). A função é a autoridade das transições.
create function public.transition_order(p_order_id uuid, p_to text, p_expected_version integer, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_roles text[];
  v_needs_reason boolean := false;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_paid integer;
  v_from text;
begin
  if auth.uid() is null then perform private.fail('sem_permissao'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or not private.is_member(v_order.tenant_id, v_order.location_id) then
    perform private.fail('pedido_nao_encontrado');
  end if;
  if v_order.version <> p_expected_version then
    perform private.fail('versao_conflitante', format('versão atual %s', v_order.version));
  end if;

  v_roles := case
    when v_order.status = 'submitted' and p_to = 'accepted' then array['owner', 'manager', 'attendant']
    when v_order.status = 'submitted' and p_to = 'rejected' then array['owner', 'manager', 'attendant']
    when v_order.status = 'accepted' and p_to = 'preparing' then array['owner', 'manager', 'attendant', 'kitchen']
    when v_order.status = 'preparing' and p_to = 'ready' then array['owner', 'manager', 'attendant', 'kitchen']
    when v_order.status = 'ready' and p_to = 'completed' then array['owner', 'manager', 'attendant']
    when v_order.status in ('submitted', 'accepted') and p_to = 'cancelled' then array['owner', 'manager', 'attendant']
    when v_order.status = 'preparing' and p_to = 'cancelled' then array['owner', 'manager']
    else null end;
  if v_roles is null then
    perform private.fail('transicao_invalida', format('%s -> %s', v_order.status, p_to));
  end if;
  if not private.has_role(v_order.tenant_id, v_order.location_id, v_roles) then
    -- A recusa desfaz a transação, então o registro de "denied" fica a cargo da API (log estruturado).
    perform private.fail('sem_permissao');
  end if;
  v_needs_reason := p_to in ('rejected', 'cancelled');
  if v_needs_reason and (v_reason is null or length(v_reason) < 3) then perform private.fail('motivo_obrigatorio'); end if;
  v_from := v_order.status;

  update public.orders set
    status = p_to,
    version = version + 1,
    status_reason = case when v_needs_reason then left(v_reason, 280) else status_reason end,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    ready_at = case when p_to = 'ready' then now() else ready_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    closed_at = case when p_to in ('completed', 'rejected', 'cancelled') then now() else closed_at end
  where id = v_order.id
  returning * into v_order;

  -- Cozinha
  if p_to = 'accepted' then
    insert into public.kitchen_tickets (tenant_id, location_id, order_id) values (v_order.tenant_id, v_order.location_id, v_order.id);
  else
    update public.kitchen_tickets set
      status = case p_to when 'preparing' then 'preparing' when 'ready' then 'ready' when 'completed' then 'delivered' else 'cancelled' end,
      started_at = case when p_to = 'preparing' then now() else started_at end,
      ready_at = case when p_to = 'ready' then now() else ready_at end
    where order_id = v_order.id;
  end if;

  if p_to in ('rejected', 'cancelled') then
    -- Devolve o estoque reservado.
    update public.menu_items mi set stock_quantity = mi.stock_quantity + q.qty
      from (select item_id, sum(quantity) as qty from public.order_items where order_id = v_order.id group by item_id) q
     where mi.id = q.item_id and mi.stock_quantity is not null;
    -- Pago e depois rejeitado/cancelado: abre reembolso; nada é apagado (PRD 5.4, item 4).
    if v_order.payment_status in ('paid', 'authorized') then
      select coalesce(sum(amount_cents), 0) into v_paid from public.payment_intents where order_id = v_order.id and status in ('paid', 'authorized');
      if v_paid - v_order.refunded_cents > 0 then
        insert into public.refunds (tenant_id, order_id, payment_intent_id, amount_cents, reason, requested_by)
        values (v_order.tenant_id, v_order.id,
                (select id from public.payment_intents where order_id = v_order.id and status in ('paid', 'authorized') order by attempt desc limit 1),
                v_paid - v_order.refunded_cents, left(v_reason, 280), auth.uid());
        update public.orders set payment_status = 'refund_pending' where id = v_order.id returning * into v_order;
        perform private.outbox(v_order.tenant_id, 'refund', v_order.id, 'refund.requested',
                               jsonb_build_object('order_id', v_order.id, 'amount_cents', v_paid - v_order.refunded_cents));
      end if;
    end if;
  end if;

  insert into public.order_events (tenant_id, order_id, event_type, from_status, to_status, actor_type, actor_user_id, reason, order_version)
  values (v_order.tenant_id, v_order.id, 'order.' || p_to,
          v_from, p_to, 'staff', auth.uid(), case when v_needs_reason then left(v_reason, 280) end, v_order.version);
  perform private.outbox(v_order.tenant_id, 'order', v_order.id, 'order.' || p_to,
                         jsonb_build_object('order_id', v_order.id, 'status', p_to, 'version', v_order.version));
  perform private.audit(v_order.tenant_id, 'staff', 'order.' || p_to, 'order', v_order.id::text);
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'payment_status', v_order.payment_status,
                            'version', v_order.version);
end $$;

-- ---------------------------------------------------------------------------------------------
-- API (service_role)
-- ---------------------------------------------------------------------------------------------

-- Abre a sessão anônima do cliente e o carrinho. Mesa: pelo token do QR/NFC. Retirada: pela unidade.
create function servico.create_guest_session(p_table_token text, p_tenant_slug text default null,
                                             p_location_slug text default null, p_origin text default 'link')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tenant uuid; v_location uuid; v_table uuid; v_mode text; v_modes text[];
  v_token text := private.random_token();
  v_session uuid; v_cart uuid; v_expires timestamptz := now() + interval '4 hours';
begin
  if p_origin not in ('nfc', 'qr', 'link') then perform private.fail('valor_invalido'); end if;
  if p_table_token is not null then
    select d.tenant_id, d.location_id, d.id, l.service_modes into v_tenant, v_location, v_table, v_modes
    from public.table_access_tokens k
    join public.dining_tables d on d.id = k.table_id and d.status = 'active'
    join public.locations l on l.id = d.location_id and l.status = 'active'
    join public.tenants t on t.id = d.tenant_id and t.status = 'active'
    where k.token_hash = private.hash_token(p_table_token) and k.revoked_at is null
      and (k.expires_at is null or k.expires_at > now());
    if v_table is null then perform private.fail('mesa_invalida'); end if;
    if not ('table' = any (v_modes)) then perform private.fail('modalidade_indisponivel'); end if;
    v_mode := 'table';
  else
    select t.id, l.id, l.service_modes into v_tenant, v_location, v_modes
    from public.tenants t join public.locations l on l.tenant_id = t.id
    where t.slug = p_tenant_slug and l.slug = p_location_slug and t.status = 'active' and l.status = 'active';
    if v_location is null then perform private.fail('unidade_indisponivel'); end if;
    if not ('pickup' = any (v_modes)) then perform private.fail('modalidade_indisponivel'); end if;
    v_mode := 'pickup';
  end if;

  insert into public.guest_sessions (tenant_id, location_id, table_id, service_mode, origin, session_token_hash, expires_at)
  values (v_tenant, v_location, v_table, v_mode, p_origin, private.hash_token(v_token), v_expires)
  returning id into v_session;
  insert into public.carts (tenant_id, location_id, guest_session_id) values (v_tenant, v_location, v_session)
  returning id into v_cart;
  return jsonb_build_object('session_id', v_session, 'session_token', v_token, 'cart_id', v_cart,
                            'service_mode', v_mode, 'expires_at', v_expires);
end $$;

create function private.session_from_token(p_session_token text) returns public.guest_sessions
language sql stable security definer set search_path = '' as $$
  select s.* from public.guest_sessions s
  where s.session_token_hash = private.hash_token(coalesce(p_session_token, ''))
    and s.revoked_at is null and s.expires_at > now();
$$;

-- Cotação no servidor (POST /checkout/quote). Ignora qualquer preço vindo do cliente.
create function servico.quote_cart(p_session_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session public.guest_sessions := private.session_from_token(p_session_token);
  v_cart public.carts;
  v_fee_bps integer;
  v_line record;
  v_group record;
  v_mods jsonb;
  v_mod_total integer;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_fees integer;
  v_quote uuid;
  v_expires timestamptz := now() + interval '10 minutes';
  v_bad uuid;
begin
  if v_session.id is null then perform private.fail('sessao_expirada'); end if;
  select * into v_cart from public.carts where guest_session_id = v_session.id and status = 'open';
  if v_cart.id is null or not exists (select 1 from public.cart_items where cart_id = v_cart.id) then
    perform private.fail('carrinho_vazio');
  end if;
  select service_fee_bps into v_fee_bps from public.tenants where id = v_cart.tenant_id;

  -- Estoque somado por item no carrinho inteiro.
  select ci.item_id into v_bad
  from public.cart_items ci join public.menu_items mi on mi.id = ci.item_id
  where ci.cart_id = v_cart.id and mi.stock_quantity is not null
  group by ci.item_id, mi.stock_quantity having sum(ci.quantity) > mi.stock_quantity limit 1;
  if v_bad is not null then perform private.fail('item_esgotado', v_bad::text); end if;

  for v_line in
    select ci.id, ci.item_id, ci.quantity, ci.notes, ci.modifier_ids, mi.name, mi.price_cents, mi.price_version,
           mi.visibility, mi.availability, mi.tenant_id, mc.visibility as category_visibility
    from public.cart_items ci
    join public.menu_items mi on mi.id = ci.item_id and mi.tenant_id = v_cart.tenant_id
    join public.menu_categories mc on mc.id = mi.category_id
    where ci.cart_id = v_cart.id
    order by ci.created_at, ci.id
  loop
    if v_line.visibility <> 'published' or v_line.category_visibility <> 'published' then
      perform private.fail('item_indisponivel', v_line.item_id::text);
    end if;
    if v_line.availability <> 'available' then perform private.fail('item_esgotado', v_line.item_id::text); end if;
    if cardinality(v_line.modifier_ids) <> (select count(distinct x) from unnest(v_line.modifier_ids) x) then
      perform private.fail('adicional_repetido', v_line.item_id::text);
    end if;

    -- Todo adicional escolhido precisa pertencer a um grupo ligado ao item, estar publicado e disponível.
    if exists (
      select 1 from unnest(v_line.modifier_ids) as sel(id)
      where not exists (
        select 1 from public.modifiers m
        join public.item_modifier_groups img on img.group_id = m.group_id and img.item_id = v_line.item_id
        where m.id = sel.id and m.visibility = 'published' and m.availability = 'available')
    ) then
      perform private.fail('adicional_invalido', v_line.item_id::text);
    end if;

    -- Mínimo e máximo por grupo.
    for v_group in
      select g.id, g.name, g.min_select, g.max_select,
             (select count(*) from public.modifiers m where m.group_id = g.id and m.id = any (v_line.modifier_ids)) as chosen
      from public.item_modifier_groups img join public.modifier_groups g on g.id = img.group_id
      where img.item_id = v_line.item_id
    loop
      if v_group.chosen < v_group.min_select or v_group.chosen > v_group.max_select then
        perform private.fail('adicionais_fora_do_limite', format('%s: %s (mín. %s, máx. %s)', v_group.name, v_group.chosen, v_group.min_select, v_group.max_select));
      end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('modifier_id', m.id, 'name', m.name, 'group_name', g.name,
                                                 'price_delta_cents', m.price_delta_cents) order by g.name, m.position, m.name), '[]'::jsonb),
           coalesce(sum(m.price_delta_cents), 0)
      into v_mods, v_mod_total
    from public.modifiers m join public.modifier_groups g on g.id = m.group_id
    where m.id = any (v_line.modifier_ids);

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'item_id', v_line.item_id, 'name', v_line.name, 'unit_price_cents', v_line.price_cents,
      'price_version', v_line.price_version, 'modifiers', v_mods, 'modifiers_total_cents', v_mod_total,
      'quantity', v_line.quantity, 'notes', v_line.notes,
      'line_total_cents', (v_line.price_cents + v_mod_total) * v_line.quantity));
    v_subtotal := v_subtotal + (v_line.price_cents + v_mod_total)::bigint * v_line.quantity;
  end loop;

  if v_subtotal > 2000000000 then perform private.fail('valor_excedido'); end if;
  v_fees := round(v_subtotal * v_fee_bps / 10000.0);
  insert into public.checkout_quotes (tenant_id, location_id, cart_id, guest_session_id, subtotal_cents, fees_cents,
                                      total_cents, lines, expires_at)
  values (v_cart.tenant_id, v_cart.location_id, v_cart.id, v_session.id, v_subtotal, v_fees, v_subtotal + v_fees, v_lines, v_expires)
  returning id into v_quote;
  return jsonb_build_object('quote_id', v_quote, 'subtotal_cents', v_subtotal, 'fees_cents', v_fees,
                            'total_cents', v_subtotal + v_fees, 'currency', 'BRL', 'expires_at', v_expires, 'lines', v_lines);
end $$;

-- Confirma o pedido (POST /orders) a partir da cotação, com Idempotency-Key. Revalida preço,
-- disponibilidade e estoque dentro da transação; reenvio com a mesma chave devolve a mesma resposta.
create function servico.place_order(p_session_token text, p_quote_id uuid, p_idempotency_key text,
                                    p_payment_mode text, p_customer_name text default null, p_customer_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session public.guest_sessions := private.session_from_token(p_session_token);
  v_quote public.checkout_quotes;
  v_hash bytea;
  v_existing public.idempotency_keys;
  v_line jsonb;
  v_mod jsonb;
  v_item public.menu_items;
  v_order_id uuid;
  v_order_item uuid;
  v_code text;
  v_tracking text := private.random_token();
  v_response jsonb;
  v_pos integer := 0;
  v_is_demo boolean;
begin
  if v_session.id is null then perform private.fail('sessao_expirada'); end if;
  if p_payment_mode not in ('in_person', 'online') then perform private.fail('valor_invalido'); end if;
  if length(coalesce(p_idempotency_key, '')) not between 16 and 200 then perform private.fail('chave_idempotencia_invalida'); end if;

  v_hash := sha256(convert_to(concat_ws('|', v_session.id, p_quote_id, p_payment_mode, p_customer_name, p_customer_note), 'UTF8'));

  -- Reserva a chave. Uma segunda chamada simultânea espera esta transação terminar.
  insert into public.idempotency_keys (tenant_id, scope, key, request_hash)
  values (v_session.tenant_id, 'place_order', p_idempotency_key, v_hash)
  on conflict do nothing;
  if not found then
    select * into v_existing from public.idempotency_keys
     where tenant_id = v_session.tenant_id and scope = 'place_order' and key = p_idempotency_key;
    if v_existing.request_hash <> v_hash then perform private.fail('chave_idempotencia_reutilizada'); end if;
    if v_existing.status = 'completed' then return v_existing.response || jsonb_build_object('replayed', true); end if;
    perform private.fail('pedido_em_processamento');
  end if;

  select * into v_quote from public.checkout_quotes where id = p_quote_id for update;
  if v_quote.id is null or v_quote.guest_session_id <> v_session.id then perform private.fail('cotacao_invalida'); end if;
  if v_quote.consumed_at is not null then perform private.fail('cotacao_usada'); end if;
  if v_quote.expires_at <= now() then perform private.fail('cotacao_expirada'); end if;
  if v_quote.total_cents = 0 and p_payment_mode = 'online' then perform private.fail('valor_invalido'); end if;

  select is_demo into v_is_demo from public.tenants where id = v_quote.tenant_id and status = 'active';
  if not found then perform private.fail('estabelecimento_indisponivel'); end if;
  if not exists (select 1 from public.locations where id = v_quote.location_id and status = 'active') then
    perform private.fail('unidade_indisponivel');
  end if;

  -- Revalidação dentro da transação, com trava nos itens (estoque).
  for v_line in select * from jsonb_array_elements(v_quote.lines) loop
    select * into v_item from public.menu_items where id = (v_line ->> 'item_id')::uuid for update;
    if v_item.visibility <> 'published'
       or not exists (select 1 from public.menu_categories c where c.id = v_item.category_id and c.visibility = 'published') then
      perform private.fail('item_indisponivel', v_item.id::text);
    end if;
    if v_item.availability <> 'available' then perform private.fail('item_esgotado', v_item.id::text); end if;
    if v_item.price_cents <> (v_line ->> 'unit_price_cents')::int then perform private.fail('preco_alterado', v_item.id::text); end if;
    for v_mod in select * from jsonb_array_elements(v_line -> 'modifiers') loop
      if not exists (select 1 from public.modifiers m where m.id = (v_mod ->> 'modifier_id')::uuid
                     and m.visibility = 'published' and m.availability = 'available'
                     and m.price_delta_cents = (v_mod ->> 'price_delta_cents')::int) then
        perform private.fail('preco_alterado', v_item.id::text);
      end if;
    end loop;
    if v_item.stock_quantity is not null then
      if v_item.stock_quantity < (v_line ->> 'quantity')::int then perform private.fail('item_esgotado', v_item.id::text); end if;
      update public.menu_items set stock_quantity = stock_quantity - (v_line ->> 'quantity')::int where id = v_item.id;
    end if;
  end loop;

  -- Código de retirada único no tenant (tentativas limitadas).
  for i in 1 .. 8 loop
    v_code := private.public_code();
    exit when not exists (select 1 from public.orders where tenant_id = v_quote.tenant_id and public_code = v_code);
    v_code := null;
  end loop;
  if v_code is null then perform private.fail('falha_codigo'); end if;

  insert into public.orders (tenant_id, location_id, table_id, guest_session_id, quote_id, service_mode, public_code,
                             payment_mode, payment_status, subtotal_cents, fees_cents, total_cents, customer_name,
                             customer_note, tracking_token_hash, tracking_expires_at, is_demo)
  values (v_quote.tenant_id, v_quote.location_id, v_session.table_id, v_session.id, v_quote.id, v_session.service_mode, v_code,
          p_payment_mode, case p_payment_mode when 'online' then 'pending' else 'not_required' end,
          v_quote.subtotal_cents, v_quote.fees_cents, v_quote.total_cents,
          nullif(left(btrim(coalesce(p_customer_name, '')), 60), ''), nullif(left(btrim(coalesce(p_customer_note, '')), 280), ''),
          private.hash_token(v_tracking), now() + interval '7 days', v_is_demo)
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_quote.lines) loop
    insert into public.order_items (tenant_id, order_id, item_id, name_snapshot, unit_price_cents, modifiers_total_cents,
                                    quantity, line_total_cents, notes, position)
    values (v_quote.tenant_id, v_order_id, (v_line ->> 'item_id')::uuid, v_line ->> 'name', (v_line ->> 'unit_price_cents')::int,
            (v_line ->> 'modifiers_total_cents')::int, (v_line ->> 'quantity')::int, (v_line ->> 'line_total_cents')::int,
            v_line ->> 'notes', v_pos)
    returning id into v_order_item;
    v_pos := v_pos + 1;
    insert into public.order_item_modifiers (tenant_id, order_item_id, modifier_id, group_name_snapshot, name_snapshot, price_delta_cents)
    select v_quote.tenant_id, v_order_item, (m ->> 'modifier_id')::uuid, m ->> 'group_name', m ->> 'name', (m ->> 'price_delta_cents')::int
    from jsonb_array_elements(v_line -> 'modifiers') m;
  end loop;

  update public.checkout_quotes set consumed_at = now() where id = v_quote.id;
  update public.carts set status = 'checked_out' where id = v_quote.cart_id;
  insert into public.order_events (tenant_id, order_id, event_type, to_status, actor_type, order_version)
  values (v_quote.tenant_id, v_order_id, 'order.submitted', 'submitted', 'guest', 1);
  perform private.outbox(v_quote.tenant_id, 'order', v_order_id, 'order.submitted',
                         jsonb_build_object('order_id', v_order_id, 'location_id', v_quote.location_id));
  insert into public.usage_counters as u (tenant_id, metric, period, value)
  values (v_quote.tenant_id, 'orders', date_trunc('month', now())::date, 1)
  on conflict (tenant_id, metric, period) do update set value = u.value + 1, updated_at = now();

  v_response := jsonb_build_object('order_id', v_order_id, 'public_code', v_code, 'tracking_token', v_tracking,
                                   'status', 'submitted',
                                   'payment_status', case p_payment_mode when 'online' then 'pending' else 'not_required' end,
                                   'total_cents', v_quote.total_cents, 'currency', 'BRL');
  update public.idempotency_keys set status = 'completed', response = v_response
   where tenant_id = v_session.tenant_id and scope = 'place_order' and key = p_idempotency_key;
  return v_response || jsonb_build_object('replayed', false);
end $$;

-- Inicia (ou devolve) a tentativa de pagamento online de um pedido. O valor vem do pedido.
create function servico.start_payment(p_order_id uuid, p_provider text, p_method text, p_provider_reference text,
                                      p_expires_at timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_intent public.payment_intents;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform private.fail('pedido_nao_encontrado'); end if;
  if v_order.payment_mode <> 'online' then perform private.fail('pagamento_presencial'); end if;
  if v_order.status in ('rejected', 'cancelled') then perform private.fail('pedido_encerrado'); end if;
  if v_order.payment_status not in ('pending', 'failed', 'expired') then perform private.fail('pagamento_ja_iniciado_ou_pago'); end if;

  select * into v_intent from public.payment_intents where order_id = v_order.id and status in ('pending', 'authorized');
  if v_intent.id is not null then
    return jsonb_build_object('payment_intent_id', v_intent.id, 'provider_reference', v_intent.provider_reference,
                              'amount_cents', v_intent.amount_cents, 'status', v_intent.status, 'replayed', true);
  end if;

  insert into public.payment_intents (tenant_id, order_id, provider, provider_reference, method, amount_cents, attempt, expires_at)
  values (v_order.tenant_id, v_order.id, p_provider, p_provider_reference, p_method, v_order.total_cents,
          coalesce((select max(attempt) from public.payment_intents where order_id = v_order.id), 0) + 1, p_expires_at)
  returning * into v_intent;
  update public.orders set payment_status = 'pending' where id = v_order.id;
  insert into public.order_events (tenant_id, order_id, event_type, actor_type, order_version)
  values (v_order.tenant_id, v_order.id, 'payment.pending', 'system', v_order.version);
  perform private.outbox(v_order.tenant_id, 'payment', v_intent.id, 'payment.pending', jsonb_build_object('order_id', v_order.id));
  return jsonb_build_object('payment_intent_id', v_intent.id, 'provider_reference', v_intent.provider_reference,
                            'amount_cents', v_intent.amount_cents, 'status', v_intent.status, 'replayed', false);
end $$;

-- Aplica um evento do PSP já verificado pela API (assinatura conferida com a credencial do tenant).
-- Deduplica pelo inbox, nunca regride "paid" e não marca pago com valor divergente (PRD 9.2).
create function servico.record_payment_event(p_provider text, p_provider_event_id text, p_provider_reference text,
                                             p_status text, p_amount_cents integer, p_signature_valid boolean,
                                             p_occurred_at timestamptz default now(), p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_inbox bigint;
  v_intent public.payment_intents;
  v_order public.orders;
  v_apply boolean := true;
  v_note text;
  v_new_intent_status text;
  v_refunded integer;
begin
  insert into public.webhook_inbox (provider, provider_event_id, signature_valid, payload)
  values (p_provider, p_provider_event_id, p_signature_valid, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_inbox;
  if v_inbox is null then return jsonb_build_object('result', 'duplicate'); end if;

  if not p_signature_valid then
    update public.webhook_inbox set status = 'ignored', last_error = 'assinatura_invalida', processed_at = now() where id = v_inbox;
    insert into public.security_events (kind, severity, details)
    values ('webhook_assinatura_invalida', 'warning', jsonb_build_object('provider', p_provider, 'event', p_provider_event_id));
    return jsonb_build_object('result', 'ignored', 'reason', 'assinatura_invalida');
  end if;
  if p_status not in ('pending', 'authorized', 'paid', 'failed', 'expired', 'refunded') then
    update public.webhook_inbox set status = 'failed', last_error = 'status_desconhecido', processed_at = now() where id = v_inbox;
    return jsonb_build_object('result', 'failed', 'reason', 'status_desconhecido');
  end if;

  select * into v_intent from public.payment_intents
   where provider = p_provider and provider_reference = p_provider_reference for update;
  if v_intent.id is null then
    update public.webhook_inbox set status = 'failed', last_error = 'intencao_desconhecida', processed_at = now() where id = v_inbox;
    return jsonb_build_object('result', 'failed', 'reason', 'intencao_desconhecida');
  end if;
  update public.webhook_inbox set tenant_id = v_intent.tenant_id where id = v_inbox;
  select * into v_order from public.orders where id = v_intent.order_id for update;

  if p_status = 'refunded' then
    v_apply := v_intent.status = 'paid' and coalesce(p_amount_cents, 0) > 0
               and v_order.refunded_cents + p_amount_cents <= v_intent.amount_cents;
    v_note := case when not v_apply then 'reembolso_invalido' end;
  elsif v_intent.status = 'paid' then
    v_apply := false; v_note := 'nao_regride_pago';
  elsif v_intent.status in ('failed', 'expired', 'cancelled') and p_status in ('pending', 'authorized') then
    v_apply := false; v_note := 'fora_de_ordem';
  elsif p_status = 'paid' and coalesce(p_amount_cents, -1) <> v_intent.amount_cents then
    v_apply := false; v_note := 'valor_divergente';
    insert into public.security_events (tenant_id, kind, severity, details)
    values (v_intent.tenant_id, 'pagamento_valor_divergente', 'critical',
            jsonb_build_object('payment_intent_id', v_intent.id, 'expected', v_intent.amount_cents, 'received', p_amount_cents));
  end if;

  insert into public.payment_events (tenant_id, payment_intent_id, provider, provider_event_id, status, amount_cents, applied, note, occurred_at)
  values (v_intent.tenant_id, v_intent.id, p_provider, p_provider_event_id, p_status, p_amount_cents, v_apply, v_note, p_occurred_at);

  if v_apply then
    if p_status = 'refunded' then
      v_refunded := v_order.refunded_cents + p_amount_cents;
      update public.orders set refunded_cents = v_refunded,
             payment_status = case when v_refunded >= v_order.total_cents then 'refunded' else 'partially_refunded' end
       where id = v_order.id;
      update public.refunds set status = 'completed', completed_at = now()
       where order_id = v_order.id and status in ('requested', 'pending');
      insert into public.order_events (tenant_id, order_id, event_type, actor_type, order_version)
      values (v_order.tenant_id, v_order.id, 'refund.completed', 'psp', v_order.version);
      perform private.outbox(v_order.tenant_id, 'refund', v_order.id, 'refund.completed',
                             jsonb_build_object('order_id', v_order.id, 'amount_cents', p_amount_cents));
    else
      v_new_intent_status := p_status;
      update public.payment_intents set status = v_new_intent_status,
             paid_at = case when p_status = 'paid' then coalesce(p_occurred_at, now()) else paid_at end
       where id = v_intent.id;
      -- Pago depois de o pedido ser rejeitado/cancelado: registra e pede reembolso.
      if p_status = 'paid' and v_order.status in ('rejected', 'cancelled') then
        insert into public.refunds (tenant_id, order_id, payment_intent_id, amount_cents, reason)
        values (v_order.tenant_id, v_order.id, v_intent.id, v_intent.amount_cents, 'Pago após o pedido ser encerrado');
        update public.orders set payment_status = 'refund_pending' where id = v_order.id;
        perform private.outbox(v_order.tenant_id, 'refund', v_order.id, 'refund.requested', jsonb_build_object('order_id', v_order.id));
      elsif v_order.payment_status not in ('refund_pending', 'refunded', 'partially_refunded') then
        update public.orders set payment_status = p_status where id = v_order.id;
      end if;
      insert into public.order_events (tenant_id, order_id, event_type, actor_type, order_version)
      values (v_order.tenant_id, v_order.id, 'payment.' || p_status, 'psp', v_order.version);
      perform private.outbox(v_order.tenant_id, 'payment', v_intent.id, 'payment.' || p_status,
                             jsonb_build_object('order_id', v_order.id));
    end if;
  end if;

  update public.webhook_inbox set status = 'processed', processed_at = now(), last_error = v_note where id = v_inbox;
  return jsonb_build_object('result', case when v_apply then 'applied' else 'recorded' end, 'note', v_note);
end $$;

-- Chamado da mesa (C08).
create function servico.create_service_request(p_session_token text, p_kind text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session public.guest_sessions := private.session_from_token(p_session_token);
  v_id uuid;
begin
  if v_session.id is null then perform private.fail('sessao_expirada'); end if;
  if p_kind not in ('call_staff', 'request_bill', 'recover_order') then perform private.fail('valor_invalido'); end if;
  -- Um chamado aberto por tipo e sessão; repetir devolve o mesmo.
  select id into v_id from public.service_requests
   where guest_session_id = v_session.id and kind = p_kind and status in ('open', 'acknowledged');
  if v_id is null then
    insert into public.service_requests (tenant_id, location_id, table_id, guest_session_id, kind)
    values (v_session.tenant_id, v_session.location_id, v_session.table_id, v_session.id, p_kind)
    returning id into v_id;
  end if;
  return jsonb_build_object('service_request_id', v_id);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema servico from public, anon, authenticated;
revoke execute on function private.fail(text, text), private.audit(uuid, text, text, text, text, text, jsonb),
  private.outbox(uuid, text, uuid, text, jsonb), private.public_code(), private.random_token(), private.hash_token(text),
  private.session_from_token(text), private.set_updated_at(), private.append_only(), private.no_delete(),
  private.bump_price_version(), private.orders_freeze_snapshot()
  from public, anon, authenticated;

grant execute on function public.resolve_table(text), public.public_menu(text, text), public.track_order(text)
  to anon, authenticated, service_role;
grant execute on function public.rotate_table_token(uuid, text), public.set_item_availability(uuid, text),
  public.transition_order(uuid, text, integer, text) to authenticated, service_role;
grant execute on all functions in schema servico to service_role;
grant execute on all functions in schema private to service_role;
