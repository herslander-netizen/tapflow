# TapFlow — integração PR #4 + PR #5

**Status:** integração em uma branch para revisão; não foi implantada na Cloudflare nem mesclada em `main`.

## Código unificado
- Protótipo Reels, carrinho, cozinha demo e contrato de preços do PR #4.
- Estrutura gratuita Cloudflare/D1, adaptadores Gemini/Groq, cinco agentes, Evolution Alvo e migrações de prévia do PR #5.
- Serviço de pedidos D1 do PR #4 em `apps/api/order-service.mjs`.
- Entrypoint `apps/api/preview-worker.mjs` conecta apenas o **health**, a rota administrativa protegida do Gemini e os **assets** ao Worker.
- `wrangler.preview.jsonc`: configuração versionada de Static Assets + D1 para uma futura publicação manual; não contém segredo e não é acionada por CI.

## Isolamento obrigatório
1. A prévia atualmente publicada não mudou. O novo entrypoint é staging-only.
2. A API de pedidos está **explicitamente fechada** no entrypoint `enabled:false` independentemente de qualquer env. Ainda falta autenticar sessão QR/NFC no servidor com escopo, expiração e revogação.
3. O fluxo de confirmação do cardápio no browser permanece **simulação em memória**. Não afirmar que salvou pedido real.
4. O WhatsApp da Evolution não é acionado pelo Worker nem pelos agentes. O projeto `tapflow` foi cadastrado mas o pareamento WhatsApp e o segredo por projeto estão pendentes.
5. Gemini está preparado, porém a chave que foi compartilhada antes no chat não está registrada na Cloudflare. Rota administrativa permanece bloqueada sem token.
6. Não habilitar compras, meios de pagamento, uploads pagos, R2 ou produção.

## Portão para publicar a versão integrada
- Revisar PR e CI de ambos os fluxos.
- Testar Worker com Wrangler dev/Miniflare + D1 local e Static Assets, além do pipeline SQL concorrente no D1 real.
- Criar autenticação QR/NFC com token opaco, expiração/revogação e rate limit; derivar contexto por verificação, não por entrada cliente.
- Testes de browser Android 360/390/430px e desktop 1280px.
- Deploy apenas manual após verificar conta Workers Free, custos, segredos e rollback. Não criar nova conta.

## Fonte e execução
- PR #4 e PR #5 são históricos independentes.
- A branch de integração contém os arquivos dos dois; não mesclar os três PRs em `main` sem coordenar para evitar commits duplicados.
