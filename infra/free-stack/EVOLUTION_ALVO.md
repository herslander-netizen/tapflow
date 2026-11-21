# Evolution Alvo — Integração TapFlow

## Status real (21/11/2026)
- Gateway Evolution Alvo na Oracle: **online**, versão 2.3.7, 6 instâncias registradas e **0 conectadas** no momento da consulta.
- Projeto **TapFlow** cadastrado no gateway sob slug **tapflow**, independente de Flow, Alvo OS e outras instâncias.
- Pareamento e token de integração: **pendentes**. Nenhuma mensagem real foi enviada ou recebida.
- Painel: https://evolution-alvo.regalbrink4.chatgpt.site

## Protocolo confirmado no gateway
- GET /v1/connection com Authorization: Bearer <token do projeto>.
- POST /v1/messages/text com Authorization: Bearer <token do projeto>, Content-Type application/json e Idempotency-Key (8 a 128 caracteres).
- Payload mínimo: { "number": "55...", "text": "..." }.
- Resposta accepted significa **aceite do pedido de envio, não entrega nem leitura**.
- Resposta unknown é inconclusiva. Repetir com a MESMA chave após verificação; nunca inventar mensagem entregue.

## Segurança TapFlow
A biblioteca infra/free-stack/evolution-alvo.mjs:
- Exige exclusivamente projeto tapflow, HTTPS, token server-side e EVOLUTION_ENABLED=true.
- Envio é bloqueado por padrão; exige EVOLUTION_SEND_ENABLED=true **e** confirmação humana, opt-in verificado, evento persistido verificado, perfil autorizado e tenant compatível.
- Faz hash estável de tenant + evento para Idempotency-Key, evitando colisões entre restaurantes.
- No piloto brasileiro aceita apenas números com DDI 55 e DDD válidos em formato numérico (12–13 dígitos); não aceita grupos, não cria pedidos, não confirma pagamentos e não dispara mensagens a partir de saída de um agente.
- Não está exposta como endpoint público e não foi incorporada ao Worker ativo; sem sessão/autorização confiável do estabelecimento e consentimento persistido, não publicar rota de envio.
- Os perfis, eventos e opt-in devem futuramente ser derivados do banco e de sessão autenticada no backend, e nunca de JSON enviado pelo cliente. Os testes unitários injetam dados simulados e não garantem segurança de uma API pública.

## Próximas ações necessárias
1. Abrir o painel Evolution Alvo e parear WhatsApp do TapFlow, acompanhando o QR Code.
2. Copiar o token do projeto para segredo de ambiente **EVOLUTION_PROJECT_TOKEN** no Worker TapFlow. Não compartilhar no chat, código ou GitHub.
3. Definir EVOLUTION_ALVO_BASE_URL para a **origem real do gateway** confirmada no painel, sem assumir que a URL visual do painel seja a API.
4. Depois do pareamento, definir EVOLUTION_PROJECT_SLUG=tapflow e EVOLUTION_ENABLED=true. Manter EVOLUTION_SEND_ENABLED=false até autenticação, consentimento, auditoria e testes de envio real.
5. Conectar atendimento ao pedido somente após evento confirmado pelo backend; mensagens devem ser opt-in e seguir regras da plataforma WhatsApp/legislação aplicável.
6. Antes de liberar produção: isolamento real por tenant, trilha de eventos, filas com retry seguro, rate limits, monitoramento e tratamento de entrega/erros.

**Sem custo adicional ativado pelo TapFlow nesta etapa.** O gateway existente na Oracle foi reaproveitado, sem alterar seu código ou serviços.
