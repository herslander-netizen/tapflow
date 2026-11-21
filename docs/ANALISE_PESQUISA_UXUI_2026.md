# TapFlow | Parecer técnico sobre a pesquisa aprofundada
Data: 21/11/2026 · ALVO Digital · Escopo: UX/UI e MVP demonstrativo.

## Decisão executiva
A pesquisa cobre bem sistemas de restaurante, mas generaliza em excesso a categoria de produtos. Para o TapFlow, a tese distinta é **descoberta visual por vídeo vertical com conversão simples**, ao lado de **navegação clássica opcional para usuários que querem rapidez, acessibilidade ou economia de dados**.

## O que aproveitar
- **Toast Mobile Order & Pay**: entrada por QR, pedido e pagamento no celular. Fonte primária: https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview
- **Sunday / me&u**: benchmark de fluxo na mesa e menor atrito. Verificar especificamente disponibilidade e limitações por país antes de planejar integrações.
- **iFood**: referência de clareza de preço, descrição, personalização e histórico, não de marketplace obrigatório.
- **Acerkt**: inspiração em descobrir o prato por conteúdo vertical. Não copiar telas, identidade, vídeos, marca ou código.

## Correções importantes do relatório
1. Percentuais como "75% dos restaurantes usam QR", "78% preferem QR" e "25–30% de ganho" vieram principalmente de blogs comerciais sem método verificável. Não tratar como estatísticas universais, hipóteses aprovadas ou previsões de receita.
2. O relatório propôs **aplicativos nativos iOS e Android**, Kubernetes e infraestrutura gerenciada antes de validação. Isso eleva custo e manutenção sem necessidade comprovada. Priorizar **web responsiva/PWA** que abre no navegador; avaliar app nativo quando existirem restrições reais.
3. "Offline" não significa abrir um cardápio nunca visitado nem confirmar pedidos sem rede. Cache de catálogo **previamente carregado** pode permitir leitura com aviso de desatualização; **pedidos e pagamentos exigem comunicação e confirmação verificável**.
4. WCAG 2.2 AA: o critério de tamanho mínimo de alvo é **24×24 CSS px com exceções**; escolher **44–48 px como meta de conforto**. Contraste mínimo de texto normal 4,5:1. Fontes: https://www.w3.org/TR/WCAG22/ e https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
5. O texto associou a LGPD a uma regra genérica de comunicação em 72 horas. A **Resolução CD/ANPD nº 15/2024** prevê, para incidentes comunicáveis, **três dias úteis**, ressalvadas situações legais específicas. Fonte primária: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
6. A acessibilidade deve incluir modo lista, foco/teclado, leitor de tela, redução de movimento e textos de ingredientes/alergênicos claros; elementos críticos não podem depender exclusivamente de vídeos.
7. Fotos de terceiros e vídeos de demonstração não equivalem a conteúdo licenciado do restaurante: identificar material ilustrativo e origem.

## Direção refinada de UX
**Identidade-base:** Lime Noir. Grafite-verde #101410, superfícies #1E241F, lima #C8F45D, texto #F5F7F2, texto secundário #9BA79B. O tema ainda é uma proposta, não identidade aprovada em definitivo.
**Estrutura:** topo reduzido com restaurante e mesa; feed vertical com um item por quadro, preço/CTA sempre legíveis; lista com busca e categorias; detalhe em sheet com adicionais e alergênicos; carrinho sem taxas-surpresa; pedido/status separado de pagamento.
**Regra de vídeo:** poster imediato; somente 1 mídia com reprodução ativa; áudio inicial mudo quando aplicável; não baixar todos os vídeos; parar fora do viewport; oferecer navegação sem vídeo.
**Operação:** ênfase em novo pedido, preparo, pronto e entregue, com separação entre status operacional e financeiro.
**Cópia:** simples, objetiva, sem excesso de pílulas decorativas; botões com verbos claros.

## Regras de implementação
- Repositório único autorizado: herslander-netizen/tapflow. A aplicação demonstrativa ocupa apps/web.
- A primeira versão não autentica, não salva em banco e não recebe pedidos reais. **Tela da equipe é demonstrativa e não protegida**; não pode ser publicada como painel operacional.
- Não acionar Supabase, Cloudflare, Oracle, Railway, Evolution ou PSP sem autorização separada. Jamais usar projetos de Flow, Evolution Alvo ou Alvo OS.
- Todos os valores demonstrativos são em centavos. Futuro backend será único responsável por preço, estoque, mesas, idempotência e estados financeiros.
- **Metas para validação, não resultados medidos:** LCP ≤ 2,5 s; INP ≤ 200 ms; CLS ≤ 0,1 no p75 (https://web.dev/articles/vitals).
- Teste de usabilidade: 5–8 clientes em rede móvel real + 3 operadores de cozinha/atendimento, com tarefas de localizar, personalizar, finalizar demo, recuperar pedido e pausar vídeo.
- Comparar **Feed versus Lista** pela taxa de adição, abandono, tempo para finalizar e bytes consumidos; não assumir vantagem do feed.

## Backlog priorizado após a primeira demo
P0: auditoria visual em dispositivos reais, testes de fluxo, navegação e contraste, mídia própria/licenciada, melhor tratamento de erro e baixa conexão.
P1: autorização, tenância, cadastro de restaurantes e pratos, mesa QR/NFC, API de pedido idempotente, painel protegido e cozinha.
P2: PSP sandbox, webhooks validados, reconciliação, cancelamento/reembolso, só então pagamentos de produção após homologação.
P3: funil de produto, fidelidade opt-in, integrações de POS e delivery conforme demanda.

## Estado da entrega
Aplicação de demonstração em branch de revisão; **nenhum resultado de build, teste automatizado, navegação visual real, deploy, pedido de restaurante ou pagamento é afirmado até verificação**.
