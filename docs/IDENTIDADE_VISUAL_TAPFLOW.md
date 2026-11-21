# TapFlow — Identidade visual oficial · v1.0

**Marca:** TapFlow · **Titular:** ALVO Digital · **Data:** 21/11/2026

## 1. Logotipo aprovado

A marca oficial é **exclusivamente o lettering “TapFlow”**, com T e F maiúsculos, letras grossas, arredondadas e desenho orgânico em verde-floresta. **Não adicionar ícone, NFC, QR Code, ondas, contornos ou sublinhados ao logotipo.**

O **PNG original aprovado** está salvo integralmente em `Biblioteca > TapFlow > Identidade Visual > TapFlow_Logotipo_Oficial_Original.png`. Esse arquivo é a fonte visual canônica para reprodução fiel.

`brand/tapflow-wordmark.svg` é um **traçado derivado** do PNG, para uso técnico em interfaces; pode ter diferenças subpixel nas curvas. Validar qualquer arte impressa contra o master original. Variantes transparente e branco-quente encontram-se no kit arquivado na Biblioteca.

Regras: preservar proporções; não usar sombras, deformações, gradientes ou alterações de espaçamento; manter área livre ao redor equivalente à altura do “o” do lettering; largura mínima sugerida 120px em telas digitais.

## 2. Paleta

| Token | Cor | Hex | Aplicação |
|---|---|---|---|
| Forest | Verde-floresta | `#024519` | Logo, superfícies primárias, texto sobre lima |
| Lime | Lima viva | `#B6E229` | CTA, destaque, estado selecionado |
| Cream | Branco quente | `#FEFBF6` | Fundo editorial e versão negativa do lettering |
| Ink | Preto esverdeado | `#101A13` | Texto em superfícies claras |
| Sage | Verde suave | `#E6F1E7` | Cartões claros, divisórias e estados neutros |
| Deep Forest | Verde profundo | `#003615` | Fundo imersivo da experiência Reels |

**Proporção inicial recomendada:** 60% verde profundo/floresta + 30% creme + 10% lima. A comida deve ser a protagonista da experiência, não os efeitos cromáticos.

## 3. Tipografia

- **Logotipo:** lettering desenhado e aprovado; nunca substituir por uma fonte parecida.
- **Títulos e números:** **Sora ExtraBold 800**, com largura compacta, linhas curtas e títulos grandes.
- **Interface e textos:** **Sora Regular 400 / Medium 500 / SemiBold 600**, com legibilidade acima de decoração. Família gratuita disponível via Google Fonts e com fallback system-ui.
- Textos e microcópia sempre em português brasileiro; valores em R$ com vírgula decimal.

## 4. Grafismos e fotografia

Formas orgânicas, linhas de percurso e máscaras arredondadas acompanham a navegação. São grafismos do **sistema**, e **não** partes do logotipo.

Fotos reais de alimentos, vídeo vertical 9:16, foco no prato e fundo escuro quando o conteúdo pede imersão. Nunca apresentar uma imagem de demonstração como fotografia real do restaurante.

## 5. UI mobile-first

- **Feed:** 9:16, fotos/vídeos em destaque, ações compactas e contraste suficiente sobre a mídia.
- **CTA:** lima `#B6E229` com texto verde `#024519`, área tocável mínima de 44px.
- **Cardápio:** fundo creme e tipografia escura; preço claramente legível sem depender de cor.
- **Bottom sheet:** bordas de 28px; foco de teclado, arrasto previsível, fechamento acessível.
- **Estados:** disponível, esgotado, carregando, enviado, em preparo, pronto. Mostrar texto junto de cor/ícone.
- **Animação:** pressão 160ms, sheet 260ms e feed 320ms; respeitar `prefers-reduced-motion`.
- **Verificação:** Android 360/390/430px, desktop 1280px, zoom 200% e contraste WCAG AA.

## 6. Tom de voz

**Promessa proposta:** “Seu cardápio em movimento.”  
**Mensagem de campanha:** “Do menu ao pedido em um tap.”  
Linguagem direta, leve e gastronômica, sem exagerar capacidades de pedidos e pagamentos que ainda não estão ativas na prévia.

## 7. Arquivos entregues e implantação

- `brand/tapflow-wordmark.svg`: versão vetorial derivada.
- `brand/tokens.json`: valores semânticos.
- `brand/tokens.css`: variáveis e exemplo de botão, não carregado automaticamente no app.
- `tests/unit/brand.test.mjs`: testes dos tokens e estrutura de logo.
- **Kit completo com o PNG original, PNG transparente, lettering claro, paleta e painel de aplicações** disponível em `Biblioteca/TapFlow/Identidade Visual`.

**A identidade já está aplicada no HTML/CSS desta branch de design**: lettering aprovado no topo, Sora, cartão de cardápio e sheets creme, ambiente Reels em verde-floresta e CTA lima. A aplicação ainda **não foi implantada**; a prévia pública mantém o tema anterior até revisão, QA e publicação manual.

### Revisão visual pendente

- Verificar visualmente em Chrome Android 360px, 390px, 430px e desktop 1280px (incluindo teclado virtual, safe areas e vídeo reduzido).
- Verificar contraste WCAG 2.2 AA e foco visível em catálogo, carrinho, modais e tabbar.
- Confirmar que nenhum símbolo retorna ao lettering e que o SVG permanece igual ao traçado registrado.
- Não ativar pedidos reais, avisos WhatsApp ou pagamentos nesta etapa.

