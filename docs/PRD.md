# TapFlow — Documento mestre de produto, arquitetura e UX/UI

> Transcrição textual do documento mestre v1.0 preparado para a ALVO Digital em 20/11/2026. Tabelas e diagramação do arquivo Word podem perder alinhamento nesta versão; consulte o documento original no kit local.


                                                                                  TAPFLOW / ALVO DIGITAL

ALVO / DIGITAL

PRODUCT DESIGN • SAAS • EXPERIÊNCIA GASTRONÔMICA

TAPFLOW — CARDÁPIO REELS
Documento Mestre de Produto, Arquitetura e UX/UI — PRD v1.0
Data: 20 de novembro de 2026
Responsável e proprietária do produto: ALVO Digital
Nome do produto: TapFlow (nome de trabalho adotado; marca e domínio ainda não verificados)
Status: planejamento técnico para implementação, não é sistema implantado.
Referência de mercado: Acerkt, sem reprodução de sua marca, layout ou código proprietário.

 Decisão central: desenvolver um SaaS independente, com bases de prévia e produção próprias. É
 proibido compartilhar repositório, banco de dados, credenciais, tabelas ou recursos de deploy com Flow,
 Alvo OS ou Evolution Alvo sem uma integração formal, limitada e revisada. A KAIRÓS Produtora pode
 prestar serviços audiovisuais, mas não é proprietária do software.

DO CONCEITO AO PRODUTO

Cardápio em vídeos verticais, entrada por NFC/QR, personalização, pedidos,
pagamentos verificados e acompanhamento — em uma aplicação mobile-first. Três
ambientes: cliente, restaurante e administração ALVO Digital.

DOCUMENTO DE PLANEJAMENTO · IMPLEMENTAÇÃO AINDA NÃO INICIADA

                                                                  ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   1

                                                                                   TAPFLOW / ALVO DIGITAL

01. Resumo executivo e posicionamento
Visão

Transformar a escolha de alimentos em uma experiência de descoberta e compra por vídeo vertical: o
cliente abre uma URL por NFC, QR Code ou link, navega como em um feed de Reels, conhece ingredientes,
personaliza pratos, faz pedidos, paga com um provedor confiável e acompanha o preparo — sem baixar
aplicativo.

Proposta de valor
  •     Para o cliente: ver o prato antes de escolher; pedir com poucos toques; transparência de preço,
        ingredientes e status.
  •     Para o restaurante: aumentar a qualidade da apresentação dos produtos, reduzir erros de
        anotação, organizar pedidos e entender quais conteúdos ajudam a vender.
  •     Para a ALVO Digital: oferecer software por assinatura e serviços de implantação; a eventual
        captação de vídeo pode ser contratada separadamente.

Estratégia de diferenciação
  1.    Do vídeo à conversão: medir visualização → detalhe → carrinho → pedido → pagamento, sempre
        com consentimento e minimização de dados.
  2.    Duas formas de descoberta: feed de vídeo e lista/busca acessível, sem duplicar gestão de
        cardápio.
  3.    Operação verificável: pedido e pagamento têm máquinas de estados distintas, fonte única no
        backend e trilha de eventos.
  4.    Marca do restaurante: white-label no cardápio público; marca ALVO Digital nos ambientes
        administrativos/comerciais.
  5.    Implantação gradual: restaurante pode começar com fotos, acrescentar vídeo depois e ativar
        Pix/cartão apenas quando estiver pronto.

Público inicial

Pequenos e médios restaurantes, hamburguerias, cafeterias e pizzarias com consumo na mesa ou
retirada no balcão. Delivery, integração com PDV fiscal e programas de fidelidade ficam fora da primeira
versão comercial.

Hipóteses a testar, não promessas
  •     Vídeos aumentam interesse e taxa de adição ao carrinho quando comparados à navegação
        somente por lista.
  •     A alternativa em lista reduz abandono para clientes com conexão lenta ou intenção de compra
        direta.
  •     O onboarding assistido pode viabilizar restaurantes sem equipe de tecnologia ou audiovisual.

Métrica principal sugerida: proporção de sessões de cardápio que geram pedidos confirmados,
segmentada por origem (NFC, QR, link), tipo de navegação (feed/lista) e restaurante. Medir também taxa de
pagamento aprovado, erros, tempo operacional e custo de entrega de mídia.

                                                                   ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   2

                                                                                                    TAPFLOW / ALVO DIGITAL

02. Escopo por fase e limites explícitos
                                      Fase 1 — pedido           Fase 2 — pagamento
           Capacidade                                                                       Fase 3 — produto SaaS
                                      operacional               completo

           Cardápio em vídeo,
                                      Sim                       Melhorar                    Otimizar
           fotos, busca, categorias

           QR Code / NFC com
                                      Sim                       Sim                         Gestão em lote
           contexto da mesa

           Detalhes, adicionais,
                                      Sim                       Sim                         Regras avançadas
           carrinho

           Pedido real e
                                      Sim                       Sim                         Integrações
           painel/cozinha

           Pagamento presencial       Sim                       Sim                         Sim

           Pix/cartão via PSP e
                                      Sandbox preliminar        Produção controlada         Multiestabelecimento
           webhooks

           Acompanhamento e                                                                 Monitoramento
                                      Básico                    Realtime/fallback
           alertas                                                                          avançado

           Cadastro de                                                                      Autosserviço e
                                      Interno/manual            Interno
           estabelecimentos                                                                 assinatura

           Delivery, split de
                                      Não                       Não                         Avaliar separadamente
           contas, PDV fiscal


Não faz parte do MVP: marketplace com pagamento centralizado na ALVO Digital; armazenamento de
dados completos de cartão; IA tomando decisões financeiras; plataforma de entregadores; emissão fiscal
automatizada; integração irrestrita com WhatsApp; clonagem de interface, elementos e marca de
concorrentes.

Dependências de negócio ainda abertas: nome comercial definitivo; provedor de pagamento escolhido;
regras de cancelamento, chargeback e reembolso; taxa de serviço e gorjeta (padrão: desativadas);
estratégia de assinatura e limites por plano.

03. Personas, papéis e permissões
           Papel                               Objetivo                             Permissão principal

                                               Ver, personalizar, pedir, pagar e    Somente sua sessão/pedido por
           Cliente anônimo
                                               acompanhar                           token de escopo limitado

                                               Auxiliar mesas, receber e            Pedidos e mesas da unidade
           Atendente/garçom
                                               entregar                             autorizada

                                                                                    Fila de produção, sem
           Cozinha                             Preparar itens e atualizar status
                                                                                    credenciais financeiras

                                               Controlar operação, cardápio,        Unidade(s) delegada(s) pelo
           Gerente
                                               equipe e relatórios                  dono

                                               Configurar estabelecimento,
           Proprietário                        equipe, pagamentos e                 Seu tenant e suas unidades
                                               assinatura

                                                                                   ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   3

                                                                                                TAPFLOW / ALVO DIGITAL

           Papel                           Objetivo                           Permissão principal

                                                                              Acesso mínimo, com
           Suporte ALVO                    Diagnóstico e suporte auditável    autorização, expiração e
                                                                              registro

                                           Provisionamento, planos,           Ferramentas de plataforma,
           Administrador ALVO              segurança e saúde da               sem acesso indiscriminado a
                                           plataforma                         dados de clientes


Modelo de autorização: tenant_id determina o estabelecimento contratante; location_id identifica a unidade.
Membros possuem papéis por tenant/unidade. A RLS no banco e a API aplicam o acesso conjuntamente.
Dados de um tenant jamais devem ficar visíveis para outro por ausência de filtros no frontend.

04. Arquitetura de informação e mapa de telas
4.1. Aplicação do cliente (mobile-first)

           ID                              Tela/estado                        Conteúdo e ação principal

                                                                              Logo do restaurante, contexto
           C01                             Entrada inteligente                de mesa/retirada,
                                                                              disponibilidade e opção entrar

                                                                              Vídeo vertical, prato, preço, CTA
           C02                             Feed Reels                         de compra, categorias,
                                                                              pausa/mudo, busca

                                                                              Filtros, categorias, pesquisa,
           C03                             Lista e busca                      alternativa sem vídeo e estados
                                                                              vazios

                                                                              Ingredientes, alergênicos,
           C04                             Prato (bottom sheet/página)        adicionais, quantidade,
                                                                              observações e preço atualizado

                                                                              Itens editáveis, mesa/retirada,
           C05                             Carrinho
                                                                              subtotal, taxas explícitas e total

                                                                              Escolha do meio, dados
           C06                             Checkout                           mínimos, redirecionamento ao
                                                                              PSP, estados pendente/erro

                                                                              Linha do tempo operacional e
           C07                             Status do pedido
                                                                              status financeiro independente

                                                                              Chamar atendimento, solicitar
           C08                             Ajuda na mesa                      conta, recuperar acesso ao
                                                                              pedido

                                                                              Offline, mesa inválida, item
           C09                             Estados de falha                   esgotado, sessão expirada,
                                                                              pagamento não confirmado


4.2. Painel do estabelecimento

           ID                              Tela/estado                        Entrega operacional

                                                                              Novos pedidos, em preparo,
           R01                             Resumo do dia                      atrasados, pendências e
                                                                              indisponíveis

                                                                             ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   4

                                                                                                TAPFLOW / ALVO DIGITAL

            ID                               Tela/estado                       Entrega operacional

                                                                               Aceitar/rejeitar, preparar,
            R02                              Fila de pedidos                   pronto, entregue, histórico e
                                                                               motivo

                                                                               Visão legível em tablet/desktop,
            R03                              Cozinha/KDS                       tempo decorrido, sinalização de
                                                                               atraso

                                                                               Categorias, itens, preços, fotos,
            R04                              Cardápio                          vídeos, adicionais, visibilidade,
                                                                               esgotado

                                                                               Criar mesas, tokens opacos,
            R05                              Mesas e QR/NFC                    imprimir QR,
                                                                               revogar/rotacionar

                                                                               Pendente, pago, estorno,
            R06                              Pagamentos                        divergências, extrato por
                                                                               período

                                                                               Logo, tema por restaurante,
            R07                              Aparência                         capa, ordem dos itens, modo
                                                                               padrão

                                                                               Convites, permissões, unidade,
            R08                              Equipe e ajustes
                                                                               políticas e horários

                                                                               Funil de compra, pratos
            R09                              Análises                          visualizados, vendas, mídia e
                                                                               qualidade operacional


4.3. Central ALVO Digital

A01 Tenants e unidades · A02 Planos e limites · A03 Saúde da infraestrutura · A04 Incidentes de pagamento/webhook · A05
Suporte auditável · A06 Implantação e documentação.

Navegação recomendada no celular: no cliente, navegação reduzida (Explorar, Buscar, Carrinho, Pedido)
mais CTA persistente; no backoffice, menu inferior ou lateral responsivo com no máximo cinco áreas
primárias e secundários agrupados. Evitar excesso de chips, botões redondos e informações duplicadas.

05. Jornadas UX/UI detalhadas
5.1. Consumo na mesa

Ler NFC / QR → resolver token de mesa → confirmar restaurante ativo → C01 → C02 (ou C03) → C04 → C05 → C06
→ C07.

   •     O mesmo conteúdo HTTPS deve ser gravado no NFC (NDEF URL) e representado pelo QR. Não
         depender de Web NFC JavaScript para abrir o cardápio.
   •     Um token de mesa identifica o local, mas não autoriza automaticamente consultar pedidos de
         outras pessoas. O checkout gera uma credencial de rastreamento limitada ao pedido.
   •     Um cliente poderá pedir sem criar conta, quando o modo de serviço permitir.
   •     O backend revalida restaurante, mesa, produto, adicionais, disponibilidade, impostos/taxas e preço
         antes da confirmação.
   •     A ação de concluir só pode enviar uma intenção de pedido por chave de idempotência; reenvios
         não multiplicam pedidos.


                                                                              ALVO DIGITAL • PRD v1.0 • 20/11/2026   |    5

                                                                                        TAPFLOW / ALVO DIGITAL


5.2. Retirada no balcão

Abrir link público → selecionar modalidade retirada → escolher itens → selecionar janela quando o
restaurante oferecer → checkout → acompanhar → mostrar identificador de retirada. Dados pessoais
apenas quando necessários.

5.3. Cozinha e atendimento

Novo pedido → alerta persistente → gerente/atendente aceita ou rejeita com motivo → cozinha inicia
preparo → marca pronto → atendente conclui entrega. Alertas devem sobreviver a reconexões; falha de
som não pode ocultar pedidos.

5.4. Situações de borda prioritárias
  1.      Conexão lenta: mostrar poster de imagem imediato, oferecer modo lista e retentativa de mídia;
          não bloquear pedido por falha do vídeo.
  2.      Item esgotado após adicionar: impedir cobrança sem revisão; explicar a mudança e permitir
          remover/substituir.
  3.      Duas pessoas na mesma mesa: carrinhos e pagamentos separados por sessão; pedidos ligados à
          mesa sem vazamento entre clientes.
  4.      Pagamento aprovado mas pedido rejeitado: abrir incidente e processo de reembolso conforme
          regras; nunca apagar o registro.
  5.      Página fechada: recuperar o pedido por URL/token seguro, revogável, com prazo apropriado.
  6.      QR trocado fisicamente: mostrar domínio legítimo e identidade do restaurante; inspeção física e
          rotação da etiqueta.
  7.      Pagamento pendente / webhook atrasado: mostrar “Aguardando confirmação”, sem falso
          positivo; reconciliar com provedor.
  8.      NFC não compatível: QR Code sempre visível.

06. Sistema visual — Lime Noir (tema-base proposto)
Objetivo: destaque máximo para fotos e vídeos de alimentos, hierarquia objetiva, experiência premium e
diferenciação comercial. Esta é a paleta inicial proposta, não a declaração de que são as cores oficiais do
Acerkt.

            Token                            HEX                      Uso

            color.bg                         #101410                  Fundo principal

            color.surface                    #1E241F                  Painéis, modal, carrinho

                                                                      CTA primário, foco forte,
            color.accent                     #C8F45D
                                                                      seleção

            color.text                       #F5F7F2                  Texto principal

            color.muted                      #9BA79B                  Metadados, texto secundário

                                                                      Erros e recusas (com
            color.error                      #FF8076
                                                                      ícone/texto)

            color.warning                    #FFC36A                  Pendências e atenção

            color.success                    #8DE0AD                  Sucesso confirmado

                                                                     ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   6

                                                                                              TAPFLOW / ALVO DIGITAL


Tokens de interface
  •     Fonte: Inter ou Manrope, com fonte de sistema como fallback; evitar depender de arquivos de
        fonte externos em estados críticos.
  •     Grid: 4 / 8 / 12 / 16 / 24 / 32 px. Raio: 10–14 px em controles; 18–24 px em cartões; bottom sheet com
        raio superior de 24 px.
  •     Tipografia: corpo 14–16 px (mínimo legível), preço/CTA com destaque, texto sobre vídeo com
        gradiente escuro de apoio; não esconder valor sob animações.
  •     Alvos de toque: preferencialmente 44 × 44 px; preservar navegação por teclado e foco visível.
  •     Motion: transições curtas (aprox. 160–240 ms), respeitar prefers-reduced-motion; não animar todas as
        informações ao mesmo tempo.
  •     Componentes: VideoFeed, VideoCard, FoodDetailsSheet, ModifierPicker, CartSummary, PaymentMethod,
        OrderTimeline, OrderStatusBadge, KitchenTicket, TenantThemeEditor.

  •     Estados obrigatórios: loading, empty, error, offline, disabled, pending, success, expired.

Regras específicas do feed
  •     Mídia em 9:16, viewport adaptável (100dvh) e safe-area-inset-*.
  •     Autoplay mudo; som só com gesto do usuário. Pausar vídeo fora da viewport e quando o modal
        abrir.
  •     Pré-carregar no máximo o próximo vídeo elegível, condicionado à rede, memória, redução de
        dados e orçamento por sessão.
  •     Usar poster otimizado até a mídia estar pronta; não reproduzir dois vídeos ao mesmo tempo.
  •     Busca e modo Lista sempre disponíveis; botões de avanço/retrocesso como alternativa ao gesto.
  •     Contraste WCAG 2.2 AA: conferir sobreposição do texto com o conteúdo real de cada vídeo, não
        apenas com a cor de fundo.

White-label

O tema Lime Noir governa inicialmente o painel e demonstração, mas cada restaurante poderá usar suas
próprias cores e logotipo no cardápio público. Definir limites de contraste automatizados, cores de fallback
e opção de restauração. Não usar cor isoladamente para diferenciar estados de pagamento.

Sobre o protótipo existente: o arquivo HTML de demonstração criado anteriormente usa acento pêssego
e imagens simuladas; é uma prova de fluxo, não o design final Lime Noir e não possui
backend/pagamentos reais.

07. Arquitetura técnica proposta
7.1. Princípios

Read before write; repositório novo; alterações reversíveis; sem custos involuntários; multi-tenant
seguro; backend fonte única; idempotência financeira; observabilidade desde a fase 1.

7.2. Stack preferencial

           Camada                           Tecnologia candidata              Decisão/observação

                                            React + TypeScript, Tailwind,     PWA e componentes
           Web/cliente e painel
                                            shadcn/ui, Motion                 compartilhados

                                                                             ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   7

                                                                                                        TAPFLOW / ALVO DIGITAL

               Camada                               Tecnologia candidata               Decisão/observação

                                                    Cloudflare Workers / servidor      API valida regra, autorização e
               API
                                                    TypeScript                         preços

                                                    Supabase dedicado PostgreSQL
               Banco de dados                                                          RLS e migrations aditivas
                                                    + Auth

                                                    Supabase Realtime Broadcast ou
               Atualização operacional                                                 Fallback para busca periódica
                                                    SSE

                                                    Storage/CDN; Cloudflare R2 para    Restrições por tenant e upload
               Mídias e posters
                                                    imagens                            assinado

                                                    Cloudflare Stream como             Avaliar cobrança, qualidade e
               Vídeos
                                                    hipótese                           orçamento antes de contratar

                                                                                       Sandbox antes de produção;
               Checkout                             Mercado Pago ou Asaas              pagamentos na conta do
                                                                                       restaurante

                                                    qrcode.react/geração server-
               QR Code                                                                 Token opaco por mesa
                                                    side

                                                                                       Mesmo endereço do QR, com
               NFC                                  Tag NDEF de URL HTTPS
                                                                                       fallback impresso

                                                    Vitest, Testing Library,           Unitário, integração, e2e,
               Testes
                                                    Playwright                         acessibilidade

                                                    Logs estruturados + métricas +
               Erros/observabilidade                                                   Sem segredos/PII desnecessária
                                                    alertas


Nota financeira: infraestrutura de prévia pode usar camadas gratuitas enquanto couberem, mas vídeo,
PSP, domínio e tráfego em produção podem gerar custos. A meta de custo inicial mínimo não deve ser
confundida com promessa de custo zero permanente.

7.3. Desenho lógico
Cliente (PWA) ─┐
Restaurante ───┼──> Web / API de domínio (autenticação + rate limit)
ALVO Admin ────┘              │
                ├──> Supabase Postgres (tenants, cardápio, pedidos, RLS)
                ├──> Supabase Realtime / fallback de consulta
                ├──> Storage/CDN e serviço de vídeo
                ├──> PSP (checkout) → webhook verificado → inbox/idempotência
                └──> logs, métricas e alertas

O frontend nunca cria um paid=true, nunca define o valor final ou acessa diretamente chaves secretas do
PSP. A integração com Evolution Alvo, se futuramente habilitada para notificações, será uma API externa
por contrato próprio — não faz parte da persistência nem do núcleo do novo produto.

7.4. Organização sugerida do novo repositório
tapflow/                 # repositório pretendido; publicar após criação no GitHub
 apps/
  web/                   # consumidor e painel responsivo
  api/                  # endpoints/server functions
 packages/
  ui/                # design system e tokens
  domain/                 # invariantes, schemas, serviços
  contracts/              # tipos públicos e validações
 supabase/
  migrations/              # migrações incrementais com RLS
  seed/                 # dados exclusivos de DEMO

                                                                                      ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   8

                                                                                                  TAPFLOW / ALVO DIGITAL


tests/
 unit/ integration/ e2e/
docs/
 PRD.md
 ARQUITETURA.md
 SEGURANCA.md
 QA.md
.github/workflows/         # CI sem deploy automático de produção no início


7.5. Separação e ambientes
  •      preview: projeto Supabase novo, domínio temporário/previsualização Cloudflare próprios, dados
         fictícios, checkout em sandbox.
  •      production: Supabase próprio e isolado, domínio oficial a definir, credenciais de produção distintas,
         deploy controlado e plano de rollback.
  •      Nunca usar os IDs de Supabase do Flow e nunca reutilizar repositórios de Flow/Alvo OS/Evolution
         Alvo.
  •      CI valida lint, tipos, testes, builds, licenças e vazamento de segredos. Pull request e checklist antes
         do merge.

08. Modelo de dados de referência
Todas as tabelas de domínio com id, tenant_id (onde aplicável), datas de criação/atualização e
rastreabilidade; dinheiro em centavos inteiros, moeda explícita BRL; referências a unidades quando
necessário.

                                                                                 Campos/relacionamentos
            Domínio                            Tabelas principais
                                                                                 essenciais

                                               tenants, locations,               tenant, unidade, usuário, papel,
            Organização
                                               tenant_memberships                status

                                               dining_tables,
                                                                                 unidade, número público, hash
            Mesas                              table_access_tokens,
                                                                                 de token, expiração/revogação
                                               guest_sessions

                                                                                 ordem, nome, preço em
                                               menu_categories, menu_items,
            Cardápio                                                             centavos, poster, vídeo,
                                               item_media
                                                                                 disponibilidade

                                               modifier_groups, modifiers,       limites mín./máx., acréscimos,
            Customização
                                               item_modifier_groups              obrigatoriedade

                                                                                 sessão, itens, versão de preços
            Carrinho                           carts, cart_items
                                                                                 não confiável até checkout

                                               orders, order_items,              snapshot imutável do preço e
            Pedido
                                               order_item_modifiers              contexto operacional

                                               order_events, kitchen_tickets,    transição, autor, timestamp,
            Operação
                                               service_requests                  mesa e tipo de solicitação

                                               payment_intents,                  PSP, status verificado, IDs
            Pagamento
                                               payment_events, refunds           externos, valor, moeda

                                               webhook_inbox, outbox_events,     unicidade por provedor/tenant,
            Confiabilidade
                                               idempotency_keys                  retries, processamento

                                                                                 autor, operação, tenant, recurso,
            Auditoria                          audit_log, security_events
                                                                                 resultado e correlação

                                                                                ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   9

                                                                                                TAPFLOW / ALVO DIGITAL

                                                                                Campos/relacionamentos
            Domínio                          Tabelas principais
                                                                                essenciais

                                             subscriptions, usage_counters,     plano, limites, estado e
            SaaS
                                             tenant_integrations                integrações configuradas

                                             privacy_safe_events,               evento mínimo agregado,
            Analytics
                                             daily_metrics                      origem, funil e custo de mídia


Relacionamentos e invariantes
   1.    tenant 1:N locations; location 1:N dining_tables; tenant 1:N menu_items.

   2.    order 1:N order_items 1:N order_item_modifiers; snapshot do item guarda nome, preço unitário,
         adicionais, quantidade e subtotal de quando o pedido foi confirmado.
   3.    order 1:N payment_intents (permite tentativas sem duplicar ordem); payment_intent 1:N payment_events;
         reembolso referencia pagamento/ordem.
   4.    order 1:N order_events; cada transição guarda origem, ator e versão para concorrência otimista.

   5.    table_access_tokens guardam somente hash/identificador seguro do token; URL gerada deve ser
         rotacionável sem comprometer históricos.
   6.    Índices comuns: (tenant_id, location_id, status, created_at) para pedidos, unicidade (provider,
         provider_event_id) para inbox e chave idempotente por escopo.

   7.    Ativar RLS em tabelas expostas e validar políticas de SELECT/INSERT/UPDATE/DELETE por papel,
         incluindo Storage e Realtime.
   8.    Abertura anônima do cardápio usa endpoint público com dados estritamente de catálogo, nunca
         leitura genérica de tabela protegida.

Atenção: este é um modelo conceitual. SQL final, índices, chaves estrangeiras, políticas de retenção e
contratos de API exigem revisão no repositório novo antes de aplicação.

09. Contratos de domínio e estados
9.1. Estados de pedido

submitted → accepted → preparing → ready → completed.

Desvios permitidos: submitted → rejected; submitted|accepted → cancelled conforme política; preparing → cancelled
exige permissão gerencial/razão e possível reembolso. draft existe apenas no carrinho/checkout, não
precisa ser pedido operacional.

Regras: a API é autoridade das transições; registrar quem alterou, quando e por quê. Um pedido pago não
deve ser excluído após cancelamento. refunded não é estado operacional de pedido; pertence à transação
financeira.

9.2. Estados de pagamento

not_required (modo presencial sem cobrança online) · pending · authorized (se aplicável) · paid · failed · expired ·
refund_pending · refunded · partially_refunded.

Regras: paid só após confirmação autenticada do PSP ou conciliação pela API do provedor; retorno do
navegador nunca é evidência suficiente. Um webhook fora de ordem não regride paid para pending.
Estornos parciais exigem campo de valor reembolsado e registros append-only.

                                                                              ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   10

                                                                                                 TAPFLOW / ALVO DIGITAL


9.3. Estados de disponibilidade do produto

published/hidden (catálogo) × available/sold_out (operação). Produto pode estar publicado mas esgotado; o
cliente recebe feedback claro e não deve conseguir comprá-lo por payload manual.

9.4. Checkout idempotente

POST /checkout/quote calcula total no servidor com versão e prazo de validade. POST /orders recebe quote_id e
Idempotency-Key; retorna mesmo resultado da tentativa original. POST /payments/start só inicia um pagamento
para a tentativa válida; PSP responde por status/eventos verificados. Todos os endpoints sensíveis têm
autorização, validação, rate limit e correlação.

9.5. Eventos essenciais

order.submitted · order.accepted · order.rejected · order.preparing · order.ready · order.completed · payment.pending ·
payment.paid · payment.failed · refund.requested · refund.completed · media.uploaded · table.token_rotated.

Outbox durável garante que notificação falha não apague evento de pedido; inbox deduplicada garante
que um webhook repetido não gera cobranças/pedidos extras.

10. Segurança, LGPD e prevenção de fraudes
   •     Isolamento multi-tenant: testes automatizados para acesso cruzado, autorização no backend, RLS
         obrigatória para dados expostos e princípios de menor privilégio.
   •     NFC/QR: URL HTTPS, token opaco, rotação/revogação, inspeção do adesivo físico; token de mesa
         não equivale a segredo bancário nem login. Evitar IDs sequenciais adivinháveis.
   •     Sessões e pedidos: tokens de acompanhamento restritos ao pedido, prazo de validade, revogação
         e proteção contra coleta de pedidos de terceiros.
   •     Pagamentos: PSP externo; não armazenar números de cartão, CVV ou secrets; verificar assinatura
         e referência do evento com credenciais do tenant; proteção contra replay.
   •     LGPD: mapa de finalidades e bases legais, minimização, retenção, processo de
         exclusão/anônimização e resposta a titulares; definir papéis controlador/operador por fluxo em
         contrato.
   •     Auditoria: eventos sensíveis append-only, acesso de suporte temporário e auditável, logs sem
         dados pessoais desnecessários.
   •     Abuso e spam: rate limiting por sessão/IP/mesa, limites de pedidos de teste, comportamento
         anômalo e bloqueio sem negar acesso legítimo.
   •     Dependências: revisão de licenças, SBOM e varredura de vulnerabilidades antes de publicar.
   •     Conformidade operacional: pagamentos, regras fiscais, oferta comercial e comunicação precisam
         de validação apropriada antes da operação real.

11. Desempenho, observabilidade e custo
Objetivos de engenharia para medir no piloto
   •     Carregar poster e informações de produto antes do vídeo, sem esperar transcodificação ou
         buffer; imagem fallback sempre disponível.
   •     Mirar LCP p75 ≤ 2,5 s em contexto medido e documentado; quando não atingir, registrar perfil de
         rede/dispositivo e plano de ajuste. Não tratar meta como desempenho já comprovado.

                                                                              ALVO DIGITAL • PRD v1.0 • 20/11/2026    |   11

                                                                                         TAPFLOW / ALVO DIGITAL


  •     Evitar layout shift no feed; limites de componentes por viewport e pausas quando fora do foco.
  •     Testar Android intermediário e iPhone Safari em redes instáveis; carrinho e checkout continuam
        sem vídeo.
  •     Disponibilizar health checks e filas com alerta para falhas de pedido, webhook e vídeo.

Custo e governança

Vídeo é o principal custo variável. Implementar poster, arquivo otimizado, só um vídeo ativo, pré-
carregamento controlado, medição de minutos servidos, limites por plano e aviso de consumo. Cloudflare
Stream tem cobrança de armazenamento/entrega de vídeo; orçamento e contratação precisam ser
aprovados separadamente.

Métricas de operação: pedidos recebidos/rejeitados/atrasados, diferença entre pagamentos e pedidos,
webhooks em retry, eventos duplicados, vídeos com erro, tempo de carregamento, conversão por funil,
minutos de vídeo por tenant. Painel ALVO mostra saúde, não dados pessoais indevidos.

12. Backlog de implementação — execução por lotes
Prioridades: P0 impede operação segura; P1 melhora experiência/escala; P2 expansão. Cada história
precisa de PR, teste, documentação e aceite.

                                                                                 Critério de aceite
          ID                    Prioridade            Entrega
                                                                                 resumido

                                                                                 Identificação ALVO,
                                                      Repositório novo e
          F0-01                 P0                                               sem vínculo com repo
                                                      privado
                                                                                 de outros produtos

                                                                                 Preview e produção
                                                                                 separados; CI sem
          F0-02                 P0                    Ambientes e CI
                                                                                 segredos e sem deploy
                                                                                 prod automático

                                                                                 Feed, sheet, botões,
                                                      Tokens Lime Noir e
          F0-03                 P0                                               estados e contraste
                                                      componentes
                                                                                 revisados

                                                                                 Teste falha
          F0-04                 P0                    Esquema inicial + RLS      corretamente ao
                                                                                 acessar outro tenant

                                                      Cadastro
                                                                                 Convite e papéis por
          F1-01                 P0                    tenant/unidade e
                                                                                 unidade funcionando
                                                      permissões

                                                      Cadastro de                Formulários validam
          F1-02                 P0                    categorias/itens/adicion   obrigatórios, preço e
                                                      ais                        estoque

                                                                                 Sem vazamento entre
                                                      Upload de
          F1-03                 P0                                               tenants; fallback para
                                                      foto/poster/vídeo
                                                                                 foto

                                                                                 Pausa/autoplay mudo,
          F1-04                 P0                    Feed + lista + busca       fallback e teclado
                                                                                 funcionando

                                                                                 Mesma URL, token
          F1-05                 P0                    QR e link NFC por mesa     revogável, mesa válida
                                                                                 resolvida


                                                                     ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   12

                                                       TAPFLOW / ALVO DIGITAL

                                               Critério de aceite
ID      Prioridade   Entrega
                                               resumido

                                               Preço/limites de
F1-06   P0           Detalhes e carrinho       adicionais recalculados
                                               no backend

                                               Snapshot imutável,
F1-07   P0           Pedido no backend         idempotência, controle
                                               transacional

                                               Pedido aparece e muda
                     Painel de pedidos e
F1-08   P0                                     de estado com
                     cozinha
                                               auditoria

                                               Cliente vê mudança
                     Acompanhamento com
F1-09   P0                                     mesmo após falha
                     fallback
                                               temporária do realtime

                                               Estado separado:
F1-10   P0           Pagamento no local        pedido recebido,
                                               pagamento a receber

                     Sandbox PSP + contrato    Iniciar cobrança sem
F2-01   P0
                     de gateway                armazenar cartão

                                               Repetido/fora de ordem
                     Webhook com
F2-02   P0                                     não duplica nem
                     assinatura + inbox
                                               regride status

                                               “Pago” apenas após
F2-03   P0           Pix/cartão seguro
                                               confirmação verificada

                     Cancelamento/             Motivo, permissão,
F2-04   P0
                     reembolso                 histórico e conciliação

                                               Sessão expirada,
                     Recuperação de
F2-05   P0                                     pagamento pendente e
                     pedidos e erros
                                               fluxo reentrante

                     White-label               Logo/cores por tenant
F3-01   P1
                     configurável              sem perder contraste

                                               Administrador vê
                     Central ALVO e
F3-02   P1                                     saúde e consumo sem
                     plano/limites
                                               dados excessivos

                                               Métricas segmentadas
                     Analytics de
F3-03   P1                                     sem dados pessoais
                     conversão/custo
                                               desnecessários

                                               Cliente publica
                     Onboarding e
F3-04   P1                                     cardápio revisado sem
                     importação assistida
                                               equipe técnica

                                               Erros de PSP, mídia e
                     Alertas e
F3-05   P1                                     pedidos têm owner e
                     observabilidade
                                               resolução

                     Integração com            Contrato de API
F4-01   P2
                     PDV/impressora            separado e testado

                     Fidelização /             Opt-in, privacidade e
F4-02   P2
                     notificações              orçamento controlado

                                               Descoberta e validação
F4-03   P2           Delivery/conta dividida
                                               próprias, fora do MVP

                                     ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   13

                                                                                                  TAPFLOW / ALVO DIGITAL


Ordem de execução sem retrabalho

F0-01 → F0-02 → F0-04 → F1-01 → F1-02 → F1-05 → F1-06 → F1-07 → F1-08 → F1-09 → F2-01 → F2-02 → F2-03 .

Frontend visual pode começar em paralelo após F0-03, mas não fingir persistência real antes de F1-07. Um
protótipo visual deve rotular todas as simulações, especialmente pagamentos.

13. Plano de qualidade e critérios de pronto
Matriz de testes

            Camada                                             Cenários obrigatórios

                                                               Preço em centavos, adicionais mín/máx,
            Unitários
                                                               transições, formato BRL, tokens

                                                               RLS por tenant/unidade, concorrência, estoque,
            Integração
                                                               idempotência, eventos

                                                               PSP sandbox, assinatura inválida, webhook
            Financeiro
                                                               repetido/fora de ordem, pendente, estorno

                                                               QR, entrada, feed, lista, prato, carrinho,
            E2E cliente
                                                               pagamento simulado, acompanhamento

                                                               Login, gerenciar item,
            E2E equipe                                         aceitar/preparar/pronto/entregue,
                                                               indisponibilidade

                                                               Foco, contraste, leitor de tela, botões, reduced
            Acessibilidade
                                                               motion e legendas

                                                               360, 390, 430, 768, 1280 px; Android Chrome, iOS
            Compatibilidade
                                                               Safari, desktop

                                                               Offline/3G, reconexão, falha de mídia, timeout
            Resiliência
                                                               PSP, erro de backend

                                                               Troca de tenant, token de mesa adulterado, IDOR,
            Segurança
                                                               rate limit, logs de PII


Definition of Done

A história só é concluída quando há implementação documentada, validação server-side, testes, QA
responsivo, estados vazios/erros, acessibilidade, verificação de segredos e rollback conhecido. Não marcar
uma cobrança real como testada usando apenas protótipo ou sandbox.

Critérios de go-live
   •     Projeto e banco de produção criados especificamente para o produto, com backup e permissões.
   •     Fluxo completo de um pedido real verificado com usuário e operador reais no restaurante-piloto.
   •     PSP homologado com cenário positivo, negativo, repetição e conciliação.
   •     Operação da cozinha com fallback se realtime ou som falhar.
   •     Política de dados/privacidade e procedimentos de cancelamento definidos.
   •     Orçamento de mídia por tenant conhecido; telemetria e alertas ativos.
   •     Testes cross-tenant e acesso anônimo aprovados.

                                                                              ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   14

                                                                                               TAPFLOW / ALVO DIGITAL

14. Decisões de arquitetura (ADRs) e pontos pendentes
          ID                             Decisão                              Status

                                         Produto pertence à ALVO Digital
          ADR-001                                                             Aprovada
                                         e tem repositório/infra próprios

                                         Web mobile-first/PWA, sem
          ADR-002                                                             Proposta forte
                                         instalar app

                                         Lime Noir como identidade-
          ADR-003                                                             Proposta de design
                                         base do sistema

                                         Cardápio público com white-
          ADR-004                                                             Proposta forte
                                         label por restaurante

                                         Pagamento na conta do próprio
          ADR-005                                                             Proposta forte
                                         restaurante

                                         Supabase dedicado + APIs
          ADR-006                                                             Proposta técnica
                                         TypeScript + Cloudflare

                                         Escolha entre Mercado Pago e
          ADR-007                                                             Pendente
                                         Asaas, custos e onboarding

          ADR-008                        Nome comercial e domínio             Pendente

                                         Política de
          ADR-009                        cancelamento/reembolso e             Pendente
                                         momento de envio à cozinha

                                         Precificação, limites de vídeo e
          ADR-010                                                             Pendente
                                         planos


Nenhum ADR proposto autoriza criação de recursos pagos ou mudanças em contas/produção sem
consentimento explícito.

15. Referências para implementação e revisão
Mercado e UX
  •    Acerkt: https://www.acerkt.com/
  •    Morcel: https://www.morcel.app/pt
  •    MenuFeed: https://menufeed.app/
  •    FidMenu: https://fidmenu.com/funcionalidades/cardapio-digital
  •    Tasteo: https://tasteo.pt/
  •    Cardápio Play: https://cardapioplay.app/

Repositórios candidatos (licença e manutenção devem ser reavaliadas antes de instalar)
  •    shadcn/ui: https://github.com/shadcn-ui/ui
  •    Motion: https://github.com/motiondivision/motion
  •    TanStack Virtual: https://github.com/TanStack/virtual
  •    React Intersection Observer: https://github.com/thebuilder/react-intersection-observer
  •    hls.js: https://github.com/video-dev/hls.js
  •    Uppy: https://github.com/transloadit/uppy
  •    dnd-kit: https://github.com/clauderic/dnd-kit

                                                                            ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   15

                                                                                     TAPFLOW / ALVO DIGITAL


  •    qrcode.react: https://github.com/zpao/qrcode.react
  •    TastyIgniter (estudo de regras operacionais): https://github.com/tastyigniter/TastyIgniter
  •    Medusa (estudo de comércio): https://github.com/medusajs/medusa

Referências técnicas oficiais, consultadas em 20/11/2026
  •    Supabase — RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
  •    Supabase — Realtime: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
  •    Cloudflare — Workers limits: https://developers.cloudflare.com/workers/platform/limits/
  •    Cloudflare — Stream pricing: https://developers.cloudflare.com/stream/pricing/
  •    Mercado Pago — webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-
       preferences/payment-notifications
  •    W3C — WCAG 2.2: https://www.w3.org/TR/WCAG22/

16. Próxima ação exequível
Executar somente Fase 0 e preparação controlada da Fase 1: validar o repositório novo, escrever
AGENTS.md, aprovar padrões de UX, gerar design tokens, estruturar app e banco de prévia próprios, criar as
primeiras migrações com RLS e testes de isolamento, implementar feed com catálogo fictício sem
pagamento real. Usar o Prompt de Arranque para Codex entregue junto a este documento.

Transparência: este documento e o protótipo anterior são artefatos de planejamento/demonstração. O
novo repositório, ambiente Supabase, Cloudflare, NFC físico, checkout e sistema de pedidos não foram
provisionados neste trabalho.

                                                                   ALVO DIGITAL • PRD v1.0 • 20/11/2026   |   16