-- TapFlow — dados de DEMONSTRAÇÃO. Tudo aqui é fictício (is_demo = true) e serve só para a prévia
-- e para os testes. Não há usuários, pagamentos nem clientes reais. Não rodar em produção.
-- Os tokens de mesa abaixo são públicos de propósito (estão no repositório): servem só ao tenant
-- de demonstração e precisam ser rotacionados se este seed for usado em qualquer ambiente exposto.

insert into public.tenants (id, slug, name, status, service_fee_bps, theme, is_demo) values
  ('00000000-0000-4000-8000-0000000000d1', 'demo-lanchonete', 'Lanchonete Fictícia (demonstração)', 'active', 0,
   '{"accent": "#C8F45D", "mode": "dark"}', true)
on conflict (id) do nothing;

insert into public.locations (id, tenant_id, slug, name, service_modes) values
  ('00000000-0000-4000-8000-0000000001d1', '00000000-0000-4000-8000-0000000000d1', 'centro', 'Unidade Centro (fictícia)',
   array['table', 'pickup'])
on conflict (id) do nothing;

insert into public.dining_tables (id, tenant_id, location_id, public_number, label) values
  ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000001d1', '1', 'Varanda'),
  ('00000000-0000-4000-8000-0000000002d2', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000001d1', '2', 'Salão')
on conflict (id) do nothing;

insert into public.table_access_tokens (tenant_id, location_id, table_id, token_hash, token_hint)
select '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000001d1', t.table_id,
       sha256(convert_to(t.token, 'UTF8')), right(t.token, 4)
from (values ('00000000-0000-4000-8000-0000000002d1'::uuid, 'demo-mesa-1-somente-demonstracao-0001'),
             ('00000000-0000-4000-8000-0000000002d2'::uuid, 'demo-mesa-2-somente-demonstracao-0002')) as t(table_id, token)
where not exists (select 1 from public.table_access_tokens k where k.table_id = t.table_id and k.revoked_at is null);

insert into public.menu_categories (id, tenant_id, name, position) values
  ('00000000-0000-4000-8000-0000000003d1', '00000000-0000-4000-8000-0000000000d1', 'Lanches', 1),
  ('00000000-0000-4000-8000-0000000003d2', '00000000-0000-4000-8000-0000000000d1', 'Bebidas', 2)
on conflict (id) do nothing;

insert into public.menu_items (id, tenant_id, category_id, name, description, ingredients, allergens, price_cents, visibility, stock_quantity, position) values
  ('00000000-0000-4000-8000-0000000004d1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000003d1',
   'Burger da Casa', 'Pão de fermentação natural, blend de 160 g e queijo.', 'Pão, carne bovina, queijo, picles', array['glúten', 'lactose'], 3400, 'published', null, 1),
  ('00000000-0000-4000-8000-0000000004d2', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000003d1',
   'Sanduíche Vegetal', 'Grelhados da estação com pesto.', 'Pão, abobrinha, berinjela, pesto', array['glúten', 'castanhas'], 2900, 'published', 5, 2),
  ('00000000-0000-4000-8000-0000000004d3', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000003d2',
   'Limonada', 'Feita na hora.', 'Limão, água, açúcar', array[]::text[], 900, 'published', null, 1),
  ('00000000-0000-4000-8000-0000000004d4', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000003d2',
   'Bebida em teste (oculta)', 'Item oculto para provar que não aparece no cardápio público.', null, array[]::text[], 1200, 'hidden', null, 2)
on conflict (id) do nothing;

insert into public.modifier_groups (id, tenant_id, name, min_select, max_select) values
  ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-0000000000d1', 'Ponto da carne', 1, 1),
  ('00000000-0000-4000-8000-0000000005d2', '00000000-0000-4000-8000-0000000000d1', 'Adicionais', 0, 3)
on conflict (id) do nothing;

insert into public.modifiers (id, tenant_id, group_id, name, price_delta_cents, position) values
  ('00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000005d1', 'Ao ponto', 0, 1),
  ('00000000-0000-4000-8000-0000000006d2', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000005d1', 'Bem passado', 0, 2),
  ('00000000-0000-4000-8000-0000000006d3', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000005d2', 'Bacon', 600, 1),
  ('00000000-0000-4000-8000-0000000006d4', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000005d2', 'Queijo extra', 400, 2)
on conflict (id) do nothing;

insert into public.item_modifier_groups (tenant_id, item_id, group_id, position) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000004d1', '00000000-0000-4000-8000-0000000005d1', 1),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000004d1', '00000000-0000-4000-8000-0000000005d2', 2)
on conflict do nothing;

insert into public.subscriptions (tenant_id, plan_code, status, limits)
select '00000000-0000-4000-8000-0000000000d1', 'demo', 'trial', '{"video_seconds_delivered": 0}'
where not exists (select 1 from public.subscriptions where tenant_id = '00000000-0000-4000-8000-0000000000d1' and status <> 'cancelled');
