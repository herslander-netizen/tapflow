# TapFlow: fila de pedidos do piloto

O adaptador `createMerchantKitchen({enabled,origin,db,verifyIdentity})` é independente da vitrine e do checkout e fica bloqueado sem configuração explícita. Exige a identidade externa já validada e a associação operacional ativa para o tenant e a unidade exatos do caminho. O cadastro fictício de uma vitrine não ganha associação. A migração 0010 é aditiva e não concede acesso.

Todas as rotas usam `Authorization: Bearer <token>` e respostas sem cache. Escritas exigem o cabeçalho `Origin` exato e JSON.

- `GET /v1/merchant/kitchen/units`: unidades ativas do usuário com seus papéis (até 100, sinalizando limite).
- `GET /v1/merchant/kitchen/:tenantId/:locationId/orders`: lista até 50, ativos primeiro, sem credenciais, identificadores de sessão ou dados de contato.
- `GET /v1/merchant/kitchen/:tenantId/:locationId/orders/:orderId`: resumo e itens registrados, incluindo observações para o preparo, e `order.allowedTransitions`.
- `POST /v1/merchant/kitchen/:tenantId/:locationId/orders/:orderId/transition`: `{expectedStatus,status,reason?}`. Se a UI estiver desatualizada, ou a transição não for permitida, responde 409 sem mutar. Sem associação adequada, 404. Rejeitar exige motivo de até 240 caracteres sem caracteres de controle; não registre dados pessoais no motivo.

A sequência operacional autorizada é recebido → aceito → preparando → pronto → entregue, com opção de rejeitar a partir de recebido. Proprietário e gerente podem operar toda a sequência; atendente aceita, rejeita ou entrega; visualizador só lê. O piloto não dispõe de um perfil separado de cozinha. Pedido com pagamento diferente de `not_required` não pode ser alterado por esta rota. Cancelamento, reembolso, acesso a históricos extensos, notificações e atualização em tempo real não são habilitados aqui.

Cada transição verifica autorização, estado esperado e unidade no mesmo comando transacional. O gatilho confirma a mudança e cria um evento auditável; se falhar, o estado não muda. Comece em D1 isolado com dados de teste. Só configure as rotas hospedadas quando a identidade e a política de implantação estiverem verificadas; não habilite pedidos reais como efeito do painel.
