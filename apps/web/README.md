# TapFlow — demo visual

React 19 + TypeScript + Vite. Apresenta a jornada: feed ou lista, busca, detalhe, adicionais, carrinho, pedido **simulado**, acompanhamento **simulado** e painel fictício da equipe.

## Executar localmente

Instalar Node.js 22+. Na pasta apps/web, executar em ordem:

~~~bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
~~~

Todo o conteúdo é fictício e está na memória do navegador. Não existe backend, login, pagamento, POS, sincronização ou publicação real. Fotografias ilustrativas são externas (Unsplash) e têm fallback visual; não são fotos do restaurante. O componente de mídia aceita videoUrl real posteriormente, mas a demo não alega ter vídeos dos pratos.

Validar a interface nas larguras 360 / 390 / 430 / 1280 px, teclado, zoom, leitores de tela e reduced motion. O subtotal no frontend **não** é confiável para transações: a API futura recalculará valores em ambiente seguro. Nenhuma integração com Flow, Evolution ou Alvo OS.
