# TapFlow | Sessão de mesa em prévia

Estado: validação e resgate interno no servidor, com migrações propostas. **Não publicar nem ativar pedidos com este PR.**
O Worker e o cardápio de demonstração continuam como estão.

- QR e NFC impressos podem abrir o cardápio por uma mesma URL HTTPS. O link fixo não
  comprova que o cliente está à mesa e não deve carregar o token que autoriza pedidos.
- O servidor verifica um token opaco de alta entropia enviado em `Authorization: Bearer`,
  usa apenas seu SHA-256 no banco e obtém estabelecimento, unidade e mesa da sessão.
  O navegador não escolhe esse escopo. A sessão expirada, revogada ou de local inativo é recusada.
- As migrações `0003_order_sessions.sql` e `0004_order_admissions.sql` são aditivas para o D1 dedicado do TapFlow e **não foram aplicadas** a nenhum ambiente hospedado.
- O resgate interno consome um código de uso único com no máximo cinco minutos de validade e
  emite uma sessão de 30 minutos em uma única operação. Ainda não há emissor nem rota pública.
  Nenhum banco do Flow, Alvo OS ou Evolution faz parte deste passo.

## Antes de ativar

1. Implementar admissão à mesa (pela equipe autenticada ou por código de abertura curto,
   descartável e com prazo), para que uma foto de QR antigo não dê autorização para pedir.
2. Emitir tokens aleatórios de 32 bytes; não registrá-los em URL ou logs. Limitar tentativas
   e emissão, impedir reutilização do código de abertura e limpar sessões expiradas.
3. Preservar a rechecagem de revogação e expiração na gravação. O guard já usa o relógio do banco
   no batch do pedido; os testes simulam mudanças entre a autorização e a persistência.
4. Validar no Wrangler/D1 local e depois na prévia isolada: concorrência e rollback do D1,
   restrições da API, telefone em 360/390/430 px e desktop em 1280 px. A suíte com SQLite
   valida o SQL e o comportamento da API em processo único; não substitui o D1 real.
5. Publicação manual só após revisar ambiente, custos e rollback. Pagamentos, notificações e
   IA não são necessários para este piloto e ficam desligados.

## Verificação local opcional no D1 do Miniflare

Com Miniflare 4.20260730.0 instalado em um diretório de ferramentas separado, rode em Node 22:

```sh
node tests/integration/local-d1-orders.mjs "$PWD" /caminho/do/miniflare/dist/src/index.js
```

O teste usa um Worker de fixture, com banco descartável em memória e sem credenciais ou ID de banco real.
Usa a data de compatibilidade 2026-08-06 suportada pela versão local; não altera o Wrangler do projeto.
Verifica 20 resgates simultâneos do mesmo código, um único pedido com múltiplos reenvios, consulta de
status, expiração, revogação e isolamento entre mesas e estabelecimentos. Não prova concorrência no
serviço hospedado nem ativação da prévia.
