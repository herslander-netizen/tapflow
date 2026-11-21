# ADR-002 — Contratos de pedido e cotação

**Status:** implementado apenas como módulo puro e testes. Nenhuma API, banco, checkout ou pagamento real foi ativado.

## Decisão
`packages/contracts/order.mjs` define validação do pedido e cotação com catálogo filtrado por `tenantId`. O frontend nunca pode determinar o preço. O total é inteiro em centavos; adicionais são validados e deduplicados; itens indisponíveis falham.

## Antes de colocar pedidos reais
1. Criar API autenticada e persistência transacional isolada. O tenant deve ser derivado do contexto autenticado, não confiado ao corpo.
2. Implementar idempotência persistente com chave vinculada a tenant, sessão e hash canônico do pedido; concorrência e retries precisam de testes reais.
3. Criar tokens opacos e revogáveis para mesas, sem permitir leitura de pedidos de terceiros.
4. Versionar preços e emitir cotação com prazo; revalidar estoque, taxas e promoções.
5. Separar status de preparo e pagamento; nunca marcar como pago sem confirmação confiável do PSP.
6. Executar testes de isolamento multi-tenant, recuperação, rede instável e banco sob carga.
7. Não compartilhar infraestrutura do Flow, Alvo OS ou Evolution Alvo.

## Situação
O PR #4 permanece em rascunho e o TapFlow é uma demonstração. Estes contratos são o primeiro passo incremental do estudo de 21/11/2026.
