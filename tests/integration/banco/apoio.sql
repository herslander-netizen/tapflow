-- Apoio dos testes de banco: asserções e um cenário com dois tenants. Cada arquivo de teste roda
-- dentro de uma transação que termina em ROLLBACK, então nada fica gravado.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
set client_min_messages = warning;

create schema if not exists teste;
grant usage on schema teste to anon, authenticated, service_role;

create or replace function teste.ok(p_cond boolean, p_msg text) returns text language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FALHOU: %', p_msg; end if;
  return 'ok ' || p_msg;
end $$;

-- Executa p_sql e exige erro. p_esperado casa com a mensagem ou com o SQLSTATE.
create or replace function teste.erro(p_sql text, p_esperado text, p_msg text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_esperado || '%' or sqlstate = p_esperado then return 'ok ' || p_msg; end if;
    raise exception 'FALHOU: % (erro diferente: % / %)', p_msg, sqlstate, sqlerrm;
  end;
  raise exception 'FALHOU: % (esperava erro "%", não houve)', p_msg, p_esperado;
end $$;

create or replace function teste.linhas(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'with x as (' || p_sql || ') select count(*) from x' into n;
  return n;
end $$;
grant execute on all functions in schema teste to anon, authenticated, service_role;

begin;

-- Pessoas (fictícias)
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a.dono@exemplo.test'),
  ('10000000-0000-4000-8000-000000000002', 'a.gerente1@exemplo.test'),
  ('10000000-0000-4000-8000-000000000003', 'a.atendente1@exemplo.test'),
  ('10000000-0000-4000-8000-000000000004', 'a.cozinha1@exemplo.test'),
  ('10000000-0000-4000-8000-000000000005', 'a.atendente2@exemplo.test'),
  ('10000000-0000-4000-8000-000000000006', 'b.dono@exemplo.test'),
  ('10000000-0000-4000-8000-000000000007', 'alvo.admin@exemplo.test'),
  ('10000000-0000-4000-8000-000000000008', 'alvo.suporte@exemplo.test'),
  ('10000000-0000-4000-8000-000000000009', 'sem.vinculo@exemplo.test'),
  ('10000000-0000-4000-8000-00000000000a', 'convidado@exemplo.test');

-- Tenant A com duas unidades; tenant B com uma.
insert into public.tenants (id, slug, name, status) values
  ('a0000000-0000-4000-8000-000000000000', 'tenant-a', 'Restaurante A', 'active'),
  ('b0000000-0000-4000-8000-000000000000', 'tenant-b', 'Restaurante B', 'active');
insert into public.locations (id, tenant_id, slug, name, service_modes) values
  ('a1000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'a1', 'A Unidade 1', array['table', 'pickup']),
  ('a2000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'a2', 'A Unidade 2', array['table']),
  ('b1000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000000', 'b1', 'B Unidade 1', array['table', 'pickup']);
insert into public.tenant_memberships (tenant_id, location_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-000000000000', null, '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000003', 'attendant', 'active'),
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000004', 'kitchen', 'active'),
  ('a0000000-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000005', 'attendant', 'active'),
  ('b0000000-0000-4000-8000-000000000000', null, '10000000-0000-4000-8000-000000000006', 'owner', 'active');
insert into public.platform_staff (user_id, role) values
  ('10000000-0000-4000-8000-000000000007', 'admin'),
  ('10000000-0000-4000-8000-000000000008', 'support');

insert into public.dining_tables (id, tenant_id, location_id, public_number) values
  ('a1100000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10'),
  ('a2100000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000000', '20'),
  ('b1100000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000000', '10');
insert into public.table_access_tokens (tenant_id, location_id, table_id, token_hash, token_hint)
select d.tenant_id, d.location_id, d.id, sha256(convert_to(t.tok, 'UTF8')), right(t.tok, 4)
from (values ('a1100000-0000-4000-8000-000000000000'::uuid, 'token-teste-mesa-a1-000000000000000001'),
             ('a2100000-0000-4000-8000-000000000000'::uuid, 'token-teste-mesa-a2-000000000000000002'),
             ('b1100000-0000-4000-8000-000000000000'::uuid, 'token-teste-mesa-b1-000000000000000003')) t(id, tok)
join public.dining_tables d on d.id = t.id;

insert into public.menu_categories (id, tenant_id, name) values
  ('a3000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'Pratos A'),
  ('b3000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000000', 'Pratos B');
insert into public.menu_items (id, tenant_id, category_id, name, price_cents, visibility, stock_quantity) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000000', 'Prato A1', 3000, 'published', null),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000000', 'Prato A2 (estoque 2)', 2000, 'published', 2),
  ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000000', 'Prato A oculto', 1000, 'hidden', null),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000000', 'Prato B1', 5000, 'published', null);
insert into public.modifier_groups (id, tenant_id, name, min_select, max_select) values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Ponto', 1, 1),
  ('a5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Extras', 0, 2),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'Extras B', 0, 2);
insert into public.modifiers (id, tenant_id, group_id, name, price_delta_cents) values
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a5000000-0000-4000-8000-000000000001', 'Mal passado', 0),
  ('a6000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a5000000-0000-4000-8000-000000000001', 'Ao ponto', 0),
  ('a6000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'a5000000-0000-4000-8000-000000000002', 'Bacon', 500),
  ('a6000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000000', 'a5000000-0000-4000-8000-000000000002', 'Ovo', 300),
  ('a6000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000000', 'a5000000-0000-4000-8000-000000000002', 'Queijo', 400),
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b5000000-0000-4000-8000-000000000001', 'Extra B', 100);
insert into public.item_modifier_groups (tenant_id, item_id, group_id) values
  ('a0000000-0000-4000-8000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000000', 'b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001');

-- Atalhos de identidade (usar com SET ROLE).
create or replace function teste.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user, false);
$$;

-- Monta um pedido completo pela API (service_role): sessão na mesa, carrinho, cotação e pedido.
create or replace function teste.pedido(p_table_token text, p_itens jsonb, p_payment_mode text default 'in_person',
                                        p_chave text default null) returns jsonb language plpgsql as $$
declare s jsonb; q jsonb; i jsonb;
begin
  s := servico.create_guest_session(p_table_token, null, null, 'qr');
  for i in select * from jsonb_array_elements(p_itens) loop
    insert into public.cart_items (tenant_id, cart_id, item_id, quantity, modifier_ids)
    select c.tenant_id, c.id, (i ->> 'item')::uuid, coalesce((i ->> 'qtd')::int, 1),
           coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(i -> 'mods') x), '{}')
    from public.carts c where c.id = (s ->> 'cart_id')::uuid;
  end loop;
  q := servico.quote_cart(s ->> 'session_token');
  return servico.place_order(s ->> 'session_token', (q ->> 'quote_id')::uuid,
                             coalesce(p_chave, 'chave-' || gen_random_uuid()), p_payment_mode)
         || jsonb_build_object('session_token', s ->> 'session_token', 'quote', q);
end $$;
grant execute on all functions in schema teste to anon, authenticated, service_role;
