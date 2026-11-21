# TapFlow: cadastro assistido e catálogo do piloto

O cadastro é interno, não um sistema de autocadastro. A operação da Alvo Digital verifica a identidade no provedor externo e aprova uma entrada exata `{issuer, subject, slug}` no ambiente isolado do piloto. Use um sujeito de teste e não comite essa lista nem tokens. A autorização depende do token de acesso RS256 validado no servidor; o slug e o papel enviados pelo navegador nunca concedem acesso. Configure a origem exata. Requisições de escrita exigem essa origem no cabeçalho `Origin`, além do token no `Authorization: Bearer <access-token>`.

A migração aditiva 0009 não concede acesso. A criação, quando autorizada, grava em uma transação o tenant, a unidade inicial, a autoridade administrativa, a associação operacional da unidade e o registro de consumo da autorização. Repetir a criação devolve 409 e o tenant já existente aparece em `GET /v1/merchant/tenants`. Não há exclusão, transferência, criação de novos proprietários nem ativação de usuários reais por esta API. Revogar um proprietário exige desativar sua autoridade em `merchant_owners` e suas associações operacionais em `order_staff_memberships`; catálogo e operação têm autorizações distintas. Desativar o flag da rota interrompe a API sem remover dados.

## API no ambiente isolado

- `GET /v1/merchant/tenants`: `{tenants:[{id,slug,name}]}`. Retorna somente os tenants ativos do proprietário autenticado.
- `POST /v1/merchant/tenants`: `{slug,name,locationName}` → 201 com `{tenant:{id,slug,name},location:{id,name}}`.
- `GET /v1/merchant/tenants/:tenantId/catalog`: `{locations,categories,items,addons}`, com IDs, todos os campos de edição e status; não é um menu público. Limite de leitura do piloto: 250 registros por coleção; não é paginação de produção.
- `POST /v1/merchant/tenants/:tenantId/:resource` → 201 com `{id}`. `PATCH /v1/merchant/tenants/:tenantId/:resource/:id` → 200 com `{id}`. Envie a representação completa de edição: opcionais omitidos são redefinidos aos valores padrão, e o escopo original não é transferido.

| Recurso | Campos JSON |
|---|---|
| `locations` | `name` |
| `categories` | `locationId,name,sortOrder?,isActive?` (padrões 0 e true) |
| `items` | `locationId,categoryId?,name,description?,priceCents,availability?` (categoria/texto nulos e estado `hidden` por padrão) |
| `addons` | `locationId,itemId,name,priceCents,isAvailable?` (padrão true) |

O catálogo guarda preços inteiros em centavos BRL e usa as mesmas tabelas de produtos e adicionais do cálculo de pedido existente. Não habilita pedidos, pagamentos, mídia remota ou notificações. Unidade, categoria e item precisam pertencer ao mesmo tenant; a categoria é restrita à mesma unidade. Produtos novos ficam ocultos salvo escolha explícita. O cardápio público tem habilitação e publicação independentes.
