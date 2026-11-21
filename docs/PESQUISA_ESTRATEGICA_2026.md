# TAPFLOW | PESQUISA APROFUNDADA — CONCORRENTES, REPOSITÓRIOS E DIFERENCIAÇÃO

Data de pesquisa: 21/11/2026. Produto independente da **ALVO Digital**. Este documento é uma pesquisa, **não** uma comprovação de funcionalidades implementadas. Fontes: páginas oficiais dos produtos, documentações dos provedores e repositórios originais; comentários públicos são sinais qualitativos, não pesquisa amostral.

## 1. Tese de produto

**TapFlow = descoberta visual + compra sem fricção + operação do restaurante + inteligência explicável**.

Proposta: o cliente entra por NFC, QR ou link, assiste a clipes de pratos ou escolhe a visualização textual, personaliza, compra, acompanha a cozinha e pode fazer uma nova rodada; o estabelecimento controla capacidade, disponibilidade, métricas e comunicação, tudo com baixo consumo de dados.

**Alerta competitivo:** a Acerkt já anuncia cardápio Reels, QR e NFC, editor, importação de PDF com IA, divisão da conta, análises, fidelidade e multiunidade. O vídeo vertical, por si só, não diferencia o TapFlow. Não reproduzir a experiência ou ativos da marca.

## 2. Comparativo competitivo baseado em fontes oficiais

| Produto | Capacidades publicamente documentadas | Oportunidade para TapFlow |
| --- | --- | --- |
| iFood | Marketplace, catálogo, gestão de pedidos, entrega, integração de APIs e múltiplos canais | Operação robusta, acompanhamento e integradores futuros; não replicar marketplace no MVP |
| Anota AI | Atendimento automatizado em WhatsApp, salão/QR, pedidos, pagamento Pix/cartão/carteiras, KDS, recomendações, re-pedido | Conversação conectada à cozinha + checkout verificável |
| Goomer | Cardápio por QR e delivery, mesa/balcão/comanda, pagamento integrado, gestão de cozinha e PDV em planos | Acesso rápido e operações distintas por canal |
| Acerkt | Reels, NFC, QR, métricas de visualização/conversão, importação via foto/PDF, divisão de conta, multimarca | A hipótese "somos os primeiros a usar Reels" está refutada; inovar na experiência operacional |
| Saipos | PDV, estoque, vendas de vários canais, KDS, integrações e emissão fiscal | Prevenção de erro e gestão na cozinha; não começar construindo ERP completo |
| Cardápio Web | Chatbot WhatsApp, cardápio mesas/delivery, marketing, pagamentos, integrações | Automação comercial como módulo futuro e com opt-in |
| Last.app | QR por mesa, múltiplos dispositivos compartilhando carrinho, rodadas e promoções, métodos de pagamento | Mesa social e vários pedidos na mesma conta |
| Toast | QR e pedidos por mesa, envio para cozinha, pagamento e integração com POS | Pedidos confiáveis e reconciliação de caixa |
| sunday | Pagamento da conta via QR, divisão de conta, gorjeta | Checkout dividido e recibo depois do pedido |

**Preços de referência publicamente expostos em 21/11/2026, não proposta de preços do TapFlow:**
- Acerkt: Starter R$ 49/mês; Plus R$ 89/mês; Full R$ 149/mês, conforme site consultado.
- Anota AI: blog oficial informa R$ 99,99/mês até 150 pedidos, R$ 199,99 para 151–250 e R$ 299,99 acima de 250, além de taxas do processamento online; confirme condições na contratação.
- Goomer: plano grátis com até 30 pedidos/mês e R$ 1,39 por excedente; blog informa Básico R$ 99,90 mensal ou 12 × R$ 59,94 anual (preços referentes à página do fabricante em fevereiro de 2026).

Não comparar preços como se o escopo fosse idêntico: os módulos, canais, limites, exclusões, cobrança e descontos diferem. Não há benchmarks reais de conversão medidos entre plataformas nesta pesquisa.

## 3. Sinais de fricção do cliente

Discussões no Reddit em 2025–2026 trazem, com posições divergentes, queixas sobre QR sem internet, PDF ilegível, necessidade de instalar app, cardápio lento e substituição forçada do atendimento humano. Outros relatos aprovam pedir, pagar e chamar atendimento direto do telefone. Isso inspira hipóteses de UX, **não comprova** prevalência estatística.

Diretriz TapFlow: oferecer **vídeo e lista** sem impor mídia; permitir cardápio impresso/garçom como alternativa; iniciar sem login; incluir Wi-Fi quando necessário; imagem e texto antes de reproduzir clipe; não carregar todos os vídeos; preço e disponibilidade imediatamente acessíveis.

## 4. Diferenciação — oportunidades, não alegações de exclusividade

### A. Menu Vivo
Feed respeita **estoque, horário de oferta, ocupação da cozinha, tempo estimado e itens pausados**. Mostrar "disponível agora" e "previsão" apenas se houver dados reais no backend; se não, mostrar "consulte o estabelecimento". Não prometer prazo calculado por IA sem dados.

### B. Mesa Social
Até vários participantes em uma mesa escaneiam o mesmo QR e montam um carrinho compartilhado, com atribuição individual de itens, confirmação conjunta e novas rodadas de pedido. A Last.app já tem carrinho multiusuário: diferenciação aqui é a combinação com vídeo, comunicação clara e divisão de consumo.

### C. Descoberta por intenção
Alternar "quero algo leve", "até R$ 40", "sem lactose", "vegetariano", "ficar pronto rápido", com **filtros determinísticos a partir de dados validados**. Não inferir alergias nem garantir ausência de contaminação cruzada. Assistente de linguagem natural é opcional, nunca autoridade de estoque, preço ou alergênicos.

### D. TapFlow Studio
Onboarding do restaurante: importa cardápio em imagem/PDF **com revisão humana**; cria 1 capa, 1 clipe curto otimizado e legenda opcional por prato; editor de template e biblioteca de mídia; alternância fácil entre vídeo, foto e texto. A importação por IA já existe na Acerkt e na Anota AI; o diferencial buscado é **fluxo integrado, econômico e consistente**.

### E. Métrica que gera ação
Funil anônimo e por estabelecimento: NFC/QR aberto → item exposto → detalhe → carrinho → pedido → aceito → entregue. Acompanhamento de conversão por prato e **custo de mídia**; IA ou regras propõem ações **revisáveis**: corrigir imagem, preço, descrição, tempo e disponibilidade. Recomendações de vendas devem ser submetidas a teste A/B, sem afirmar aumento comprovado.

## 5. Repositórios GitHub verificados — critérios de seleção

Classificação: **integrar agora**, **avaliar depois**, **referência**, **não incorporar diretamente**. Licença indicada conforme repositório consultado em 21/11/2026; **verificar LICENSE e versão exata antes de copiar código e preservar avisos**.

| Repositório | Papel | Licença reportada | Decisão |
| --- | --- | --- | --- |
| https://github.com/honojs/hono | APIs leves compatíveis com Cloudflare Workers | MIT | Integrar quando houver backend |
| https://github.com/shadcn-ui/ui | Componentes acessíveis e customizáveis React | MIT | Integrar seletivamente, sem inflar o bundle |
| https://github.com/colinhacks/zod | Validação de contratos entre cliente e API | MIT | Integrar cedo |
| https://github.com/soldair/node-qrcode | Geração de QR Code | MIT | Integrar para IDs de mesas |
| https://github.com/zxing-js/browser | Leitor de QR via câmera (caso de uso interno) | MIT | Opcional; telefone já abre QR com câmera nativa |
| https://github.com/video-dev/hls.js | Reprodução HLS para vídeos adaptativos | Apache-2.0 | Fase de vídeo, quando houver pipeline HLS |
| https://github.com/transloadit/uppy | Upload robusto/resumível para painel | MIT | Fase de vídeo |
| https://github.com/TanStack/virtual | Listagem longa virtualizada | MIT | Adicionar somente se cardápio exigir |
| https://github.com/vite-pwa/vite-plugin-pwa | Cache, manifesto e funcionamento degradado | MIT | Após validar compatibilidade do bundler |
| https://github.com/statelyai/xstate | Estados explícitos e verificáveis de pedido/pagamento | MIT | Avaliar no backend e KDS |
| https://github.com/ffmpegwasm/ffmpeg.wasm | Transcodificação experimental no navegador | MIT no wrapper; dependências/codecs requerem revisão | **Não incluir por padrão no celular**; pesado |
| https://github.com/tastyigniter/TastyIgniter | Pedidos, cardápios e mesas | MIT, PHP/Laravel | Referência de domínio, não migrar toda a stack |
| https://github.com/medusajs/medusa | Commerce modular, pedido, preço, pagamentos | Núcleo MIT; módulos enterprise distintos | Referência de fluxos, adotar só se complexidade justificar |
| https://github.com/medusajs/medusa-eats | Demo de marketplace food delivery | MIT | Referência de arquitetura; é demo/hackathon, não produto pronto |
| https://github.com/saleor/saleor | Commerce GraphQL | BSD-3-Clause | Alternativa robusta, pesada para MVP |
| https://github.com/opensourcepos/opensourcepos | POS de caixa e inventário | MIT com **exigência adicional de rodapé visível** descrita no README | Estudar domínio; não incorporar nem remover atribuição |
| https://github.com/vendurehq/vendure | Commerce configurável | GPLv3 / licença comercial | **Não incorporar sem análise jurídica de licenciamento** |
| https://github.com/tirforge/restro | POS, KDS, estoque e autoatendimento QR | AGPL-3.0 | **Referência conceitual**, sem copiar código na proposta SaaS fechada |
| https://github.com/satisfecho/pos | POS multi-tenant, reservas, QR, cozinha, pagamentos | AGPL-3.0 | Referência conceitual, sem copiar código |
| https://github.com/itxadii/restaurant-pos | POS, cozinha, QR, offline-first | AGPL-3.0 | Referência conceitual, sem copiar código |

**Regra jurídica e técnica:** GPL e AGPL não significam "proibido usar comercialmente". Elas têm condições relevantes: AGPL geralmente exige disponibilizar código modificado aos usuários que interagem via rede; GPL exige observar obrigações conforme distribuição e combinação. Não copiar implementação desses projetos sem avaliação de advogado e conformidade de licenças. Não incorporar trechos de código obtidos de serviços proprietários como Anota AI ou iFood.

## 6. Arquitetura recomendada para começar com custo variável mínimo

- **Cliente**: React + TypeScript, PWA adaptativa, scroll vertical com IntersectionObserver nativo e somente 1 vídeo ativo; pausa ao trocar item/aba, reduz movimento, poster e legenda, listagem e modo baixa conexão.
- **APIs**: Hono/Cloudflare Workers como camada de validação e limites; autenticação de estabelecimentos via Supabase Auth; sem sessão obrigatória para cliente.
- **Banco**: novo Supabase **exclusivo do TapFlow**, PostgreSQL e RLS, com tenants, locations, members, tables, menu items, modifiers, media, carts, orders, line-items, order events, payments e webhook inbox.
- **Mídia**: Cloudflare R2 (bucket próprio, storage Standard e URLs de upload com curta duração). Transformação vídeo fora do request HTTP: primeiro upload limitado e clipes pré-processados; Oracle apenas se houver VM dedicada com recursos disponíveis e separação de serviços. Cloudflare Stream automatiza transcodificação mas não é gratuita de forma geral, avaliar quando houver receita.
- **Eventos e cozinha**: estado persistido no banco; Realtime apenas como otimização, com reconexão e consulta de fallback. Tela de cozinha com confirmação, reentrega e auditoria.
- **Pagamento**: iniciar "pagar no local"; depois Mercado Pago em sandbox, Pix e checkout hospedado, webhooks assinados, consulta ao provedor, chave de idempotência, deduplicação de eventos e nenhum armazenamento local de cartão.
- **Conectores**: iFood API é fase posterior, com requisitos de cadastro/homologação; **não** presumir integração disponível só porque a API é documentada.
- **IA**: OCR, descrições e recomendações apenas com aprovação humana; estoque, alérgenos e pagamentos determinados exclusivamente por dados verificados.

**Limites gratuitos verificados (21/11/2026):** R2 Standard 10 GB-mês de armazenamento, 1 milhão operações Class A e 10 milhões Class B, egress gratuito nas condições documentadas; Supabase Free 500 MB banco, 1 GB Storage e 5 GB egress, além de outros limites. Vídeo pode consumir muitas operações e armazenamento: "sem custo" só enquanto dentro de cotas e sem componentes pagos. Verificar cobrança, disponibilidade de cotas e isolamento da conta antes de provisionar. Não reutilizar banco do Flow.

## 7. Contratos de negócio fundamentais

- Todo preço final, disponibilidade, desconto, taxa e limite de adicional é recalculado no **servidor** antes de criar pedido.
- Mesas possuem token revogável, rate limit e vinculação de tenant/unidade. NFC/QR contém referência de localização, não credencial de caixa; proteger contra QR adulterado.
- A transação de criação de pedido registra snapshot de itens/preços, idempotency key, inventory holds conforme regra, etapa inicial e audit trail.
- Máquina de estados explícita: draft → submitted → accepted/rejected → preparing → ready → served/completed; pagamento segue trilha separada pending → authorized/paid/failed/refunded e não vira "pago" pelo navegador.
- Carrinho multiusuário lida com edição concorrente, exclusão, expiração de mesa e confirmação; nunca resolver conflito silenciosamente.
- WhatsApp: mensagens de marketing e pós-venda requerem consentimento e regras do canal; opt-out e retenção apropriada. Sem mensagem automática por padrão na demonstração.
- Isolamento multi-tenant por RLS + testes de invasão cruzada; operações admin com logs e menor privilégio.
- Sem reprodução não autorizada de marca, screenshots, design, vídeos ou cardápios de concorrentes.

## 8. Roadmap orientado por valor e risco

| Fase | Entrega | Aceite mínimo |
| --- | --- | --- |
| 0 | Pesquisa, stack, design tokens, orçamento e riscos | ADR publicada e owners definidos |
| 1 | Feed + lista + busca + restrições + detalhe + carrinho e pedido **demo** | Sem vídeos pesados obrigatórios; mobile 360/390/430px; testes de total; aviso demo |
| 2 | Painel do restaurante, autenticação, estoque básico, cozinha, mesa QR/NFC, pedidos **reais sem pagamento integrado** | Multi-tenant testado; idempotência; pedido chega ao estabelecimento certo |
| 3 | Pagamento no local + sandbox Pix/cartão, notificações opcionais, event sourcing/auditoria | Webhook confiável; testes de duplicidade, falha e reembolso |
| 4 | Vídeo pipeline escalável, mesa social, funil, upsell, importação assistida, programas de recorrência | Medir aquisição, conversão, custo por sessão e retenção |
| 5 | Integrações fiscais/PDV/iFood, delivery próprio e multiunidade avançada | Requisitos de homologação, contratos e custos verificados |

Não lançar um feed vazio "Reels" como produto final. A Fase 1 é demonstração; o primeiro piloto comercial precisa pelo menos da Fase 2.

## 9. Critérios quantitativos propostos (metas, não resultados)

- Entrada sem cadastro, com escolha imediata entre Feed, Lista e busca.
- Meta Lighthouse/Core Web Vitals: LCP até 2,5 s, INP até 200 ms, CLS até 0,1 em teste real.
- 1 vídeo decodificado ativo por vez, priorizar poster; nunca pré-carregar feed inteiro.
- Instrumentar tempo até visualizar primeiro item, tempo até carrinho, conversão por prato, erros de pedidos e bytes de mídia por sessão.
- Taxas de conclusão, recompra e ticket médio só podem ser afirmadas com amostra real. Comparar A/B de feed versus lista para testar se vídeo aumenta ou reduz conversão.

## 10. Fontes primárias e comparações

### Plataformas
- Acerkt: https://www.acerkt.com/
- Anota AI Cardápio: https://lp.anota.ai/home/funcionalidade/cardapio-digital/
- Anota AI preço (2026): https://anota.ai/blog/precos-e-planos/
- iFood Parceiros: https://parceiros.ifood.com.br/restaurante/como-funciona/ferramentas
- iFood Developer: https://developer.ifood.com.br/en-US/docs/food/guides/modules/catalog/introduction
- Goomer: https://goomer.com.br/planos
- Goomer planos: https://goomer.com.br/blog/conheca-os-planos-da-goomer
- Saipos: https://saipos.com/sistema/restaurante
- Cardápio Web: https://cardapioweb.com/
- Last.app (26/10/2026): https://www.last.app/actualizaciones-de-producto/todo-lo-nuevo-en-qr-las-novedades-que-llegan-a-tus-mesas
- Toast: https://support.toasttab.com/en/article/Toast-Mobile-Order-and-Pay-FAQs
- sunday: https://sundayapp.com/digital-bill/
### Engenharia / infraestrutura
- Cloudflare R2 pricing (out/2026): https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Supabase planos: https://supabase.com/pricing
- Mercado Pago Pix: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- Mercado Pago webhook: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
- iFood API/homologação: https://developer.ifood.com.br/en-US/docs/getting-started/homologation/categories
### Sinais qualitativos de usuários
- Reddit 2026: https://www.reddit.com/r/restaurateur/comments/1q87xuw/is_the_hate_for_qr_or_link_menus_still_a_thing/
- Reddit 2026: https://www.reddit.com/r/restaurant/comments/1xn3l5b/owners_with_qr_menus_what_pushed_you_to_do_it/
- Reddit 2025: https://www.reddit.com/r/restaurant/comments/1oqqb5h/i_think_i_speak_for_everybody_when_i_say_enough/
- Reddit 2025: https://www.reddit.com/r/I_DONT_LIKE/comments/1kofbsf

## 11. Decisão recomendada

**Não importar um ERP inteiro nem migrar a arquitetura do Flow.** Construir experiência original TapFlow sobre React/TS + Workers/Hono + Supabase dedicado + R2, reutilizando bibliotecas permissivas para tarefas específicas e conceitos de apps de restaurante como estudo. Priorizar a jornada real da mesa sobre IA de marketing; clientes devem poder escolher entre assistir vídeos e ler cardápio. Medir custo e conversão antes de vender promessas de aumento de ticket.

Status: pesquisa documentada; **não** significa que stack, banco, APIs, QR/NFC, vídeos e pagamentos já foram implementados ou ativados.
