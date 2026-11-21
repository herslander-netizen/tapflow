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
