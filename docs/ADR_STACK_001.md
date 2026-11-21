# ADR-001 — Decisões tecnológicas provisórias do TapFlow

**Data:** 21/11/2026. **Status:** proposta, não implementação.

## Contexto
TapFlow pertence à ALVO Digital e precisa operar sem compartilhar recursos de Flow, Alvo OS ou Evolution Alvo. Produto nasce por QR/NFC em mesas de restaurantes, com experiência de feed vertical e fallback de lista, e evolui para pedido real, checkout e cozinha.

## Decisão proposta

- React + TypeScript no frontend; **não** adicionar engine commerce pesada no MVP.
- Layout mobile-first com CSS Scroll Snap, IntersectionObserver e mídia carregada sob demanda.
- Hono + Cloudflare Workers para camada HTTP, com isolamento de permissões; Supabase dedicado para Auth, Postgres, RLS e Realtime quando autorizado.
- R2 dedicado para mídia; clips curtos pré-processados; HTTP range/HLS quando houver necessidade comprovada.
- Zod para contratos; QR gerado com node-qrcode; Uppy para upload; HLS.js conforme pipeline; XState apenas onde transições de pedido/pagamento justificarem a dependência.
- TastyIgniter e Medusa apenas como **referências de modelagem**, não integração direta nesta fase.
- **Não copiar código de projetos AGPL/GPL nem layouts proprietários**. Análise de licenças antes de dependências novas.
- Pedidos de demo, dados ilustrativos e pagamento em sandbox separados de produção; preço final sempre no servidor.
- Não provisionar recursos nem ativar serviços pagos sem aprovação.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Vídeo lento e caro | Poster primeiro, vídeo sob demanda, um player ativo, métricas de bytes |
| Mesa errada ou QR trocado | Token revogável, conferência visível de número/estabelecimento, assinatura e rate limits |
| Pedido duplicado | Chaves idempotentes transacionais e conciliação |
| Comprovante forjado | Confirmação por provedor no backend com webhooks verificados |
| Falsa precisão de IA | IA é sugestão, sempre com revisão humana e fontes verificadas |
| Tenant vazando dados | RLS + filtros obrigatórios + testes cross-tenant |
| Licença OSS | Inventário SBOM, rechecagem do LICENSE e atribuição |
| Cardápio inacessível | Lista de texto, ajuste de tamanho, WCAG e via atendimento humano |
| Custos inesperados | Cotas por tenant, limites de upload, monitor de mídia e alertas |

## Medição
Tracking mínimo: menu_opened, item_impression, item_detail_opened, item_added, checkout_started, order_submitted, order_accepted, order_completed, media_bytes_delivered. Não gravar PII sem necessidade. Dados reais devem ser habilitados somente com política de privacidade adequada.

## Não decisões
Não foi escolhido PSP definitivo, modelo comercial, domínio, plano de rede social, política fiscal, operador de cozinha offline nem fornecedor de vídeo com transcodificação gerenciada. Essas decisões exigem piloto, segurança e avaliação de custo.

**Fontes / referências:** ver [Pesquisa de concorrentes e open source](PESQUISA_ESTRATEGICA_2026.md).
