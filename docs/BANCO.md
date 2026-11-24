# Banco do TapFlow

**Situação em 24/11/2026:**
- As migrações, a RLS, as funções e os testes estão escritos e passam num Postgres local, nas versões 16 e 17 (17 é a do CI).
- Nenhum projeto Supabase foi criado.
- Nada foi aplicado em banco remoto.
- Os projetos de Flow, Alvo OS e Evolution Alvo não foram tocados.

Fontes: PRD, seções 03 (papéis), 08 (modelo de dados), 09 (estados e checkout idempotente) e 10 (segurança).

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `supabase/migrations/20261124000100_fundacao.sql` | Esquemas `private` e `servico`, tenants, unidades, equipe, equipe ALVO, concessões de suporte e funções de autorização |
| `…000200_mesas_cardapio.sql` | Mesas, tokens de QR/NFC (só hash), sessões de convidado, categorias, itens, mídia, grupos de adicionais |
| `…000300_carrinho_pedidos.sql` | Carrinho, cotação, pedido com snapshot imutável, eventos, comanda da cozinha, chamados da mesa |
| `…000400_pagamentos_confiabilidade.sql` | Pagamentos, eventos do PSP, reembolsos, inbox de webhooks, outbox, idempotência, auditoria, SaaS, analytics sem dados pessoais |
| `…000500_rls.sql` | Permissões e políticas de RLS de todas as tabelas |
| `…000600_funcoes.sql` | Regras de negócio: cardápio público, mesa, cotação, pedido, estados, pagamento |
| `…000700_storage_realtime.sql` | Bucket privado de mídia por tenant e publicação do realtime (só se o Supabase existir) |
| `supabase/seed/demo.sql` | Restaurante fictício marcado `is_demo` |
| `tests/integration/banco/` | Imitação mínima do Supabase, apoio e 4 arquivos de teste |

## Tabelas (36)

- **Organização:**
  - `tenants`, `locations`, `tenant_memberships`;
  - `platform_staff` e `support_access_grants`, para a equipe ALVO.
- **Mesas:** `dining_tables`, `table_access_tokens`, `guest_sessions`.
- **Cardápio:** `menu_categories`, `menu_items`, `item_media`, `modifier_groups`, `modifiers`, `item_modifier_groups`.
- **Carrinho:** `carts`, `cart_items`, `checkout_quotes`.
- **Pedido:** `orders`, `order_items`, `order_item_modifiers`, `order_events`, `kitchen_tickets`, `service_requests`.
- **Pagamento:** `payment_intents`, `payment_events`, `refunds`.
- **Confiabilidade:** `webhook_inbox`, `outbox_events`, `idempotency_keys`.
- **Auditoria:** `audit_log`, `security_events`.
- **SaaS:** `subscriptions`, `usage_counters`, `tenant_integrations`.
- **Analytics:** `privacy_safe_events`, `daily_metrics`.

O PRD não lista `checkout_quotes`, `platform_staff` e `support_access_grants`. Elas foram acrescentadas porque o contrato de checkout (9.4) e o acesso de suporte auditável (seção 03) dependem delas.

**Convenções:**
- Dinheiro em centavos inteiros, sempre em BRL.
- Estados em texto com `CHECK`.
- Chaves estrangeiras compostas `(tenant_id, id)`: um registro não consegue apontar para outro tenant.
- Nada é apagado:
  - pedidos, pagamentos, itens de cardápio e mesas mudam de estado em vez de sumir;
  - eventos, snapshots e auditoria aceitam só inserção, com bloqueio também de `TRUNCATE`.

## Quem vê o quê

| Papel | Lê | Escreve |
| --- | --- | --- |
| Anônimo | Nenhuma tabela. Só `public_menu`, `resolve_table` e `track_order` (este com o token do pedido) | Nada direto: tudo passa pela API |
| Cozinha | Pedidos, comandas e mesas da própria unidade; cardápio | Preparo e pronto; esgotar item |
| Atendente | Mesmo que a cozinha, mais sessões e chamados da mesa | Aceitar, rejeitar, concluir e cancelar antes do preparo; chamados |
| Gerente | Unidade(s) delegada(s), incluindo pagamentos e reembolsos | Cardápio, mesas, token de QR. Convida atendente e cozinha **na própria unidade** |
| Proprietário | Tenant inteiro, auditoria, plano e integrações | Tudo do tenant; convida qualquer papel; revoga suporte |
| Admin ALVO | Tenants, planos, consumo, integrações, eventos de segurança | Concede acesso de suporte. **Não lê pedidos nem cardápio** |
| Suporte ALVO | Só com concessão vigente (máx. 72 h), só leitura, só daquele tenant | Nada |
| API (`service_role`) | Tudo | Funções `servico.*` |

**Detalhes:**
- Quem é da cozinha ou do atendimento vê o `payment_status` do pedido, mas não os dados de pagamento.
- O hash do token de acompanhamento não é legível por ninguém da equipe.

## Funções

**Públicas** (`anon`):
- `resolve_table(token)`: devolve restaurante, unidade e mesa (C01). Dá nulo se o token foi revogado ou venceu, ou se a unidade está fechada.
- `public_menu(tenant_slug, location_slug)`: cardápio publicado.
  - Mostra só mídia pronta.
  - Sem estoque e sem nada operacional.
- `track_order(tracking_token)`: status, linha do tempo e itens do pedido (C07). Serve também como consulta de reserva quando o realtime cai (F1-09).

**Equipe** (`authenticated`):
- `transition_order(order_id, to, expected_version, reason)`: máquina de estados do PRD 9.1.
  - Confere o papel e a versão (concorrência otimista).
  - Exige motivo para rejeitar ou cancelar.
  - Devolve o estoque.
  - Abre reembolso se o pedido já estava pago.
  - Grava evento, outbox e auditoria.
- `rotate_table_token(table_id, reason)`: revoga o token anterior. O token novo aparece **só** nesta resposta.
- `set_item_availability(item_id, availability)`: esgotar ou voltar um item, sem acesso ao preço.

**API** (`servico.*`, só `service_role`):
- `create_guest_session(table_token | tenant_slug + location_slug, origin)`: sessão anônima de 4 h e carrinho.
- `quote_cart(session_token)`: o preço vem do banco, não do cliente.
  - Confere adicionais (mínimo, máximo, grupo do item e tenant), publicação, disponibilidade e estoque.
  - A cotação vale 10 min.
- `place_order(session_token, quote_id, idempotency_key, payment_mode, …)`: tudo numa só transação.
  - Revalida preço, disponibilidade e estoque.
  - Baixa o estoque.
  - Grava o snapshot imutável e o código de retirada.
  - Gera o token de acompanhamento (7 dias).
  - A mesma chave devolve a mesma resposta; a mesma chave com outro conteúdo é recusada.
- `start_payment(order_id, provider, method, provider_reference)`: o valor vem do pedido. Fica uma tentativa aberta por pedido.
- `record_payment_event(provider, event_id, reference, status, amount, signature_valid, …)`:
  - deduplica pelo inbox;
  - ignora assinatura inválida e registra `security_events`;
  - não marca pago com valor divergente;
  - nunca regride `paid`;
  - aceita estorno parcial até o valor pago;
  - registra pagamento que chega depois de um cancelamento e abre reembolso.
- `create_service_request(session_token, kind)`: chamar atendimento, pedir a conta ou recuperar pedido. Repetir devolve o mesmo chamado.

**Erros:** saem com `SQLSTATE P0001` e um código estável na mensagem, para a API traduzir:

`sessao_expirada`, `mesa_invalida`, `carrinho_vazio`, `item_esgotado`, `item_indisponivel`, `adicional_invalido`, `adicionais_fora_do_limite`, `cotacao_expirada`, `cotacao_usada`, `preco_alterado`, `chave_idempotencia_reutilizada`, `versao_conflitante`, `transicao_invalida`, `motivo_obrigatorio`, `sem_permissao`, `pagamento_presencial`…

## Testes

```sh
# Precisa de um Postgres descartável (o script cria e apaga só o próprio banco temporário).
PGHOST=localhost PGPORT=5432 PGUSER=postgres tests/integration/banco/rodar.sh
```

Resultado desta branch: **168 verificações, todas passando**.

| Arquivo | Verificações | Cobre |
| --- | --- | --- |
| `teste-isolamento.sql` | 64 | Anônimo; tenant × tenant; unidade × unidade; cozinha sem dinheiro; convite e escalonamento de papel; admin e suporte com prazo e revogação; append-only |
| `teste-pedido.sql` | 57 | Mesa e rotação de token; cardápio público; cotação; adicionais; idempotência; preço alterado; cotação vencida; estoque; estados e permissões; trilha; acompanhamento; chamados |
| `teste-pagamento.sql` | 34 | Assinatura inválida; valor divergente; webhook repetido e fora de ordem; reembolso ao rejeitar pedido pago; estornos parciais; pagamento após cancelamento |
| `teste-storage.sql` | 13 | Pasta por tenant; quem envia e quem lê; mídia só aparece pronta |

Prova de que os testes pegam vazamento: ao trocar a política de leitura de `orders` por `using (true)`, o `teste-isolamento.sql` falha em "dono de B não vê pedidos de A".

`tests/integration/banco/supabase-local.sql` imita só o necessário do Supabase:
- os papéis `anon`, `authenticated` e `service_role`;
- `auth.users` e `auth.uid()`;
- `storage.objects`;
- a publicação do realtime;
- as concessões padrão em `public`, para provar que as migrações as retiram.

Não substitui um ensaio num projeto Supabase de verdade.

## O que falta (não feito)

1. **Projeto Supabase próprio do TapFlow (prévia).**
   - Precisa de autorização explícita (AGENTS.md, item 4).
   - Pode ter custo se sair do plano gratuito.
   - Hoje a conta tem só o projeto `alvo-os`, que não deve ser usado.
2. **Aplicar e conferir no Supabase real:**
   - rodar as migrações;
   - ler os avisos de segurança e desempenho;
   - ensaiar a RLS do Storage com upload real;
   - testar o realtime com assinatura autenticada.
3. **A API (Cloudflare Worker), que ainda não existe:**
   - verificação de assinatura dos webhooks;
   - rate limit por sessão, IP e mesa;
   - URLs assinadas da mídia;
   - log estruturado das recusas (`denied`);
   - tradução dos códigos de erro.
4. **Esquema `servico` exposto à API.** Ou o Worker conecta direto no Postgres, ou o `servico` entra nos esquemas expostos com execução só para `service_role`. Precisa de decisão.
5. **Rotinas que ainda não existem:**
   - expirar sessões, cotações, chaves de idempotência e carrinhos abandonados;
   - processar o outbox;
   - agregar `daily_metrics`.
6. **Decisões em aberto:**
   - escolha do PSP (ADR-007);
   - regras de cancelamento e reembolso (ADR-009);
   - limites por plano (ADR-010);
   - política de retenção e anonimização (LGPD).
7. **Funções novas no esquema `public`.** O Supabase concede execução a `anon` por padrão. Toda migração futura precisa revogar e conceder explicitamente, como a `0600` faz.
