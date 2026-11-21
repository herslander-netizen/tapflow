# TapFlow · Auditoria UX/UI mobile (código + padrões externos)

**Produto:** TapFlow, ALVO Digital · **Escopo:** experiência cliente no MVP Reels. **Data:** 21/11/2026. **Referência técnica:** branch `design/tapflow-identidade-visual`, PR #8. **Estado:** auditoria de código, não auditoria visual instrumentada.

## Evidências e correções priorizadas

| ID | Prioridade | Evidência no código de origem | Impacto | Tratamento |
| --- | --- | --- | --- | --- |
| UX-01 | P0 | `apps/web/app.js:311-312, 325-332` chamavam `showDetail()` após mudar quantidade/adicionais; `showDetail()` chama `openModal()` e recria toda a árvore DOM | Perda de foco no checkbox, reinício da rolagem/teclado e mudança da posição da tela | Atualizar somente quantidade, total e disponibilidade de checkboxes |
| UX-02 | P0 | `apps/web/app.js:351-357` inicia gesto em qualquer ponto de `.reel`, inclusive controles | Navegação acidental ao tocar/arrastar próximo de botões | Ignorar controles interativos, pointercancel e direção/limiar explícitos |
| UX-03 | P0 | `styles.css` e `experience.css` definem várias posições absolutas para header, pager, botões e legendas, sem uma estratégia completa de safe areas/baixa altura | Risco de sobreposição em Android compacto, aparelhos com recorte e rotação | Layout mobile com `100dvh`, safe areas, breakpoints por altura e áreas de toque |
| UX-04 | P1 | `app.js:58-61` e `258-262` chamam `render()` global ao favoritar e mudar quantidades | Posição de rolagem e foco podem saltar | Atualizar o estado localmente ou restaurar o foco/scroll após re-render controlado |
| UX-05 | P1 | `app.js:140-148` re-renderiza todo o catálogo após escolher categoria | O foco no chip e a rolagem horizontal dos filtros se perdem | Atualizar chips, resultados e grade sem reconstruir os filtros |
| UX-06 | P1 | `app.js:214-227` não declara foco inert do restante da página; o trap contempla só `button/input/textarea` | Teclado/leitores de tela podem alcançar elementos indevidos do plano de fundo | Marcar `.app-shell` inert com diálogo aberto e incluir anchors/inputs habilitados no trap |
| UX-07 | P1 | Em catálogo, carrinho é alcançado pela barra inferior ou painel lateral; falta atalho contextual no mobile | Fricção para revisar valor/itens antes de concluir | Resumo flutuante do carrinho somente em lista/favoritos mobile, sem cobrir navegação |
| UX-08 | P1 | `styles.css` contém legendas de 9 a 11 px, inclusive menu e metadados de cards | Baixa legibilidade, especialmente com mídia atrás | Alvos legíveis >= 12px para metadados visíveis e >= 14px para leitura prolongada |
| UX-09 | P1 | `app.js:27` cria imagens sem prioridade de carregamento para hero; uma mídia externa demo é usada em `media.mjs` | Possível LCP excessivo em conexão móvel; dependência de mídia externa | Hero eager/fetchpriority high e preservação de posterior fallback; vídeo somente na etapa ativa |
| UX-10 | P2 | `app.js:40-47` renderiza aria-current='false' em abas inativas; contexto de navegação não é anunciado com `aria-label` específico por seleção | Semântica redundante | Usar somente aria-current='page' para seleção e `aria-label` claro por tela |
| UX-11 | P2 | `app.js:264-285` trata checkout em memória, enquanto D1/API não está ativa no cliente | Risco de impressão enganosa de compra real | Fortalecer microcopy "simulação" e manter proibido POST de pedido |
| UX-12 | P2 | Cores oficiais já introduzidas no PR #8, mas ainda existem regras legadas escuras em `styles.css`, sobrescritas em CSS | Possível inconsistência de estados e contrastes em modais/lista/cozinha | Tokens e CSS de acabamento mantendo o lettering oficial |

## Padrões externos de referência
- **WCAG 2.2, W3C** — tamanho de alvo mínimo AA 24 CSS px com exceções, foco visível, zoom/reflow, 1.4.3 contraste texto. Meta de conforto TapFlow: **44 × 44 px** nas ações importantes. https://www.w3.org/TR/WCAG22/
- **Android Material — padrões de navegação** — barra inferior para 3–5 destinos do mesmo nível. O TapFlow usa quatro destinos prioritários no mobile. https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- **Google web.dev Core Web Vitals** — objetivos de campo no percentil 75: LCP <= 2,5 s, INP <= 200 ms, CLS <= 0,1. **Não medidos nesta auditoria**, dependem de tráfego e aparelho reais. https://web.dev/articles/vitals
- **Android** — contraste e metas de toque não substituem QA com TalkBack, teclado, landscape e conexão reduzida.

## Matriz de QA antes da publicação

| Dispositivo/estado | Critério |
| --- | --- |
| Android 360 × 640 | Header/logo e CTA da mídia visíveis, nav acessível, overlay sem se sobrepor a preço |
| Android 390 × 844 | Navegar feed por swipe e controle; botão funciona sem navegar acidentalmente |
| Android 430 × 932 | Filtros, favoritos, carrinho e sheet com foco e toque previsíveis |
| Mobile baixo 360 × 600 e landscape | Conteúdo rola quando necessário, sem cliques presos sob barra |
| Desktop 1280 × 800 | Três colunas, catálogo legível, mídia 9:16 central, sheet à direita |
| Teclado virtual | Observações não perdem valor nem foco ao mexer em adicionais/quantidade |
| TalkBack/teclado | Trap e devolução de foco, anúncio de resultados, botão rotulado por ação |
| `prefers-reduced-motion` e Save-Data | Transições reduzidas, vídeo não inicia automaticamente quando proibido |
| Falha de imagem/vídeo | Fallback legível com descrição e CTA funcionando |
| Pedidos/pagamento | Nenhum endpoint real ligado, cópia demonstrativa inequívoca |

**Limites da auditoria:** não houve captura instrumentada de screenshot, Playwright, Lighthouse, TalkBack ou dispositivos reais nesta etapa. Testes de código/contratos não demonstram conformidade visual por si só. Trabalhar na branch de design e publicar somente após essa validação.
