# TapFlow — infraestrutura gratuita de prévia

**Produto:** TapFlow · **Proprietário:** ALVO Digital · **Ambiente:** somente demonstração técnica.

## Status confirmado em 21/11/2026

- Conta Cloudflare dedicada e conectada; nenhuma infraestrutura de Flow, Alvo OS ou KAIRÓS foi alterada.
- D1 `tapflow-preview-db` criado, UUID `bf381ffc-9caa-4436-81b7-93f3cf6b8a25`, esquema de 9 tabelas e 5 índices aplicado e verificado.
- Worker `tapflow-preview` implantado com binding `DB` ao D1 correto e subdomínio habilitado.
- URL pública: **https://tapflow-preview.tapflowse.workers.dev/**
- O conteúdo estático do PR #4 está **embutido no Worker para demonstração**. **NÃO** é Workers Static Assets nativo; migrar para Static Assets antes do piloto para reduzir consumo de requisições Worker.
- O carrinho e os pedidos permanecem **somente na memória do navegador**. O Worker não recebe pedidos reais nem pagamentos.
- Organização Supabase dedicada e conectada, **sem projetos criados**. Banco de pedidos principal candidato é D1; não duplicar bancos.
- Groq e Gemini: módulos server-side preparados; **sem segredos e desativados**. Modelos gratuitos e limites devem ser confirmados antes de uso.
- R2, Stream, domínio pago, Pix, notificações e infraestrutura Oracle: **não ativados**.

### Controles de custo

A Cloudflare OAuth não oferece leitura de faturamento deste usuário, então **não foi possível conferir a assinatura atual da conta**. Nenhum upgrade pago ou assinatura R2 foi solicitado. A meta é usar o Workers/D1 gratuito, respeitando limites. A conta deve permanecer sem Workers Paid nem serviços com cobrança por consumo até revisão.

### Testes

GitHub PR #5 executa testes de contrato sem credenciais e testes HTTP reais do site `workers.dev` e `/api/health`. O resultado da CI deve ser conferido após cada publicação; **testes de navegador/UX ainda são necessários**.

### Proteção de dados

Mesmo em preview, o D1 está **vazio de clientes**. Nunca cadastrar dados pessoais reais antes de autenticação, autorização multi-tenant, idempotência transacional, backups e políticas LGPD. URLs de demonstração e QR/NFC não autenticam estabelecimentos.

### Próximos passos

1. Garantir CI HTTP e QA visual Chrome Android em 360/390/430px, desktop em 1280px.
2. Unificar PR #4 e infraestrutura PR #5 com revisão e testes, depois configurar build reproduzível e assets gratuitos do Workers.
3. Criar API Hono protegida com auth e idempotência persistente; nunca abrir endpoint POST /orders enquanto permissões estiverem pendentes.
4. Criar pipeline de vídeos próprios compactados; não ativar R2 sem avaliar possibilidade de excedentes.
5. Secret de IA somente no ambiente após rotação da chave Gemini anteriormente exposta. Groq precisa de chave própria, sem compartilhamento pelo chat.

Fontes: https://developers.cloudflare.com/d1/platform/pricing/ · https://developers.cloudflare.com/workers/platform/pricing/ · https://console.groq.com/docs/api-reference · https://console.groq.com/docs/rate-limits


## Gemini — ativação controlada

[Guia seguro](GEMINI_PRIVADO.md). Rota de administrador e limite diário preparados, sem credenciais embutidas. A ferramenta bloqueou a transferência automática da chave enviada no chat; cadastrar o secret manualmente no painel Cloudflare. Nenhuma IA pública habilitada.


**21/11/2026 — IA administrativa:** rota protegida POST /api/admin/ai/description implantada manualmente no Worker de prévia, D1 ai_daily_usage aplicado e verificado, 5 tentativas/dia. A Cloudflare confirmou nenhum secret configurado — o endpoint permanece inacessível sem segredo administrativo e chave Gemini. CI agora também verifica GET=405 e POST não autenticado=401. A versão do Worker que o PR #4 gera não inclui essa rota; **não fazer novo deploy do build do PR #4 diretamente**, até consolidarmos as duas branches e os respectivos módulos.
