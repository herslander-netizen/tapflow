# TapFlow · Pesquisa aplicada: personalização de aparência por estabelecimento
**Data:** 21/11/2026 · **Produto:** TapFlow / ALVO Digital · **Status:** pesquisa + primeira implementação de prévia, sem produção.

## Problema
A identidade TapFlow usa verde-floresta, lima e creme; esse é o **branding da plataforma**, não uma identidade obrigatória para cada hamburgueria, cafeteria, pizzaria, sorveteria ou restaurante. Impor as mesmas cores ao cliente final enfraquece o reconhecimento do estabelecimento e pode reduzir a adequação ao seu conceito visual.

## Benchmarks verificados (fontes oficiais)
1. **Toast — Brand Hub:** marcas distintas por unidade ou grupo, logo, cor principal em HEX, tema e fontes. https://support.toasttab.com/en/article/Get-Started-With-Brand-Hub
2. **Square Online — Site Styles:** temas prontos, customização de componentes e retorno às definições padrão. A tipografia do checkout é preservada para legibilidade. https://squareup.com/help/us/en/article/7820-choose-themes-for-your-square-online-site
3. **GloriaFood:** permite customizar botão e widgets; a própria empresa informa que mantém as cores/fontes do menu de pedidos neutras para priorizar os itens e a finalização. https://www.gloriafood.com/web-widget-customization
4. **Material Design 3:** cores por funções (primary, on-primary, surface, on-surface) e esquemas claros/escuros, não espalhar HEX pelos componentes. https://developer.android.com/codelabs/m3-design-theming
5. **Adobe Spectrum:** tokens semânticos, suporte a temas e contrastes; não comunicar estados apenas pela cor. https://spectrum.adobe.com/page/color-fundamentals/
6. **WCAG 2.2 AA:** texto comum >=4,5:1, conteúdo/ícones de UI não textuais relevantes >=3:1; foco, zoom e estados verificáveis. https://www.w3.org/TR/WCAG22/

## Decisão de UX: personalização guiada, não editor infinito
- **Marca TapFlow (admin, documentação e comerciais):** permanece com o lettering aprovado e cores corporativas.
- **Vitrine pública do estabelecimento:** identidade própria por tenant, com possibilidade de variante por unidade.
- **Foco do cliente:** vídeos/fotografias, produtos e ações sempre legíveis; não alterar tipografia de preço, status de pagamento ou semântica de alertas pela vontade do lojista.
- **Onboarding:** sugerir um preset pelo segmento, mas não forçar associação cultural (qualquer segmento pode escolher qualquer tema).
- **Editor:** 8 modelos; opção Claro/Escuro; cor principal e cor do fundo; preview instantâneo; proteção automática de contraste; ação Salvar e restaurar padrão.
- **Edição segura:** cor inicial é apenas uma intenção; o motor converte para tokens derivados (background, surface, card, text, muted, on-accent, stroke e focus). Nunca permitir CSS livre ou input de URL.
- **Limite:** logo, fotos, estilo de capas e tipografia podem ser fases seguintes; primeiro estabilizar tema, contraste e estado do checkout.
- **Atenção:** a tela administrativa do estabelecimento deve usar UI consistente de operação e não absorver qualquer personalização arriscada aplicada ao cardápio.

## Entrega de código desta etapa
- \`apps/web/theme.mjs\`: 8 presets, validação HEX, cálculo WCAG, correção automática de cor com contraste insuficiente, variantes claro/escuro e tokens semânticos.
- \`apps/web/theme-panel.mjs\`: seletor de temas demonstrativo, entrada por cores, prévia em tempo real, salvar/cancelar/redefinir.
- \`apps/web/theme.css\`: adapta a experiência existente à paleta ativa, preservando a legibilidade do feed sobre mídia escura.
- \`tests/unit/theme.test.mjs\`: presets, contraste, validação e isolamento lógico.
- \`scripts/build-preview-worker.mjs\`: inclui os novos arquivos na montagem local da prévia.
- **Modo demonstração:** o editor está deliberadamente visível ao visitante apenas para demonstração. O tema fica salvo em localStorage deste navegador com chave do restaurante fictício. Isso **não é** persistência entre dispositivos, não é publicação e não é controle de acesso real.
- **Não foram criados endpoints de escrita públicos, nem efetuadas operações D1, Supabase, Cloudflare, banco ou pagamento.**

## Modelo de implantação segura por tenant (fase de backend, ainda não ativado)
**Tabela proposta:** \`tenant_appearances\` com \`tenant_id\`, \`location_id\` (vazio significa herança), \`draft_json\`, \`published_json\`, \`revision\`, editor, datas e chave composta. Ver \`infra/free-stack/d1/0003_appearance_draft.sql\`; nunca aplicar migrações automaticamente.

**Fluxo de edição real:**
1. Autenticar membro do estabelecimento.
2. Resolver **tenant e unidade a partir da sessão no backend**, não aceitar identidade do corpo do request como autorização.
3. Verificar permissão de \`owner\`/\`manager\` na unidade e política multi-tenant.
4. Receber apenas \`preset\`, \`mode\`, \`accent\`, \`background\`; validar tamanho, HEX, allowlist; calcular tokens no backend ou cliente com versão compartilhada.
5. \`PUT /api/staff/appearance/draft\` com controle de revisão/ETag e audit trail; sem afetar vitrine pública.
6. \`POST /api/staff/appearance/publish\` com confirmação e trilha de auditoria; publicação atômica versionada.
7. \`GET /api/public/appearance\` recebe um contexto **público autenticado pelo domínio, slug ou token QR validado**, consulta apenas \`published_json\` e serve configuração filtrada com cache por tenant/unidade e invalidação versionada.
8. Resolução: unidade publicada -> tenant publicado -> preset TapFlow; tema desconhecido/ilegível nunca quebra cardápio (fallback seguro).
9. Separar tema da identidade administrativa da ALVO Digital e nunca expor configurações de outros tenants.
10. Revalidar preview com WCAG, zoom 200%, 360/390/430/1280px e tablets, imagens/gradientes, erros e carga lenta.

**D1 não possui RLS:** autorização para cada operação fica inteiramente no backend. Nunca expor endpoint de publicação sem sessão e verificação explícita de papéis. Não considerar localStorage fonte verdadeira.

## Critérios de aceite
- Oito presets diferenciados, cada um com luz/escuro e edição manual.
- Texto principal/segundo plano >=4,5:1; texto sobre CTA >=4,5:1; destaque do botão contra fundo >=3:1 (testes automáticos de cores).
- Escolha de tema altera feed, busca, cartão, carrinho e modal sem mudar itens e pedidos.
- Cancelar restaura o tema salvo; restaurar predefine o tema inicial até Salvar; salvar a prévia permanece após reload na mesma origem quando localStorage habilitado.
- Funciona sem novas dependências, sem dados sensíveis e sem ativar backend.
- QA visual/teclado e integração com PR #8 oficial ainda precisam de validação antes do merge.

## Roadmap
- **MVP desta PR:** prévia sem backend, presets, cores guiadas, tokens e testes.
- **MVP comercial:** editor autenticado, draft/published em D1 dedicado, autorização por tenant/local, revisão e publicação, testes multi-tenant.
- **V2:** imagem de capa/logo e hierarquia de marcas por unidade, fontes permitidas, área de publicação e histórico/rollback.
- **V3:** leitura de paleta sugerida do logo com confirmação, temas sazonais e testes de conversão, sem sobrecarregar mobile.

## Referências cruzadas
PR #6 (experiência + infraestrutura integrada) é a base escolhida; PR #8 (identidade oficial) e PR #9 (experiência React experimental) precisam ser reconciliados antes de qualquer merge na main.
