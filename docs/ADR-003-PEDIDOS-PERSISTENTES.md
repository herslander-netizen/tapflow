# ADR-003 — Pedido persistente no D1 (API interna, não implantada)

**Status:** contrato de serviço + testes; **sem endpoints reais habilitados**. Esta versão está no PR #4, em branch isolada. O banco e esquema do PR #5 permanecem separados até revisão de integração.

## Escopo
- `apps/api/order-service.mjs` prepara `POST /v1/quotes`, `POST /v1/orders` e `GET /v1/orders/:id`.
- `createOrderApi` não funciona sem **enabled=true**, banco D1 e **authorizeSession(request)** implementado por servidor confiável.
- O contrato de `authorizeSession` devolve tenantId, locationId, tableId e sessionHash (SHA-256) verificados pela autenticação do backend. Jamais produzir este objeto lendo headers como X-Tenant, querystring ou JSON do usuário.
- Toda chamada confirma tenant, unidade e mesa ativa no D1. O preço vem apenas de `menu_items` e `menu_addons`; o cliente não pode enviar valores, tenant ou mesa.
- `db.batch()` transacional grava pedido, idempotência, snapshot das linhas e evento de criação. O ID do pedido é estável para tenant/sessão/chave; em reenvio idêntico retorna o mesmo pedido. Outra carga na mesma chave responde 409.
- A instrução SQL de inserção é condicionada a itens e adicionais ainda disponíveis e com preços inalterados, evitando cotar um preço e persistir outro após mudança.
- `GET` confere tenant/unidade/mesa/sessão; não informa pedidos alheios.
- Não existem pagamentos, mensagens Evolution ou atualização de status por agentes.

## Limites/pendências
1. A verificação real de sessão QR/NFC (assinatura, expiração, revogação e proteção contra repetição/abuso) **não foi implementada**, por isso a API não pode ser ativada.
2. Os testes usam D1 simulado para avaliar SQL e contrato. **Testes transacionais concorrentes num banco D1 real continuam obrigatórios** (incluindo rollback, mudanças de preço no meio da compra e colisões sob carga).
3. Adicionar rate limits, idempotência por sessão com expiração/limpeza, eventos de auditoria, autenticação do estabelecimento e painel KDS. Não disponibilizar endpoint público até esses controles.
4. A consulta de preço é feita antes do batch; por isso os testes em D1 real precisam validar precisamente os guards e o tratamento de erros de concorrência.
5. Eventos de pedido não geram WhatsApp automaticamente. Evolution Alvo está preparada no PR #5, mas sem credencial e sem instância pareada.

## Critérios de segurança
- Dados reais só com consentimento, LGPD, isolamento multi-tenant, backups, observabilidade e autenticação de staff.
- Pagamentos e notificações continuam desligados.
- Nenhuma nova assinatura, Worker, banco ou cobrança criada nesta etapa.

Referência: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
