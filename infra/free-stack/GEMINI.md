# Gemini AI Studio — conexão segura para o TapFlow

**Situação:** adaptador preparado no código; **não conectado ao Google**, **não implantado** e **sem credencial gravada**. A conta Cloudflare exclusiva do TapFlow ainda não está conectada ao ChatGPT.

## Credencial compartilhada no chat
A chave informada na conversa deve ser tratada como **exposta**. Crie uma nova no [Google AI Studio](https://aistudio.google.com/api-keys), restrita à **Gemini API**, e revogue a anterior. Não envie a nova chave no chat nem a inclua no GitHub. Ver [orientações oficiais](https://ai.google.dev/gemini-api/docs/api-key).

## Quando a conta Cloudflare TapFlow estiver disponível
- Conferir identidade da conexão e plano Free, sem reutilizar contas de Flow, Alvo OS ou KAIRÓS.
- Guardar a chave **exclusivamente** no secret do Worker TapFlow, com nome `GEMINI_API_KEY`; nunca em `.env` commitado, assets, HTML ou frontend.
- Configurar `GEMINI_ENABLED=true` e `GEMINI_FREE_TIER_CONFIRMED=true` **somente** depois de verificar o Free Tier e os limites da conta. O padrão é desligado.
- Opcional: definir `GEMINI_MODEL` para um identificador atual de modelo no nível gratuito; o adapter usa o padrão `gemini-3.5-flash-lite`, sujeito à disponibilidade real da conta.
- Não expor rota pública direta: ao implementar API, exigir sessão administrativa verificada, autorização por tenant, cotas por organização, controle por usuário e trilha de auditoria.
- Não enviar dados pessoais de clientes, dados de pagamento ou informações sigilosas a modelos gratuitos. Requer revisão humana antes de publicar descrições.
- Testar apenas com chave rotacionada e via backend, verificar log sem segredo, limite de requisições e indisponibilidade 429/5xx.

## Função disponibilizada
`infra/free-stack/gemini.mjs` exporta `suggestProductDescription(input, {env,fetcher})` e `normalizeProductDraft`. A função envia somente nome/categoria/ingredientes informados e solicita uma **sugestão** de texto, nunca executa operações de pedido, estoque, pagamento ou publicação. Exige 2 flags explícitas e a chave server-side.

## Condições reais de preço
O Google disponibiliza modelos com nível gratuito, mas modelos, limites e preços variam por conta/país, e ativar cobrança muda o risco financeiro. Free não significa disponibilidade ou ausência garantida de custos. Consulte https://ai.google.dev/gemini-api/docs/pricing antes de ativar.

**Não é possível ativar a conexão remotamente sem uma conta Cloudflare TapFlow conectada e um novo secret armazenado pelo canal seguro.**
