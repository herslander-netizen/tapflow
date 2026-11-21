# Laboratório local do TapFlow · mesa → pedido → status

Este laboratório usa os módulos do PR #7 e o SQL real em SQLite **em memória**.
Não entra na build pública nem expõe rotas no Worker. O operador, restaurante,
cardápio, pagamento e acesso à mesa são fictícios; a simulação não prova
autenticação real da equipe, NFC físico, D1 hospedado ou deploy.

Na raiz da cópia local, com Node 22+ (`node:sqlite`):

```sh
node --test tests/e2e/pilot/pilot.test.mjs
node tests/e2e/pilot/server.mjs
```

Abra somente **http://127.0.0.1:8766**. Não use proxy ou túnel. A prova usa o mesmo
formato de /v1 do piloto fechado e usa o emissor interno com identidade fictícia fixa,
**não** como base de autenticação hospedada.

1. Em largura 360/390/430 px, simule a liberação da mesa e marque "Queijo extra".
2. Cote; confirme que o servidor informa **R$ 32,00**, confirme a simulação e confira
   "Aguardando o restaurante". O preço e um único pedido ficam no banco local; não há Pix nem cobrança.
3. Recarregue a mesma aba. O status continua acessível, sem emitir sessão da mesa
   novamente; não deve haver código/token na URL, DOM ou Local Storage. Uma aba nova,
   aberta independentemente e sem opener, não recebe o acompanhamento.
4. Use "Esquecer nesta aba"; em seguida recarregue. A aba perde acesso local, mas o
   botão não revoga a credencial no servidor nem cancela o pedido.
5. Teste armazenamento bloqueado e confira que o aviso orienta não recarregar.
   Em caso de status indisponível, não crie outro pedido. Se a emissão foi gravada
   mas a resposta se perdeu, "Tentar recuperar acompanhamento" solicita o mesmo
   acesso, com o mesmo prazo, enquanto a sessão autora continuar ativa na página.
6. Repita a jornada em 1280 px e com teclado. O teste automatizado HTTP cobre
   persistência, single-use, idempotência, mudança de status em SQL, recusa de query e revogação.

A sessão da mesa fica só em memória. O `sessionStorage` possui somente o formato
validado do rastreio de um pedido, com prazo limitado; o token segue exclusivamente
em `Authorization` para uma rota de mesma origem. O código não usa Local Storage,
opener, workers, URLs reescritas, analytics ou armazenamento compartilhado. Fechar
a aba ou perder a sessão de pedido antes de guardar o rastreio não é coberto;
o piloto não tem recuperação entre dispositivos, nem por código público.
O navegador pode copiar sessionStorage em duplicação explícita/abertura com opener,
ou restaurar a aba após sessão; não use isso como garantia de isolamento de segurança.
XSS de mesma origem leria o armazenamento: esta opção serve ao laboratório. Revisar
transporte/armazenamento definitivo no lançamento previsto. O encerramento do
servidor descarta o banco inteiro.
