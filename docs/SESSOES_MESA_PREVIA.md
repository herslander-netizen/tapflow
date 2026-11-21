# TapFlow | Sessão de mesa em prévia

Estado: validação do servidor e migração propostas. **Não publicar nem ativar pedidos com este PR.**
O Worker e o cardápio de demonstração continuam como estão.

- QR e NFC impressos podem abrir o cardápio por uma mesma URL HTTPS. O link fixo não
  comprova que o cliente está à mesa e não deve carregar o token que autoriza pedidos.
- O servidor verifica um token opaco de alta entropia enviado em `Authorization: Bearer`,
  usa apenas seu SHA-256 no banco e obtém estabelecimento, unidade e mesa da sessão.
  O navegador não escolhe esse escopo. A sessão expirada, revogada ou de local inativo é recusada.
- `0003_order_sessions.sql` é aditiva para o D1 dedicado do TapFlow e **não foi aplicada**.
  Nenhum banco do Flow, Alvo OS ou Evolution faz parte deste passo.

## Antes de ativar

1. Implementar admissão à mesa (pela equipe autenticada ou por código de abertura curto,
   descartável e com prazo), para que uma foto de QR antigo não dê autorização para pedir.
2. Emitir tokens aleatórios de 32 bytes; não registrá-los em URL ou logs. Limitar tentativas
   e emissão, impedir reutilização do código de abertura e limpar sessões expiradas.
3. Garantir que revogação e expiração ainda valham no momento da gravação, dentro do batch
   do pedido, inclusive quando a sessão expirar entre a primeira leitura e a persistência.
4. Validar no Wrangler/D1 local e depois na prévia isolada: concorrência e rollback do D1,
   restrições da API, telefone em 360/390/430 px e desktop em 1280 px. A suíte com SQLite
   valida o SQL e o comportamento da API em processo único; não substitui o D1 real.
5. Publicação manual só após revisar ambiente, custos e rollback. Pagamentos, notificações e
   IA não são necessários para este piloto e ficam desligados.
