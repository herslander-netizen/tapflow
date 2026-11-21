# TapFlow — Agentes e Evolution Alvo

## Cinco especializações, um núcleo

| Agente | Função | Situação |
|---|---|---|
| Cardápio | Rascunho de descrição de prato | Motor determinístico criado; Gemini/Groq ainda não ligados à rota de agentes |
| Atendimento | FAQ aprovada ou encaminhar ao humano | Motor determinístico testado |
| Conteúdo Reels | Roteiro de gravação para prato | Motor determinístico testado |
| Gestão | Resumo de métricas agregadas | Motor determinístico testado |
| Notificações | Preparar aviso de status de pedido para Evolution | Motor determinístico testado, sem envio real |

## Regras

- Os arquivos packages/agents/registry.mjs e packages/agents/engine.mjs são módulos internos, não endpoints.
- Sempre exigem tenant e perfil informados por **backend autenticado e confiável**; o chamador de browser não pode criar os contextos por conta própria.
- Nenhum módulo envia mensagens, altera pedidos/preços, cobra pagamentos, publica cardápios ou chama Gemini/Groq.
- O agente de Notificações usa a função draftOrderNotification do adaptador Evolution, apenas com evento confirmado e rascunho sujeito a revisão humana.
- Para enviar por Evolution no futuro: exigir confirmação humana, opt-in persistido, identidade/tenant verificados no servidor, idempotência, gateway conectado e token protegido.
- O projeto TapFlow já foi cadastrado na Evolution Alvo, mas nenhuma instância WhatsApp estava conectada na última consulta; pareamento e token são pendentes.
- O gateway existente da Oracle não foi modificado e nenhum canal foi compartilhado com Flow ou outros produtos.

## Próxima fase

Adicionar sessão autenticada, webhooks validados, histórico de ações, pipeline de IA com orçamento único e revisão humana. Antes disso, tudo continua como demonstração segura.