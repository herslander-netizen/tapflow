# TapFlow — Estudo aprofundado de arquitetura, mídia, operação e custo
**ALVO Digital** · **21/11/2026** · **Status: decisão de arquitetura proposta, sujeita a piloto e testes, sem deploy autorizado**.

## 0. Decisão executiva

O TapFlow deve nascer como **web app/PWA mobile-first**, com **modo Reels + lista/busca**, QR/NFC abrindo a mesma URL segura, seleção de adicionais, carrinho e pedido com confirmação do servidor. O player deve ser desacoplado do pedido: falha de mídia não pode impedir comprar.

**Para o MVP sem custo fixo planejado**, considerar Cloudflare Workers + Static Assets + Hono, D1 isolado para um piloto e R2 para mídias compactadas. **Para crescimento**, PostgreSQL gerenciado com RLS é alternativa preferencial se testes de concorrência, autenticação, isolamento ou confiabilidade apontarem limitações do D1. A interface deve depender de contratos de domínio e API, **não do formato do banco**.

Esta proposta não altera a ADR-001 original sem aprovação. Não criar banco, bucket, Worker, credenciais ou domínio apenas por este documento. Não compartilhar recursos de Flow, Alvo OS ou Evolution Alvo.

## 1. Evidência de mercado e proposta de valor

- Anota AI: cardápio, WhatsApp, recuperação de vendas e canais de pedidos; não tentar competir imediatamente em todas essas frentes.
- Goomer: QR por mesa, cozinha e autoatendimento; comprova que fluxo operacional é fundamental além do cardápio bonito.
- iFood: integração formal de Order/Events exige homologação; tratar como expansão, não premissa do MVP.
- Vídeo curto e NFC já existem no mercado; diferencial defendível é **conversão com pouco atrito, operação confiável e métricas de mídia por prato**.

Hipóteses a testar com 3–5 estabelecimentos antes de precificar: (A) vídeo aumenta descoberta de pratos; (B) lista alternativa reduz abandono em rede lenta; (C) pedidos diretos reduzem retrabalho; (D) balcão/mesa exigem fluxos distintos. Medir, não prometer aumento percentual de vendas.

## 2. Escolha de banco — comparação

| Critério | D1 (SQLite gerenciado) | Supabase/PostgreSQL |
|---|---|---|
| Integração com Workers | Nativa | Conexão externa; projeto separado |
| Gratuidade | 5 milhões de linhas lidas/dia, 100 mil escritas/dia, 5 GB totais, máx. 500 MB por banco Free | 2 projetos gratuitos ativos por proprietário/admin entre organizações Free (conforme elegibilidade), 500 MB de banco/projeto |
| Autenticação | Biblioteca separada; Better Auth suporta D1 e Hono, mas exige hardening | Auth integrado e políticas RLS |
| Multi-tenant | Isolamento por API, queries parametrizadas e testes; D1 não oferece as políticas RLS do Postgres | Políticas RLS + validação API |
| Pedidos/consistência | Transações com batches, constraints e idempotência, limites de concorrência de uma instância | Transações SQL avançadas, índices e modelo relacional maduro |
| Limitações | Limites Free **bloqueiam queries** após estouro; cada DB single-threaded | Projeto Free pode pausar por inatividade; quota/egress e limite de projetos |
| Decisão inicial | **Candidato favorito para piloto sem custo** | **Alternativa para primeira operação comercial**, caso D1 reprove testes |

**Atenção:** não criar vários bancos por restaurante no MVP: com 10 D1 databases no Free, isso inviabiliza escalar estabelecimentos. Usar banco por **ambiente** e separar restaurantes por `tenant_id`, com todas as consultas autenticadas e autorizadas no backend. Revisar essa estratégia em escala.

Critérios de decisão verificáveis antes de pedidos reais:
1. Demonstrar isolamento com ataques cross-tenant, troca de ID, mesa adulterada e perfis de equipe.
2. Repetir `POST /orders` 100 vezes com a mesma `Idempotency-Key` e obter uma única intenção.
3. Simular itens esgotados, concorrência de estoque, falha de rede e 10 pedidos simultâneos sem corrupção.
4. Verificar custo de consultas e índices por tenant, inclusive caixa e histórico.
5. Ensaiar exportação/restore, backup e plano de migração se necessário.

## 3. Vídeo: melhor custo por prato e por visitante

### Pipeline recomendado

1. Restaurante sobe vídeo autorizado por upload temporário assinado, limite de tamanho/duração.
2. Validar MIME real, duração, permissões, arquivo e conteúdo; nunca executar arquivos enviados.
3. Criar poster JPEG/WebP e **um MP4 H.264 compactado para mobile**; variantes adicionais apenas se justificadas.
4. Gerar caminho versionado e imutável no R2; publicar via CDN de domínio próprio e cache.
5. Cadastrar URL/poster e estado da mídia no catálogo após sucesso, sem bloquear publicação da foto.
6. Servir **um vídeo ativo por vez**, muted + playsinline, lazy-load e vídeo pausado em aba oculta, redução de movimento ou economia de dados.
7. Medir bytes entregues, erros, início de reprodução e impacto no carrinho **sem rastreamento pessoal desnecessário**.

Para o piloto, experimentar 6–12 s, até aproximadamente 720p vertical e 0,5–1,5 MB/clip após compressão, com poster até ~150 KB. **Metas de otimização, não garantias.** Não usar originais 4K de 8,7 MB no feed de clientes.

### Comparação

- **R2 Standard + MP4 pronto:** melhor custo base para clipes curtos já comprimidos. 10 GB-mês, 1 milhão de operações A e 10 milhões B mensais gratuitos; egress direto sem cobrança. R2 pode exigir ativação de billing, e excedentes têm preço.
- **Media Transformations:** gera H.264, frames e cortes; URL com 5.000 operações de transformação gratuitas/mês (vídeo conta por segundo de saída); Workers binding em beta sem cobrança por transformação durante beta, mas sujeito a mudança. **Transformar uma vez, guardar resultado no R2**.
- **Cloudflare Stream:** simplifica encoding e ABR quando a escala justificar custo; US$ 5/mês por 1.000 minutos de armazenamento contratado e US$ 1/1.000 minutos entregues. Pré-carregamentos contam para minutos entregues.
- **FFmpeg em Oracle:** fallback de processamento em lote, só quando VM, capacidade e disponibilidade forem testadas; não fazer o checkout depender dessa VM.
- **FFmpeg.wasm no celular:** não recomendado como pipeline principal devido a CPU/memória; permitir no máximo edição leve opcional após medir.

No protótipo PR #4, o clipe do Wikimedia de 10s tem 4K e ~8,7 MB e é somente de demonstração (autor Nesnad, CC BY 4.0). Antes de piloto, substituir por arquivo próprio otimizado. Ver `docs/MIDIAS_DEMO.md`.

## 4. Experiência do consumidor — telas e ações

**Entrada:** NFC e QR apontam à mesma URL HTTPS de token opaco e revogável da mesa; exibir nome e mesa antes de comprar. QR sempre disponível. Não exigir instalação, cadastro ou leitura via Web NFC JavaScript.

**Descoberta:** Feed/LISTA/Busca sempre disponíveis. Prato: poster imediato, preço visível, tags de disponibilidade, vídeo opcional, botão de adicionar. O cliente pode pausar/mutar, abrir ingredientes, alergênicos e pedir ajuda. O conteúdo audiovisual **nunca é pré-requisito para concluir**.

**Detalhes:** adicionais com mínimo/máximo e total em centavos, observações, quantidade e alerta de esgotado. Em pedidos reais, o frontend **não decide** preço final: servidor emite `quote_id` com versão e validade.

**Carrinho:** mostrar mesa/método (retirada ou mesa), itens, extras, taxas explícitas e total; revisar antes de enviar; pedido real exige resposta confirmada da API. Mostrar "tentando reconectar" quando houver incerteza, sem reenviar duplicado.

**Status:** separar `order_status` e `payment_status`. Nenhuma tela informa "pago" por simples retorno do checkout. Retentativa por consulta sem duplicar pedidos. A cozinha não depende de áudio para ver novas comandas.

**Acessibilidade:** todo controle pelo teclado, foco visível, ESC no sheet, `prefers-reduced-motion`, texto alternativo, contraste e layout 360/390/430/768/1280; linguagem PT-BR clara. Não confiar só em gestos.

## 5. Operação do restaurante

- **Equipe:** administrador, gerente, atendente e cozinha com menor privilégio.
- **Pedidos:** `submitted → accepted → preparing → ready → completed`; desvios precisam motivo e permissão.
- **KDS:** fila por estação (quando necessário), pedido com timestamp, extras em destaque e fallback de atualização. Começar com polling moderado e otimizado; considerar WebSocket/Durable Objects apenas quando necessidade real.
- **Disponibilidade:** `published/hidden` e `available/sold_out` independentes.
- **Mesa compartilhada:** token identifica contexto da mesa, **não concede leitura de pedidos de outras sessões**. Primeiro piloto usa carrinhos separados; conta compartilhada só depois de desenhar permissões.
- **Sem pagamento online no primeiro piloto:** pode registrar `not_required` ou `payment_at_counter`, sem representar quitação bancária.

## 6. Segurança e pagamentos

**Regra central:** decisões de preço, estoque, mesa e permissão vivem no backend. Não armazenar tokens PSP no browser.

- `POST /checkout/quote` revalida `tenant_id`, mesa, disponibilidade, preço, modificadores, taxas e gera snapshot/versionamento.
- `POST /orders` exige `Idempotency-Key` persistida com resultado; mesma chave + mesmo contexto retorna o mesmo pedido; contexto diferente deve ser rejeitado.
- Webhook PSP precisa validar `x-signature`, consultar status confirmado e deduplicar eventos. Eventos fora de ordem não fazem `paid` regredir para `pending`.
- Comprovante ou mensagem de WhatsApp não são prova de pagamento.
- Rate limit, proteção de abuso, auditoria de mudanças, segredos no backend e política de retenção LGPD.
- Antes de cobrar por cartões ou Pix: sandbox com falha, duplicidade, perda de rede, reembolso e reconciliação.

## 7. Stack incremental

**Primeiro corte**: preservar PR #4 como protótipo de referência; não reescrever tudo sem consolidar fluxos. A arquitetura definitiva pode ser:
- React + TypeScript + Vite para PWA/cliente/admin, com módulos de domínio e componentes compartilhados;
- Hono + Workers para API; versões e schemas com Zod;
- D1/SQLite para primeiro piloto sem custo, se passar critérios; módulo de persistência com interface para PostgreSQL;
- Better Auth para equipe com D1, **avaliar antes de instalar** e testar sessão/autorização; cliente anônimo por contexto de mesa sem ler pedidos alheios;
- R2 Standard e Media Transformations para mídia; sem Stream pago até orçamento autorizado;
- Playwright para 360, 390, 430 e 1280; Vitest ou Node Test para regras; verificações de segurança/segredos na CI.

**Evitar agora:** ERP inteiro, marketplace, integração iFood, múltiplos provedores de IA, transcodificação no cliente, compartilhamento de banco entre produtos, checkout pago, app nativo e integrações complexas de WhatsApp.

## 8. Roadmap com critérios de pronto

| Entrega | Necessário | Prova de pronto |
|---|---|---|
| E0 — demo confiável | PR #4, fotos + vídeo de exemplo, lista, carrinho e cozinha em memória | CI verde + QA visual real em Android, desktop e rede lenta |
| E1 — PWA real e API | React TS, Hono, domínio isolado, testes | Um pedido de demonstração persistente com idempotência e autenticação |
| E2 — restaurante piloto | QR/NFC, tokens, catálogo e KDS | Pedido sem mídia e sem áudio chega corretamente, não duplica |
| E3 — vídeo próprio | Upload validado, poster, 1 saída mobile, R2 | Consumo e erros medidos em 4G/3G; limites por tenant |
| E4 — financeiro | PSP sandbox, webhook validado, conciliação | Aprovado, pendente, negado, repetido e reembolso testados |
| E5 — SaaS | Admin ALVO, faturamento, limites, analytics, IA assistiva | Observabilidade, suporte e isolamento por tenant demonstrados |

## 9. Operação e custo: armadilhas reais

- R2 gratuito **não significa total de custo zero**: operações e armazenamento excedentes cobram; cobrança pode exigir configuração de pagamento.
- D1 no Free **para de responder consultas** ao atingir a quota diária; venda comercial precisa plano de contingência e monitoramento.
- Workers Free tem **100 mil requisições/dia e 10 ms CPU/execução**; não converter vídeo nele como código JavaScript tradicional.
- Supabase Free pausa projetos por inatividade e limita projetos ativos por dono/admin; uma conta já usada por outros produtos não é garantia de vaga.
- Stream é pago desde armazenamento; Media Transformations pode mudar preços/condições de beta.
- HTTPS/NFC não dispensa proteção contra QR trocado fisicamente.
- Toda métrica de custos deve separar por tenant, ambiente e mídia.

## 10. Condições de decisão para arquitetura final

**Recomendo implementar E0 agora e preparar E1 sem provisionar:**
1. Fechar QA visual/browser e reduzir a mídia 4K do protótipo antes de compartilhar com restaurante.
2. Desenhar primeiro os contratos `Quote`, `Order`, `TableContext`, `MenuItem`, `MediaAsset`.
3. Escrever testes de idempotência, concorrência de pedidos e cross-tenant com armazenamento falso.
4. Validar disponibilidade e limites reais de D1/R2, sem criar recursos em contas de outros produtos.
5. Se D1 passar, criar ambiente próprio de preview **após autorização**, e só então restaurar persistência.
6. Antes de operação comercial real, decidir D1 vs PostgreSQL com números de piloto e teste de recuperação; não usar banco dual.
7. Nunca fazer merge/deploy como "produção pronta" sem validação real dos fluxos e credenciais próprias.

## Fontes oficiais verificadas em 21/11/2026

- Cloudflare D1: https://developers.cloudflare.com/d1/platform/pricing/ e https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare Workers: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Media Transformations: https://developers.cloudflare.com/stream/transform-videos/ e https://developers.cloudflare.com/stream/transform-videos/bindings/
- Cloudflare Stream: https://developers.cloudflare.com/stream/pricing/
- Supabase limites: https://supabase.com/pricing e https://supabase.com/docs/guides/platform/project-transfer/requirements
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Better Auth: https://better-auth.com/docs/integrations/hono e https://better-auth.com/blog/1-5
- Mercado Pago Pix e webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix e https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
- MDN vídeo: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- Anota AI: https://anota.ai/ ; Goomer: https://goomer.com.br/cardapio-digital-qr-code
- Wikimedia clip demonstrativo: https://commons.wikimedia.org/wiki/File:Hamburger-fries-tokyo-japan-july31-2021.webm

### Nota de privacidade

Este documento não inclui identificadores de bancos, emails de contas, segredos, dados de clientes, credenciais ou topologia interna de outros projetos, pois o repositório TapFlow foi criado público.
