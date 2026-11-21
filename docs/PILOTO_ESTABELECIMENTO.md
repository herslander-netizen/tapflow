# TapFlow — primeiro estabelecimento (piloto isolado)

A base une demonstração Reels com identidade oficial e oito temas, pedidos em bancada isolada e um piloto de catálogo com D1. O painel do piloto não é a cozinha demo nem um login pronto para uso comercial.

## Jornada e limites

1. Um operador autoriza **um par de identidade externa + slug**. O responsável autenticado cria a loja e a primeira unidade em uma transação que envia nenhuma mensagem. A autorização é de uso único; conhecer o slug não concede acesso.
2. Pelo painel, o responsável cadastra unidades, categorias, pratos, preços e adicionais. A API também suporta atualizar registros pelo contrato de catálogo. Não há gestão visual de convites, outros papéis ou troca de titular.
3. Em Aparência, o responsável escolhe tema, modo e cores. Um rascunho salvo fica privado. A primeira publicação libera **a consulta do catálogo** em cada unidade ativa, por `/cardapio/:slug/:locationId`. O mesmo link recupera a aparência do banco em outro dispositivo. Mudanças de disponibilidade e preço entram no cardápio já publicado; um item pode ser ocultado ou marcado esgotado.
4. O cliente vê catálogo, busca, categorias, preços e adicionais. Não há pedido na página, checkout, envio ao WhatsApp, upload de marca/mídia nem Reels com dados da loja. A demonstração Reels fica no fluxo separado, com dados fictícios.

## Ativação, somente em ambiente aprovado

- O Worker de demonstração independente (`npm run build:preview`) não inclui o painel nem rotas de cadastro. Não substitua as prévias públicas atuais por este piloto.
- O Worker integrado (`wrangler.preview.jsonc`) exige um D1 exclusivo TapFlow, isolamento de prévia, Workers Free confirmado e revisão de rollback. Nunca habilite no banco de Flow/Alvo OS nem divulgue dados antes da aprovação.
- Migrações de prévia devem ser verificadas com a lista remota antes de qualquer execução. A antiga proposta `0003_appearance_draft.sql` não era aplicada e foi substituída pela `0008_merchant_appearance.sql` para evitar dois arquivos começando por 0003. Se o histórico do alvo divergir ou a antiga SQL estiver registrada, interrompa e reconcilie o histórico antes da execução. Não editar uma migração aplicada.
- Para ativar administração, a configuração deve ter `TAPFLOW_MERCHANT_PREVIEW=true`, `TAPFLOW_MERCHANT_ORIGIN` (origem exata), `TAPFLOW_MERCHANT_ISSUER`, `TAPFLOW_MERCHANT_AUDIENCE`, `TAPFLOW_MERCHANT_PUBLIC_JWKS` e a allowlist `TAPFLOW_MERCHANT_PROVISION_ALLOWLIST` no ambiente, não no Git. As chaves são públicas e pinadas; aceite apenas access tokens RS256 `at+jwt` válidos de curta duração. O painel usa uma função de sessão do provedor a ser integrada; caixa de token só existe em loopback para QA.
- `TAPFLOW_STOREFRONT_PREVIEW=true` libera apenas leitura pública no mesmo host configurado e continua exigindo loja e unidade ativas e tema publicado. Para retirar todo o piloto, desligue as duas flags; para retirar só uma loja/unidade, suspenda-a pelo procedimento operacional. Para voltar à paleta anterior, salve-a como novo rascunho e publique.
- Antes de aceitar um estabelecimento real: validar login/renovação/revogação, proteção por taxa e limites do Free, backup/restauração, aprovação de publicação e teste em aparelhos reais. A banca local de pedidos não habilita pedidos reais nem ativação QR/NFC.

## Verificação local

- Node 22 atual: `npm test`, `node --test tests/e2e/pilot/pilot.test.mjs`, `npm run build:preview`.
- D1 efêmero sintético: `node tests/integration/local-merchant-d1.mjs <entrada Miniflare local>`. Opcionalmente, acrescente `--browser <entrada Playwright local> <entrada Chromium local>` para validar Chromium nos tamanhos 360, 390, 430 e 1280 px e testar a publicação do painel para uma sessão de cliente independente. Não cria recursos remotos ou credenciais persistentes.

## Consolidação dos PRs

O protótipo e a infraestrutura (#4–6), o piloto de pedido (#7), a identidade e validação mobile (#8) e os temas (#10) ficam no mesmo caminho de código. Do #9 foram preservados o estudo e as diretrizes; a implementação alternativa React permanece separada para não substituir a aplicação integrada por uma segunda demonstração com dados fictícios. Não misture os PRs originais individualmente em `main`.

### Login hospedado preparado, ainda não ativado

O painel agora pode usar Auth0 Universal Login (Authorization Code + PKCE) com SDK oficial fixado no lockfile, servido pelo próprio Worker. Faça `npm ci --ignore-scripts` e `npm run build:merchant-preview`. Para o **Worker de piloto dedicado** configure `assets.directory` como `.build/merchant-preview-assets`; não envie a demo sem banco ou sobrescreva o Worker de aparência. O comando de build apenas gera arquivos locais; não cria recursos.

Se o responsável autorizar o provedor e o plano gratuito for verificado no painel da conta:
1. Cadastre um app SPA e uma API exclusivos do TapFlow, com o retorno e a saída exatamente em `https://<origem-do-piloto>/merchant.html`, origem web restrita a esse host. Configure a **expiração principal da API** a 900 s, não a opção de fluxos implícitos. Use RFC 9068 e RS256.
2. Valide um login hospedado com um usuário sintético, sem logar a resposta/tokens. Defina `TAPFLOW_MERCHANT_IDENTITY_PROVIDER=auth0` e `TAPFLOW_MERCHANT_CLIENT_ID`, além das variáveis já indicadas acima. Somente se o token normal vier com a segunda audiência, configure `TAPFLOW_MERCHANT_AUTH0_USERINFO_AUDIENCE` para o `/userinfo` da mesma origem do emissor. O Worker verifica o client ID assinado e nenhuma audiência adicional é autorizada.
3. O SDK guarda os tokens só em memória; reload ou expiração exige voltar ao login. Não use segredos de Flow, client secret de SPA, cartão ou domínio pago. O SDK cobre estado, nonce e transação PKCE; nenhum token de produção deve ser copiado para o chat.
4. Antes da migração e do deploy, confirme o banco exclusivo, conta Cloudflare Free e permissão de escrita, exporte o estado de prévia e valide o histórico. Comece com flags desligadas e homologue login, revogação, cadastro, publicação e leitura anônima antes de habilitar. Se plano ou acesso não verificado, não publique.

Referência oficial: [Code + PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) e [perfis de token](https://auth0.com/docs/secure/tokens/access-tokens/access-token-profiles).
