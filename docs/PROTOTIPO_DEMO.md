# TapFlow — Protótipo demonstrativo

Produto digital independente da **ALVO Digital**.

Esta branch contém a primeira jornada navegável em **HTML/CSS/JavaScript sem dependências externas**. Preservamos o HTML/CSS do trabalho anterior; a arquitetura preferencial React/TypeScript está documentada em `docs/ADR_STACK_001.md` na branch `main` e permanece como migração futura, não como algo já concluído.

## Executar

```sh
npm run dev
# http://127.0.0.1:4173
```

Requer Node 20+. Testes de regras de negócio: `npm test`.

## Escopo funcional

- Feed vertical navegável por toques, setas, gesto e roda do mouse, com **fotos ilustrativas**, sem vídeos reais.
- Lista, categorias, busca, favoritos, item detalhado, adicionais e observações.
- Carrinho e revisão do pedido; valores em centavos.
- Pedido e cozinha **simulados na memória**, com avanço manual de estados.
- Telas responsivas e suporte a redução de movimento.

## Limites de segurança

**Não é um sistema de restaurante em produção.** Todos os pratos, imagens, preços, mesa, pedidos e estados são fictícios. Não há login, RLS, Supabase, pagamentos, dados persistidos, vídeo hospedado, NFC ou QR real; as fotos remotas exigem internet e têm fallback visual. Jamais apresentar este pedido como recebido por restaurante real.

Não conectar bancos, credenciais, deploys ou outros serviços do Flow, Alvo OS ou Evolution Alvo.

## Revisão

Abra a branch e o PR; não faça merge sem validar visualmente em 360, 390, 430 e 1280 px, mouse/teclado, falhas de rede, testes e acessibilidade. Nenhum deploy automático de produção foi configurado.
