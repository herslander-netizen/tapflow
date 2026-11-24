-- F0-04: isolamento entre tenants e unidades, acesso anônimo e papéis.

-- Pedidos de A (unidade 1 e 2) e de B, criados pela API.
set role service_role;
select teste.ok((teste.pedido('token-teste-mesa-a1-000000000000000001', '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000001"]}]') ->> 'status') = 'submitted', 'pedido de A1 criado');
select teste.ok((teste.pedido('token-teste-mesa-a2-000000000000000002', '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000002"]}]') ->> 'status') = 'submitted', 'pedido de A2 criado');
select teste.ok((teste.pedido('token-teste-mesa-b1-000000000000000003', '[{"item":"b4000000-0000-4000-8000-000000000001"}]') ->> 'status') = 'submitted', 'pedido de B1 criado');
reset role;

-- Anônimo: nenhuma tabela legível; só as funções públicas.
set role anon;
select teste.erro('select * from public.tenants', '42501', 'anon não lê tenants');
select teste.erro('select * from public.orders', '42501', 'anon não lê pedidos');
select teste.erro('select * from public.menu_items', '42501', 'anon não lê a tabela do cardápio');
select teste.erro('select * from public.table_access_tokens', '42501', 'anon não lê tokens de mesa');
select teste.erro('select * from public.payment_intents', '42501', 'anon não lê pagamentos');
select teste.erro('insert into public.orders default values', '42501', 'anon não cria pedido direto');
select teste.erro($$select servico.quote_cart('x')$$, '42501', 'anon não chama funções da API');
select teste.erro($$select public.transition_order(gen_random_uuid(), 'accepted', 1)$$, '42501', 'anon não muda pedido');
select teste.ok(public.public_menu('tenant-a', 'a1') is not null, 'anon lê o cardápio público');
select teste.ok(public.resolve_table('token-teste-mesa-a1-000000000000000001') -> 'table' ->> 'number' = '10', 'anon resolve a mesa pelo token');
reset role;

-- Dono de B não vê nada de A.
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000006');
select teste.ok(teste.linhas('select 1 from public.tenants') = 1, 'dono de B vê só o próprio tenant');
select teste.ok(teste.linhas($$select 1 from public.orders where tenant_id = 'a0000000-0000-4000-8000-000000000000'$$) = 0, 'dono de B não vê pedidos de A');
select teste.ok(teste.linhas('select 1 from public.orders') = 1, 'dono de B vê o próprio pedido');
select teste.ok(teste.linhas($$select 1 from public.menu_items where tenant_id = 'a0000000-0000-4000-8000-000000000000'$$) = 0, 'dono de B não vê cardápio interno de A');
select teste.ok(teste.linhas('select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where o.tenant_id <> ''b0000000-0000-4000-8000-000000000000''') = 0, 'dono de B não vê itens de pedidos de A');
select teste.ok(teste.linhas('select 1 from public.tenant_memberships where tenant_id = ''a0000000-0000-4000-8000-000000000000''') = 0, 'dono de B não vê a equipe de A');
select teste.erro($$insert into public.menu_items (tenant_id, category_id, name, price_cents) values ('a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000000', 'Invasor', 1)$$,
                  'row-level security', 'dono de B não cria item em A');
select teste.erro($$insert into public.menu_items (tenant_id, category_id, name, price_cents) values ('b0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000000', 'Categoria alheia', 1)$$,
                  '23503', 'chave composta impede item de B na categoria de A');
select teste.ok(teste.linhas($$update public.menu_items set price_cents = 1 where tenant_id = 'a0000000-0000-4000-8000-000000000000' returning 1$$) = 0, 'dono de B não altera preço de A');
select teste.erro($$select public.rotate_table_token('a1100000-0000-4000-8000-000000000000')$$, 'sem_permissao', 'dono de B não rotaciona mesa de A');
select teste.erro($$select public.set_item_availability('a4000000-0000-4000-8000-000000000001', 'sold_out')$$, 'sem_permissao', 'dono de B não esgota item de A');
select teste.erro($$insert into public.tenant_memberships (tenant_id, user_id, role, invited_by, status) values ('a0000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000006', 'owner', '10000000-0000-4000-8000-000000000006', 'invited')$$,
                  'row-level security', 'dono de B não se coloca como dono de A');
reset role;

-- Unidade: atendente da unidade 2 não vê a unidade 1.
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000005');
select teste.ok(teste.linhas('select 1 from public.orders') = 1, 'atendente de A2 vê só o pedido de A2');
select teste.ok(teste.linhas('select 1 from public.dining_tables') = 1, 'atendente de A2 vê só a mesa de A2');
select teste.ok(teste.linhas('select 1 from public.locations') = 1, 'atendente de A2 vê só a própria unidade');
select teste.erro($$select public.transition_order((select id from public.orders o where false), 'accepted', 1)$$, 'pedido_nao_encontrado', 'atendente de A2 não acha pedido inexistente');
reset role;
select set_config('teste.pedido_a1', (select id::text from public.orders where location_id = 'a1000000-0000-4000-8000-000000000000'), false);
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000005');
select teste.erro(format($$select public.transition_order('%s', 'accepted', 1)$$, current_setting('teste.pedido_a1')), 'pedido_nao_encontrado', 'atendente de A2 não muda pedido de A1');

-- Cozinha: não vê dinheiro.
select teste.como('10000000-0000-4000-8000-000000000004');
select teste.ok(teste.linhas('select 1 from public.orders') = 1, 'cozinha de A1 vê o pedido de A1');
select teste.ok(teste.linhas('select 1 from public.payment_intents') = 0, 'cozinha não vê pagamentos');
select teste.ok(teste.linhas('select 1 from public.audit_log') = 0, 'cozinha não vê auditoria');
select teste.ok(teste.linhas('select 1 from public.guest_sessions') = 0, 'cozinha não vê sessões de clientes');
select teste.erro($$select tracking_token_hash from public.orders$$, '42501', 'ninguém da equipe lê o hash do acompanhamento');
select teste.erro($$update public.orders set total_cents = 1$$, '42501', 'equipe não altera pedido direto');

-- Gerente da unidade 1: convida atendente na própria unidade, mas não dono nem gerente.
select teste.como('10000000-0000-4000-8000-000000000002');
select teste.ok(teste.linhas($$insert into public.tenant_memberships (tenant_id, location_id, user_id, role, invited_by) values ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-00000000000a', 'attendant', '10000000-0000-4000-8000-000000000002') returning 1$$) = 1, 'gerente convida atendente na própria unidade');
select teste.erro($$insert into public.tenant_memberships (tenant_id, location_id, user_id, role, invited_by) values ('a0000000-0000-4000-8000-000000000000', null, '10000000-0000-4000-8000-00000000000a', 'owner', '10000000-0000-4000-8000-000000000002')$$, 'row-level security', 'gerente não cria dono');
select teste.erro($$insert into public.tenant_memberships (tenant_id, location_id, user_id, role, invited_by) values ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-00000000000a', 'manager', '10000000-0000-4000-8000-000000000002')$$, 'row-level security', 'gerente não cria outro gerente');
select teste.erro($$insert into public.tenant_memberships (tenant_id, location_id, user_id, role, invited_by) values ('a0000000-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-00000000000a', 'kitchen', '10000000-0000-4000-8000-000000000002')$$, 'row-level security', 'gerente não convida em outra unidade');
select teste.erro($$update public.tenant_memberships set role = 'owner' where user_id = '10000000-0000-4000-8000-000000000002'$$, '42501', 'gerente não muda o próprio papel');

-- Convidado aceita o convite; não pode se ativar como outra coisa.
select teste.como('10000000-0000-4000-8000-00000000000a');
select teste.ok(teste.linhas('select 1 from public.orders') = 0, 'convite pendente ainda não dá acesso');
select teste.ok(teste.linhas($$update public.tenant_memberships set status = 'active' where user_id = '10000000-0000-4000-8000-00000000000a' returning 1$$) = 1, 'convidado aceita o convite');
select teste.ok(teste.linhas('select 1 from public.orders') = 1, 'depois de aceitar vê os pedidos da unidade');

-- Sem vínculo: nada.
select teste.como('10000000-0000-4000-8000-000000000009');
select teste.ok(teste.linhas('select 1 from public.tenants') + teste.linhas('select 1 from public.orders') + teste.linhas('select 1 from public.menu_items') = 0, 'usuário sem vínculo não vê nada');

-- Administrador ALVO: vê tenants e consumo, não pedidos.
select teste.como('10000000-0000-4000-8000-000000000007');
select teste.ok(teste.linhas('select 1 from public.tenants') = 3, 'admin ALVO vê todos os tenants (A, B e demonstração)');
select teste.ok(teste.linhas('select 1 from public.orders') = 0, 'admin ALVO não vê pedidos');
select teste.ok(teste.linhas('select 1 from public.menu_items') = 0, 'admin ALVO não vê cardápio interno');

-- Suporte ALVO: só com concessão vigente, só leitura, e a concessão vence.
select teste.como('10000000-0000-4000-8000-000000000008');
select teste.ok(teste.linhas('select 1 from public.orders') = 0, 'suporte sem concessão não vê pedidos');
select teste.erro($$insert into public.support_access_grants (tenant_id, staff_user_id, reason, granted_by, expires_at) values ('a0000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000008', 'Me dando acesso sozinho', '10000000-0000-4000-8000-000000000008', now() + interval '1 hour')$$, 'row-level security', 'suporte não concede acesso a si mesmo');
select teste.como('10000000-0000-4000-8000-000000000007');
select teste.ok(teste.linhas($$insert into public.support_access_grants (tenant_id, staff_user_id, reason, granted_by, expires_at) values ('a0000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000008', 'Chamado 123: pedido não aparece', '10000000-0000-4000-8000-000000000007', now() + interval '2 hours') returning 1$$) = 1, 'admin concede acesso temporário');
select teste.erro($$insert into public.support_access_grants (tenant_id, staff_user_id, reason, granted_by, expires_at) values ('a0000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000008', 'Prazo longo demais aqui', '10000000-0000-4000-8000-000000000007', now() + interval '30 days')$$, '23514', 'concessão não passa de 72 horas');
select teste.como('10000000-0000-4000-8000-000000000008');
select teste.ok(teste.linhas('select 1 from public.orders') = 2, 'suporte com concessão vê os pedidos de A');
select teste.ok(teste.linhas($$select 1 from public.orders where tenant_id = 'b0000000-0000-4000-8000-000000000000'$$) = 0, 'concessão de A não abre B');
select teste.erro(format($$select public.transition_order('%s', 'accepted', 1)$$, current_setting('teste.pedido_a1')), 'pedido_nao_encontrado', 'suporte não muda pedido');
select teste.ok(teste.linhas($$update public.menu_items set price_cents = 1 returning 1$$) = 0, 'suporte não altera cardápio');
select teste.como('10000000-0000-4000-8000-000000000001');
select teste.ok(teste.linhas('select 1 from public.support_access_grants') = 1, 'dono vê quem tem acesso de suporte');
select teste.ok(teste.linhas('update public.support_access_grants set revoked_at = now() returning 1') = 1, 'dono revoga o acesso de suporte');
select teste.como('10000000-0000-4000-8000-000000000008');
select teste.ok(teste.linhas('select 1 from public.orders') = 0, 'acesso revogado não vê mais nada');
reset role;

-- Auditoria e eventos não mudam nem somem, nem pela API.
set role service_role;
select teste.erro('delete from public.audit_log', 'somente_insercao', 'auditoria não é apagada');
select teste.erro('update public.order_events set reason = $$x$$', 'somente_insercao', 'eventos de pedido não são editados');
select teste.erro('delete from public.orders', 'exclusao_proibida', 'pedidos não são apagados');
select teste.erro('update public.order_items set unit_price_cents = 1', 'somente_insercao', 'snapshot do item não muda');
select teste.erro('update public.orders set total_cents = 1, subtotal_cents = 1', 'snapshot_imutavel', 'total do pedido não muda');
reset role;

rollback;
