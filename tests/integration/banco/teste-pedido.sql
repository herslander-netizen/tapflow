-- F1-05 a F1-10: mesa, cardápio público, cotação no servidor, pedido idempotente e estados.

set role anon;
select teste.ok(public.resolve_table('token-que-nao-existe-000000000000000000') is null, 'token desconhecido não resolve mesa');
select teste.ok(public.resolve_table('curto') is null, 'token curto é recusado');
select teste.ok(jsonb_path_exists(public.public_menu('tenant-a', 'a1'), '$.categories[*].items[*] ? (@.name == "Prato A1")'), 'item publicado aparece no cardápio');
select teste.ok(not jsonb_path_exists(public.public_menu('tenant-a', 'a1'), '$.categories[*].items[*] ? (@.name == "Prato A oculto")'), 'item oculto não aparece no cardápio');
select teste.ok(not (public.public_menu('tenant-a', 'a1')::text like '%stock%'), 'cardápio público não expõe estoque');
select teste.ok(public.public_menu('tenant-a', 'nao-existe') is null, 'unidade inexistente não devolve cardápio');
select teste.ok(public.public_menu('demo-lanchonete', 'centro') -> 'tenant' ->> 'is_demo' = 'true', 'seed de demonstração marcado como demonstração');
reset role;

-- Token rotacionado: o antigo deixa de valer.
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000002');
select set_config('teste.novo_token', public.rotate_table_token('a1100000-0000-4000-8000-000000000000', 'etiqueta trocada') ->> 'token', false) is not null as x;
select teste.erro($$select public.rotate_table_token('a2100000-0000-4000-8000-000000000000')$$, 'sem_permissao', 'gerente de A1 não rotaciona mesa de A2');
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.erro($$select public.rotate_table_token('a1100000-0000-4000-8000-000000000000')$$, 'sem_permissao', 'atendente não rotaciona token');
reset role;
set role anon;
select teste.ok(public.resolve_table('token-teste-mesa-a1-000000000000000001') is null, 'token antigo para de funcionar');
select teste.ok(public.resolve_table(current_setting('teste.novo_token')) is not null, 'token novo funciona');
reset role;

set role service_role;
select teste.erro($$select servico.create_guest_session('token-teste-mesa-a1-000000000000000001')$$, 'mesa_invalida', 'sessão não abre com token revogado');
select teste.erro($$select servico.create_guest_session(null, 'tenant-a', 'a2')$$, 'modalidade_indisponivel', 'retirada recusada onde a unidade só atende mesa');
select teste.ok(servico.create_guest_session(null, 'tenant-a', 'a1') ->> 'service_mode' = 'pickup', 'retirada aberta na unidade que permite');

-- Cotação: preço sempre do servidor, adicionais dentro do limite.
create temp table s as select servico.create_guest_session(current_setting('teste.novo_token'), null, null, 'nfc') as j;
grant select on s to service_role;
select teste.erro($$select servico.quote_cart((select j ->> 'session_token' from s))$$, 'carrinho_vazio', 'carrinho vazio não gera cotação');
insert into public.cart_items (tenant_id, cart_id, item_id, quantity, modifier_ids)
  select 'a0000000-0000-4000-8000-000000000000', (j ->> 'cart_id')::uuid, 'a4000000-0000-4000-8000-000000000001', 2, '{}' from s;
select teste.erro($$select servico.quote_cart((select j ->> 'session_token' from s))$$, 'adicionais_fora_do_limite', 'grupo obrigatório sem escolha é recusado');
update public.cart_items set modifier_ids = array['a6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002']::uuid[];
select teste.erro($$select servico.quote_cart((select j ->> 'session_token' from s))$$, 'adicionais_fora_do_limite', 'duas escolhas num grupo de máximo 1 são recusadas');
update public.cart_items set modifier_ids = array['a6000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001']::uuid[];
select teste.erro($$select servico.quote_cart((select j ->> 'session_token' from s))$$, 'adicional_invalido', 'adicional de outro tenant é recusado');
update public.cart_items set modifier_ids = array['a6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'a6000000-0000-4000-8000-000000000004']::uuid[];
create temp table q as select servico.quote_cart((select j ->> 'session_token' from s)) as j;
grant select on q to service_role;
select teste.ok((select (j ->> 'total_cents')::int from q) = (3000 + 500 + 300) * 2, 'total calculado no servidor: (3000 + 500 + 300) x 2');
select teste.erro($$select servico.quote_cart('sessao-invalida')$$, 'sessao_expirada', 'sessão inválida não cota');

-- Pedido idempotente.
create temp table p1 as select servico.place_order((select j ->> 'session_token' from s), (select (j ->> 'quote_id')::uuid from q), 'chave-idempotente-0001', 'in_person') as j;
create temp table p2 as select servico.place_order((select j ->> 'session_token' from s), (select (j ->> 'quote_id')::uuid from q), 'chave-idempotente-0001', 'in_person') as j;
select teste.ok((select j ->> 'order_id' from p1) = (select j ->> 'order_id' from p2), 'mesma chave devolve o mesmo pedido');
select teste.ok((select (j ->> 'replayed')::boolean from p2), 'reenvio marcado como repetição');
select teste.ok((select count(*) from public.orders where quote_id = (select (j ->> 'quote_id')::uuid from q)) = 1, 'reenvio não duplica pedido');
select teste.erro($$select servico.place_order((select j ->> 'session_token' from s), (select (j ->> 'quote_id')::uuid from q), 'chave-idempotente-0002', 'in_person')$$, 'cotacao_usada', 'cotação usada não gera segundo pedido');
select teste.erro($$select servico.place_order((select j ->> 'session_token' from s), (select (j ->> 'quote_id')::uuid from q), 'chave-idempotente-0001', 'online')$$, 'chave_idempotencia_reutilizada', 'mesma chave com outro pedido é recusada');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from p1)) = 'not_required', 'pagamento no local: pedido recebido sem cobrança online');
select teste.ok((select count(*) from public.order_item_modifiers m join public.order_items oi on oi.id = m.order_item_id where oi.order_id = (select (j ->> 'order_id')::uuid from p1)) = 3, 'snapshot guarda os três adicionais');

-- Preço mudou depois da cotação: não confirma com o preço velho.
create temp table s2 as select servico.create_guest_session(current_setting('teste.novo_token')) as j;
insert into public.cart_items (tenant_id, cart_id, item_id, quantity, modifier_ids)
  select 'a0000000-0000-4000-8000-000000000000', (j ->> 'cart_id')::uuid, 'a4000000-0000-4000-8000-000000000001', 1, array['a6000000-0000-4000-8000-000000000002']::uuid[] from s2;
create temp table q2 as select servico.quote_cart((select j ->> 'session_token' from s2)) as j;
update public.menu_items set price_cents = 3500 where id = 'a4000000-0000-4000-8000-000000000001';
select teste.erro($$select servico.place_order((select j ->> 'session_token' from s2), (select (j ->> 'quote_id')::uuid from q2), 'chave-preco-mudou-0001', 'in_person')$$, 'preco_alterado', 'preço alterado exige nova cotação');
select teste.erro($$select servico.place_order((select j ->> 'session_token' from s), (select (j ->> 'quote_id')::uuid from q2), 'chave-outra-sessao-01', 'in_person')$$, 'cotacao_invalida', 'cotação de outra sessão é recusada');
update public.checkout_quotes set expires_at = now() - interval '1 minute' where id = (select (j ->> 'quote_id')::uuid from q2);
update public.menu_items set price_cents = 3000 where id = 'a4000000-0000-4000-8000-000000000001';
select teste.erro($$select servico.place_order((select j ->> 'session_token' from s2), (select (j ->> 'quote_id')::uuid from q2), 'chave-cotacao-vencida', 'in_person')$$, 'cotacao_expirada', 'cotação vencida é recusada');

-- Estoque: duas unidades; um pedido de 2 esgota; pedido rejeitado devolve.
create temp table p3 as select teste.pedido(current_setting('teste.novo_token'), '[{"item":"a4000000-0000-4000-8000-000000000002","qtd":2}]') as j;
select teste.ok((select stock_quantity from public.menu_items where id = 'a4000000-0000-4000-8000-000000000002') = 0, 'estoque baixa no pedido');
select teste.erro($$select teste.pedido(current_setting('teste.novo_token'), '[{"item":"a4000000-0000-4000-8000-000000000002","qtd":1}]')$$, 'item_esgotado', 'sem estoque não cota');
update public.menu_items set availability = 'sold_out' where id = 'a4000000-0000-4000-8000-000000000001';
select teste.erro($$select teste.pedido(current_setting('teste.novo_token'), '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000001"]}]')$$, 'item_esgotado', 'item esgotado não entra por payload manual');
update public.menu_items set availability = 'available' where id = 'a4000000-0000-4000-8000-000000000001';
select teste.erro($$select teste.pedido(current_setting('teste.novo_token'), '[{"item":"a4000000-0000-4000-8000-000000000003"}]')$$, 'item_indisponivel', 'item oculto não entra por payload manual');
reset role;
grant select on p1, p3, s to authenticated, anon, service_role;

-- Máquina de estados.
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000004');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'accepted', 1)$$, 'sem_permissao', 'cozinha não aceita pedido');
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'ready', 1)$$, 'transicao_invalida', 'não pula de recebido para pronto');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'accepted', 7)$$, 'versao_conflitante', 'versão desatualizada é recusada');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from p1), 'accepted', 1) ->> 'version' = '2', 'atendente aceita');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'accepted', 1)$$, 'versao_conflitante', 'aceite duplicado (outra aba) é recusado');
select teste.como('10000000-0000-4000-8000-000000000004');
select teste.ok(teste.linhas('select 1 from public.kitchen_tickets where status = ''queued''') = 1, 'aceite cria comanda da cozinha');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from p1), 'preparing', 2) ->> 'status' = 'preparing', 'cozinha inicia preparo');
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'cancelled', 3, 'cliente desistiu')$$, 'sem_permissao', 'atendente não cancela pedido em preparo');
select teste.como('10000000-0000-4000-8000-000000000002');
select teste.erro($$select public.transition_order((select (j ->> 'order_id')::uuid from p1), 'cancelled', 3)$$, 'motivo_obrigatorio', 'cancelar exige motivo');
select teste.como('10000000-0000-4000-8000-000000000004');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from p1), 'ready', 3) ->> 'status' = 'ready', 'cozinha marca pronto');
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from p1), 'completed', 4) ->> 'status' = 'completed', 'atendente conclui entrega');
select teste.ok(teste.linhas('select 1 from public.order_events where order_id = (select (j ->> ''order_id'')::uuid from p1)') = 5, 'trilha com 5 eventos');
select teste.ok((select string_agg(coalesce(from_status, '-') || '>' || to_status, ',' order by id) from public.order_events where order_id = (select (j ->> 'order_id')::uuid from p1))
                = '->submitted,submitted>accepted,accepted>preparing,preparing>ready,ready>completed', 'trilha registra origem e destino');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from p3), 'rejected', 1, 'cozinha fechada') ->> 'status' = 'rejected', 'atendente rejeita com motivo');
reset role;
select teste.ok((select stock_quantity from public.menu_items where id = 'a4000000-0000-4000-8000-000000000002') = 2, 'rejeição devolve o estoque');
select teste.ok((select count(*) from public.audit_log where action like 'order.%' and actor_user_id is not null) = 5, 'as 5 transições ficam auditadas com o autor');

-- Acompanhamento pelo cliente.
set role anon;
select teste.ok(public.track_order((select j ->> 'tracking_token' from p1)) ->> 'status' = 'completed', 'cliente acompanha com o token do pedido');
select teste.ok(jsonb_array_length(public.track_order((select j ->> 'tracking_token' from p1)) -> 'timeline') = 5, 'cliente vê a linha do tempo');
select teste.ok(public.track_order('token-errado-000000000000000000000000') is null, 'token errado não mostra pedido');
select teste.ok(public.track_order((select j ->> 'tracking_token' from p3)) ->> 'status_reason' = 'cozinha fechada', 'cliente vê o motivo da recusa');
reset role;

-- Chamado da mesa.
set role service_role;
select teste.ok(servico.create_service_request((select j ->> 'session_token' from s), 'request_bill') = servico.create_service_request((select j ->> 'session_token' from s), 'request_bill'), 'pedir a conta duas vezes abre um chamado só');
reset role;
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.ok(teste.linhas($$update public.service_requests set status = 'acknowledged' returning 1$$) = 1, 'atendente assume o chamado');
select teste.como('10000000-0000-4000-8000-000000000005');
select teste.ok(teste.linhas('select 1 from public.service_requests') = 0, 'atendente de outra unidade não vê o chamado');
reset role;

rollback;
