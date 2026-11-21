# TapFlow — Cardápio Reels

> Produto digital da **ALVO Digital**. Nome **TapFlow** adotado para o produto; a identidade visual **Lime Noir** segue em avaliação. O nome comercial não teve disponibilidade de marca verificada.

Plataforma SaaS independente de cardápio interativo em formato Reels, acessível por QR Code e NFC, com catálogo, personalização de pratos, carrinho, pedidos e acompanhamento. O pagamento real e a conexão com restaurantes ainda **não foram implementados**.

## Situação

Este repositório contém o **kit de planejamento e arranque**, não uma aplicação funcional nem uma publicação online. Não há banco criado, deploy, serviço pago ou checkout real.

## Documentos para começar

- [Documento mestre (PRD)](docs/PRD.md)
- [Pesquisa de concorrentes, open source e roadmap — 21/11/2026](docs/PESQUISA_ESTRATEGICA_2026.md)
- [Decisões propostas de arquitetura — ADR-001](docs/ADR_STACK_001.md)
- [Prompt de arranque — Fases 0 e 1](docs/PROMPT_CODEX_FASE_0_1.md)
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
supabase/migrations/        migrações (futuro; banco próprio)
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

## Demonstração interativa (branch de desenvolvimento)

A primeira jornada navegável está em `apps/web/`. Execute `npm run dev` a partir da raiz (Node 20+) e abra `http://127.0.0.1:4173`.
O comando `npm test` valida regras locais de preços, adicionais e estados; mais informações em [docs/PROTOTIPO_DEMO.md](docs/PROTOTIPO_DEMO.md).

**Atenção:** fotos, pedidos, preços e cozinha são demonstrativos. Nenhuma integração real de pagamento, NFC, QR, banco ou restaurante foi ativada.


### Mídia de demonstração

O Burger da Brasa possui um clipe WebM com licença CC BY 4.0 e atribuição. Reproduz mudo apenas quando permitido e tem foto de fallback. Leia [Mídias de demonstração](docs/MIDIAS_DEMO.md). Ainda não há infraestrutura de vídeo do TapFlow.


### Reproduzir o Worker demonstrativo

Execute `npm run build:preview` para gerar `.build/tapflow-preview-worker.mjs` a partir de `apps/web` sem acessar a rede, sem segredos e **sem publicar**. O preview na Cloudflare usa binding D1 `DB`, na conta exclusiva TapFlow; a configuração está no PR #5. Essa embalagem do frontend é temporária e será substituída por Workers Static Assets.
