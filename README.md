# TapFlow — Cardápio Reels

> Produto digital da **ALVO Digital**. Nome **TapFlow** adotado para o produto; a identidade visual **Lime Noir** segue em avaliação. O nome comercial não teve disponibilidade de marca verificada.

Plataforma SaaS independente de cardápio interativo em formato Reels, acessível por QR Code e NFC, com catálogo, personalização de pratos, carrinho, pedidos e acompanhamento. O pagamento real e a conexão com restaurantes ainda **não foram implementados**.

## Situação

Este repositório contém o **kit de planejamento e arranque**, não uma aplicação funcional nem uma publicação online. Não há banco criado na nuvem, deploy, serviço pago ou checkout real.

O esquema do banco (migrações, RLS, funções de pedido e pagamento e testes de isolamento) está em `supabase/` e foi testado só num Postgres local. Veja [Banco](docs/BANCO.md).

## Documentos para começar

- [Documento mestre (PRD)](docs/PRD.md)
- [Pesquisa de concorrentes, open source e roadmap — 21/11/2026](docs/PESQUISA_ESTRATEGICA_2026.md)
- [Decisões propostas de arquitetura — ADR-001](docs/ADR_STACK_001.md)
- [Prompt de arranque — Fases 0 e 1](docs/PROMPT_CODEX_FASE_0_1.md)
- [Banco: tabelas, permissões, funções e testes](docs/BANCO.md)
- [Backlog](docs/BACKLOG.csv)
- [Tokens de identidade propostos](packages/ui/tokens/lime-noir.json)
- [Diretrizes permanentes de agentes](AGENTS.md)

## Estrutura prevista

```text
apps/web/                   interface do consumidor e estabelecimento
apps/api/                   backend e endpoints (futuro)
packages/ui/                componentes e design tokens
packages/domain/            regras e invariantes do negócio
packages/contracts/         contratos e esquemas de validação
supabase/migrations/        migrações com RLS (banco próprio, ainda não aplicadas)
supabase/seed/              dados fictícios para testes
tests/unit/                 testes de unidade
tests/integration/          testes de integração
tests/e2e/                  testes ponta a ponta
docs/                       requisitos, backlog e execução
```

## Regras de segurança

- Não reutilizar ou alterar infraestrutura, repositórios, banco, chaves, domínios ou webhooks do Flow, Alvo OS e Evolution Alvo.
- Um novo banco Supabase e uma nova aplicação Cloudflare deverão ser criados **somente mediante autorização própria**.
- Nunca inserir credenciais reais no Git. Usar `.env.example` para nomes de variáveis, sem valores privados.
- Na fase inicial, utilizar somente dados fictícios e simulações identificadas; sem pagamento real.

## Primeira execução

Leia `docs/PRD.md` e execute apenas o escopo permitido em `docs/PROMPT_CODEX_FASE_0_1.md`. A stack e as integrações devem ser confirmadas antes da implementação. A interface é em português brasileiro, mobile-first, com atenção a acessibilidade e desempenho.

---

**Proprietária:** ALVO Digital · **Status:** documentação inicial · **Sem vínculo com a KAIRÓS Produtora**