# Piloto fechado de pedidos por mesa

Não está publicado nem ligado no Worker da demonstração. O QR/NFC identifica o
estabelecimento/mesa, não concede permissão. No piloto, a equipe precisa estar
vinculada à unidade para emitir um acesso descartável; o pedido utiliza outra
credencial temporária. Acompanhar não permite cotar ou criar pedidos. A situação
do pagamento continua independente: o piloto não integra cobrança, Pix,
WhatsApp nem notificações reais.

## Rotas isoladas e condições de ativação

- `POST /v1/table-admissions`: equipe autenticada, associação ativa à unidade e
  papel autorizado. A associação é revalidada na escrita que emite o código.
- `POST /v1/order-sessions`: troca o código consumível, de cinco minutos, por
  sessão de mesa de trinta minutos. O código segue apenas no corpo JSON.
- `POST /v1/quotes` e `POST /v1/orders`: sessão da mesa em Authorization; o
  servidor calcula o preço. Confirmação exige chave de idempotência.
- `POST /v1/order-tracking/:id`: devolve o mesmo acesso de leitura autorizado
  quando a resposta inicial se perde, sem criar pedido ou prolongar validade.
  `GET` na mesma rota aceita apenas esse acesso e devolve estado mínimo.

Nenhuma rota aceita parâmetros na URL. Só o piloto recebe essas rotas; ele exige
origem fixa e não habilita CORS. As duas operações de admissão exigem
identificação de ingresso comprovada e freios de borda independentes; os freios
da Cloudflare são aproximados e não substituem os limites atômicos no banco.

## Critério de liberação do piloto hospedado

1. Confirmar ambiente, banco e cotas gratuitos isolados da demo e de outros
   projetos. Sem migrações, credenciais ou deploy no ambiente atual.
2. Selecionar provedor que emita token de acesso RS256 com `at+jwt`, emissor e
   destinatário fixos, rotação confiável e credenciais próprias do TapFlow.
   Verificar acesso real de operador, suspensão e recusa entre unidades.
3. Validar no ambiente isolado a origem comprovada das solicitações e o
   comportamento dos limites de borda, logs redigidos, migrações e reversão.
4. Completar interação no navegador em 360/390/430/1280 px e testar retorno por
   recarga, fechamento da aba, resposta perdida e NFC em um aparelho real.
   O laboratório cobre só recarga na mesma aba, e recuperação da emissão
   enquanto a sessão autora estiver ativa. Não cobre fechar e reabrir do zero.
5. Antes de aceitar pedidos reais, concluir operação da fila da cozinha,
   transições autorizadas de status e remoção de acessos expirados.

## Verificação local

`node --test tests/unit/*.test.mjs tests/e2e/pilot/pilot.test.mjs` com Node 22+.
O [laboratório](../tests/e2e/pilot/README.md) roda com SQLite em memória.
`tests/integration/local-d1-orders.mjs` valida a composição com Miniflare/D1
local, token da equipe assinado com chave efêmera, concorrência, isolamento,
vínculo suspenso e perda da resposta após gravar. Não é prova hospedada.
