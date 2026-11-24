-- F2-01 a F2-04: pagamento online. Nenhum PSP real: eventos simulados entram como se a API
-- já tivesse verificado a assinatura (p_signature_valid).

set role service_role;
create temp table o as select teste.pedido('token-teste-mesa-a1-000000000000000001',
  '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000001"]}]', 'online') as j;
grant select on o to anon, authenticated, service_role;
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'pending', 'pedido online nasce aguardando pagamento');

select teste.erro($$select servico.start_payment((select (j ->> 'order_id')::uuid from o), 'banco_x', 'pix', 'ref-1')$$, '23514', 'provedor fora da lista é recusado');
create temp table i1 as select servico.start_payment((select (j ->> 'order_id')::uuid from o), 'sandbox', 'pix', 'sbx-ref-0001') as j;
select teste.ok((select (j ->> 'amount_cents')::int from i1) = 3000, 'valor da cobrança vem do pedido');
select teste.ok((servico.start_payment((select (j ->> 'order_id')::uuid from o), 'sandbox', 'pix', 'sbx-ref-0002') ->> 'replayed')::boolean, 'segunda tentativa em aberto devolve a mesma');

-- Assinatura inválida: ignorado e registrado como evento de segurança.
select teste.ok(servico.record_payment_event('sandbox', 'evt-falso', 'sbx-ref-0001', 'paid', 3000, false) ->> 'result' = 'ignored', 'assinatura inválida é ignorada');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'pending', 'pedido continua aguardando');
select teste.ok(exists (select 1 from public.security_events where kind = 'webhook_assinatura_invalida'), 'tentativa registrada em security_events');

-- Valor divergente não vira pago.
select teste.ok(servico.record_payment_event('sandbox', 'evt-valor', 'sbx-ref-0001', 'paid', 1, true) ->> 'note' = 'valor_divergente', 'valor divergente não marca pago');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'pending', 'pedido segue aguardando após valor divergente');

-- Pago, repetido e fora de ordem.
select teste.ok(servico.record_payment_event('sandbox', 'evt-pago', 'sbx-ref-0001', 'paid', 3000, true) ->> 'result' = 'applied', 'pagamento confirmado aplicado');
select teste.ok(servico.record_payment_event('sandbox', 'evt-pago', 'sbx-ref-0001', 'paid', 3000, true) ->> 'result' = 'duplicate', 'webhook repetido é deduplicado');
select teste.ok(servico.record_payment_event('sandbox', 'evt-atrasado', 'sbx-ref-0001', 'pending', 3000, true) ->> 'note' = 'nao_regride_pago', 'pendente atrasado não regride pago');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'paid', 'pedido pago');
select teste.ok((select count(*) from public.payment_events where payment_intent_id = (select (j ->> 'payment_intent_id')::uuid from i1)) = 3, 'todo evento verificado fica registrado');
select teste.erro($$select servico.start_payment((select (j ->> 'order_id')::uuid from o), 'sandbox', 'pix', 'sbx-ref-0003')$$, 'pagamento_ja_iniciado_ou_pago', 'pedido pago não abre nova cobrança');
select teste.ok(servico.record_payment_event('sandbox', 'evt-desconhecido', 'sbx-ref-xxxx', 'paid', 3000, true) ->> 'reason' = 'intencao_desconhecida', 'evento sem cobrança conhecida não aplica');
reset role;

-- Equipe: o pagamento só aparece para dono/gerente; pedido pago rejeitado abre reembolso.
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.ok(teste.linhas('select 1 from public.payment_intents') = 0, 'atendente não vê detalhes do pagamento');
select teste.ok(teste.linhas('select 1 from public.orders where payment_status = ''paid''') = 1, 'atendente vê que o pedido está pago');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from o), 'rejected', 1, 'ingrediente acabou') ->> 'payment_status' = 'refund_pending', 'rejeitar pedido pago abre reembolso');
select teste.como('10000000-0000-4000-8000-000000000002');
select teste.ok(teste.linhas('select 1 from public.payment_intents') = 1, 'gerente da unidade vê o pagamento');
select teste.ok(teste.linhas('select 1 from public.refunds where status = ''requested'' and amount_cents = 3000') = 1, 'reembolso pedido no valor pago');
select teste.como('10000000-0000-4000-8000-000000000006');
select teste.ok(teste.linhas('select 1 from public.payment_intents') + teste.linhas('select 1 from public.refunds') = 0, 'outro tenant não vê pagamento nem reembolso');
reset role;

set role service_role;
select teste.ok(servico.record_payment_event('sandbox', 'evt-estorno-1', 'sbx-ref-0001', 'refunded', 1000, true) ->> 'result' = 'applied', 'estorno parcial aplicado');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'partially_refunded', 'pedido parcialmente estornado');
select teste.ok(servico.record_payment_event('sandbox', 'evt-estorno-2', 'sbx-ref-0001', 'refunded', 5000, true) ->> 'note' = 'reembolso_invalido', 'estorno acima do pago é recusado');
select teste.ok(servico.record_payment_event('sandbox', 'evt-estorno-3', 'sbx-ref-0001', 'refunded', 2000, true) ->> 'result' = 'applied', 'restante estornado');
select teste.ok((select payment_status || ':' || refunded_cents from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'refunded:3000', 'pedido totalmente estornado');
select teste.ok((select status from public.orders where id = (select (j ->> 'order_id')::uuid from o)) = 'rejected', 'pedido continua registrado como rejeitado (nada apagado)');
select teste.erro($$delete from public.payment_events$$, 'somente_insercao', 'eventos de pagamento não são apagados');
select teste.erro($$delete from public.refunds$$, 'exclusao_proibida', 'reembolsos não são apagados');

-- Pago chega depois de o pedido ser cancelado.
create temp table o2 as select teste.pedido('token-teste-mesa-a1-000000000000000001', '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000002"]}]', 'online') as j;
grant select on o2 to authenticated;
select servico.start_payment((select (j ->> 'order_id')::uuid from o2), 'sandbox', 'card', 'sbx-ref-0100') is not null as x;
reset role;
set role authenticated;
select teste.como('10000000-0000-4000-8000-000000000003');
select teste.ok(public.transition_order((select (j ->> 'order_id')::uuid from o2), 'cancelled', 1, 'cliente foi embora') ->> 'status' = 'cancelled', 'pedido cancelado antes do pagamento');
reset role;
set role service_role;
select teste.ok(servico.record_payment_event('sandbox', 'evt-tardio', 'sbx-ref-0100', 'paid', 3000, true) ->> 'result' = 'applied', 'pagamento tardio é registrado');
select teste.ok((select payment_status from public.orders where id = (select (j ->> 'order_id')::uuid from o2)) = 'refund_pending', 'pagamento após cancelamento vira reembolso pendente');

-- Pagamento presencial não aceita cobrança online.
create temp table o3 as select teste.pedido('token-teste-mesa-a1-000000000000000001', '[{"item":"a4000000-0000-4000-8000-000000000001","mods":["a6000000-0000-4000-8000-000000000002"]}]', 'in_person') as j;
select teste.erro($$select servico.start_payment((select (j ->> 'order_id')::uuid from o3), 'sandbox', 'pix', 'sbx-ref-0200')$$, 'pagamento_presencial', 'pedido com pagamento no local não gera cobrança');
reset role;

rollback;
