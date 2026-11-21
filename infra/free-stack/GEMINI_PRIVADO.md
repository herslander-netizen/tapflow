# Gemini privado — TapFlow

A conta Cloudflare exclusiva do TapFlow está conectada. A chave Google informada no chat **não foi transferida**, porque a ferramenta bloqueou a operação por segurança. Este código não contém a chave.

No painel Cloudflare → Workers & Pages → tapflow-preview → Settings → Variables and Secrets, cadastre:
- GEMINI_API_KEY: tipo **Secret**, com a chave já fornecida pelo proprietário, sem reenviá-la no chat.
- TAPFLOW_ADMIN_TOKEN: tipo **Secret**, token novo, diferente da chave Google, aleatório e com no mínimo 32 caracteres, guardado fora do GitHub.
- GEMINI_ENABLED: texto **true** somente após a implantação e o teste da rota.
- GEMINI_FREE_TIER_CONFIRMED: texto **true** somente depois de verificar no AI Studio que a chave/projeto está no nível gratuito.
- GEMINI_MODEL: texto **gemini-3.5-flash-lite** (opcional; confirmar se disponível para a conta).

A rota POST /api/admin/ai/description é restrita a autorização Bearer com TAPFLOW_ADMIN_TOKEN. Sem todas as condições, ela não executa chamadas ao Gemini. O D1 limita a 5 tentativas por dia UTC, inclusive falhas de fornecedor. A IA gera apenas rascunho, nunca publica automaticamente. Nenhum segredo deve entrar no navegador do consumidor ou no GitHub.

A implantação da rota não significa que o Gemini está ativo; é necessária a configuração manual dos segredos e a confirmação do plano. A chave compartilhada no chat pode ter sido exposta a terceiros; o risco permanece enquanto não for revogada.

Fontes: https://ai.google.dev/gemini-api/docs/pricing e https://developers.cloudflare.com/workers/configuration/secrets/
