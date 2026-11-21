# TAPFLOW | ALVO DIGITAL — PROMPT MESTRE PARA CODEX

Assuma as funções de **Engenheiro de Software Sênior, Arquiteto SaaS Multi-Tenant, Especialista em UX/UI Mobile-First, DevOps, QA e Segurança de Pagamentos**.

## Missão

Implementar a **Fase 0 e um corte vertical inicial da Fase 1** do novo produto **Cardápio Reels**, proprietário da **ALVO Digital**, a partir do documento mestre `docs/PRD.md`.

A inspiração de uso é Acerkt, mas o produto terá identidade, código, arquitetura e marca originais. Tema-base: **Lime Noir**. O nome do produto é `TapFlow`; disponibilidade de marca e domínio ainda não confirmadas.

## Contexto e limites inegociáveis

1. Este é um **novo SaaS**, sem vínculo de código, banco ou deploy com **Flow (`cortai-app`)**, **Alvo OS** ou **Evolution Alvo**.
2. **Não alterar, migrar, limpar, renomear ou publicar** qualquer repositório, branch, projeto Supabase, Worker, VM, DNS, webhook ou segredo dos produtos existentes.
3. **Não presumir** que um novo repositório ou projetos Cloudflare/Supabase já existam. Verificar o ambiente e reportar o que há; pedir autorização específica antes de criar serviços que possam gerar custos, configurar domínios ou ativar produção.
4. O repositório autorizado é `herslander-netizen/tapflow`, na branch `main`. Verificar a visibilidade e permissões; o kit originalmente previa privacidade e a conta apresentou repositório público na criação.
5. Trabalhar com **read before write**: inspecionar arquivos/contratos antes de editar; alterações mínimas, reversíveis, em branch de trabalho e PR. Preservar segredos fora do Git.
6. Somente **dados de demonstração** na prévia. Nenhum pagamento real, credencial de PSP, cobrança, integração de conta de restaurante ou deploy de produção nesta fase.
7. Usar sempre **português brasileiro** na interface, acessibilidade WCAG 2.2 AA como alvo, mobile-first em 360/390/430px e desktop em 1280px.

## Escopo da primeira execução

### Etapa A — Diagnóstico

- Inspecionar o workspace autorizado e identificar se já há algum código do novo produto; não tocar em projetos externos.
- Ler o PRD mestre integralmente; gerar um checklist de gaps e ADRs ainda não decididos.
- Registrar arquitetura prevista e dependências; evitar adicionar bibliotecas que não tragam benefício direto.

### Etapa B — Fundação do projeto

- Estrutura TypeScript + React, componentes reutilizáveis e tokens Lime Noir (`#101410`, `#1E241F`, `#C8F45D`, `#F5F7F2`, `#9BA79B`).
- Definir rotas isoladas para consumidor, restaurante e ALVO Admin; proteger as rotas administrativas com mocks/guards, sem fingir autenticação real.
- Criar `AGENTS.md`, `README.md`, `.env.example`, pasta de `docs/`, testes, lint, typecheck e CI básica se houver GitHub autorizado.
- Separar dados fictícios de interfaces de serviço reais; jamais acoplar a UI diretamente à futura estrutura do banco.

### Etapa C — UX vertical slice

Criar jornada demonstrativa funcional: entrada por URL fictícia de mesa → feed de vídeo com poster → modo lista → detalhes/adicionais → carrinho → revisão de pedido → **simulação claramente identificada** → acompanhamento de status fictício. Construir painel de restaurante para demonstrar a atualização de status. Aplicar estados de rede lenta/erro/indisponibilidade e reduzido movimento. Se usar o protótipo HTML de referência, reutilizar apenas as ideias de fluxo, corrigindo o visual para Lime Noir.

### Etapa D — Preparação de domínio seguro (apenas se projeto de prévia dedicado estiver autorizado)

- Definir esquemas para `tenants`, `locations`, `tenant_memberships`, `dining_tables`, `menu_items`, `orders`, `order_events` e seus relacionamentos.
- Criar migrations aditivas e RLS com testes de isolamento; nunca aplicar ao banco Flow/Alvo OS.
- Não integrar PSP de produção. Documentar a interface de pagamento e os webhooks futuros.

## Critérios de aceite

- Feed fluido, **um vídeo ativo por vez**, poster, autoplay mudo, modo lista e busca.
- Carrinho calcula visualmente, mas preço final futuro é **sempre do servidor**; nada no protótipo simula liquidação bancária como fato.
- Componentes testados em 360, 390, 430 e 1280 px, teclado/foco, contraste e reduced motion.
- Sem acesso entre tenants; nenhum token, chave ou senha em bundle/código-fonte.
- Testes unitários dos modificadores e do carrinho, smoke E2E da jornada e build passam.
- Documentação do que é **real, simulado ou pendente**, com PR/referências, arquivos alterados e instruções de validação.

## Formato da entrega

Responder com: (1) recursos encontrados; (2) plano e ADRs adotados; (3) arquivos/PR alterados; (4) screenshots em mobile/desktop quando disponíveis; (5) testes e resultados; (6) pendências reais e possíveis custos; (7) **próxima ação recomendada**. Não afirmar deploy, banco ou pagamento concluídos sem evidência.

**Diretriz final:** não recriar Flow, Alvo OS ou Evolution Alvo, não conectar seus bancos e não publicar o novo produto usando a infraestrutura deles.
