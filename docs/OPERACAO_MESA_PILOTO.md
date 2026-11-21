# TapFlow: operação de mesa e cozinha (revisão, não ativada)

- Gerencie links de mesa pelo painel da unidade. Um QR impresso ou uma etiqueta NFC abre o mesmo link público com a mesa identificada. O painel gera um SVG para impressão, sem enviar dados para API de QR. Um link duplicado não cria outra mesa; um link desativado não volta a funcionar.
- O ID no QR/NFC identifica somente a mesa pública. Não é senha, permissão de pedido, sessão nem autorização da equipe. Desative um link antigo no painel e gere outro se precisar substituí-lo. As consultas validam a unidade, o estabelecimento, a publicação e o estado da mesa.
- A cozinha usa a sessão de equipe já aberta no painel, somente quando o flag `TAPFLOW_KITCHEN_PREVIEW` é habilitado explicitamente. A API limita acesso por vínculo ativo de unidade e registra cada mudança autorizada. Aceitar, preparar, deixar pronto e entregar são passos separados; concorrência não repete a transição.
- A jornada de pedido foi testada com D1 efêmero e tokens sintéticos: autorização de equipe → código de mesa de uso único → cotação → pedido idempotente → preparo → entrega → status público do pedido por token de acompanhamento. O Worker publicado continua sem uma porta de entrada para pedidos reais. Não habilite por variável avulsa: primeiro valide os limites e a procedência do ingresso, expiração, isolamento, erros e recuperação em prévia fechada.
- Antes de abrir a primeira unidade real: verificar o login de um lojista autorizado no Auth0, revisar a migração `0010` com backup só do piloto, configurar acesso por função e limites, testar tags/QR em aparelhos reais e fazer uma simulação fechada de atendimento. Pagamentos, estoque e notificações reais não fazem parte desta etapa.

## Testes de integração locais
- `npm ci --ignore-scripts`, `npm test`, `npm run build:preview`, `npm run build:merchant-preview`.
- `node tests/integration/local-merchant-d1.mjs <entrada Miniflare local> --auth0-contract` cobre verificação sintética, escopo, cadastro, publicação, links de mesa e revogação.
- `node tests/integration/local-d1-orders.mjs "$PWD" <entrada Miniflare local>` cobre sessão/cotação/pedido/cozinha e acompanhamento.
- `node tests/integration/local-merchant-d1.mjs <entrada Miniflare local> --browser <Playwright local> <Chromium local>` cobre painel, download SVG, cardápio e identificação da mesa em sessão anônima.
