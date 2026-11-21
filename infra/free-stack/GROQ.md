# GroqCloud — configuração futura (ainda desligado)

O adaptador `infra/free-stack/groq.mjs` acessa a API de chat oficial **somente no servidor** e exige revisão humana das sugestões de descrição.

1. Confirmar o acesso ao nível gratuito na sua conta Groq, sem contratar Developer.
2. Gerar chave Groq somente no console https://console.groq.com/keys
3. Armazenar **GROQ_API_KEY** como secret do Worker dedicado TapFlow; não colar no chat ou GitHub.
4. Escolher um modelo compatível e dentro da cota, configurar `GROQ_MODEL` (sem modelo padrão).
5. Somente quando autorizado e com rate-limit/auth da equipe, configurar `GROQ_ENABLED=true` e `GROQ_FREE_TIER_CONFIRMED=true`.
6. Não expor rota pública que permita consumo arbitrário de créditos gratuitos. A API de pedidos nunca deve depender do Groq.

A documentação da API especifica `POST https://api.groq.com/openai/v1/chat/completions`. A disponibilidade do modelo muda; confirmar em https://console.groq.com/docs/models e limites em https://console.groq.com/docs/rate-limits.
