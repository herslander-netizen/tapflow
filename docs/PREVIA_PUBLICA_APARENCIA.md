# TapFlow — prévia de personalização publicada
**Projeto:** TapFlow / ALVO Digital · **Data:** 21/11/2026

**Abrir pelo celular:** https://tapflow-aparencia-demo.tapflowse.workers.dev/

## Como testar
1. Abra o link HTTPS no celular.
2. Toque em **🎨 Cores** no cabeçalho.
3. Escolha uma das oito opções por segmento, alterne Claro/Escuro, ajuste Cor principal e Cor de fundo.
4. Observe o cardápio e botões mudarem imediatamente, sem recarregar.
5. Toque **Salvar nesta prévia** para manter a escolha neste navegador; **Cancelar** para descartar e **Restaurar padrão** para voltar à identidade TapFlow.

## O que a prévia faz e o que não faz
- Conteúdo, cardápio e pedidos são fictícios; personalização só no navegador, via localStorage (sem conta, login ou sincronização).
- Não há conexão à base D1, registros reais de estabelecimentos nem pagamento.
- A navegação permite testar feed, lista, detalhes e carrinho da demo integrada.
- A prévia de aparência roda em um **Worker separado** `tapflow-aparencia-demo` na **conta Cloudflare exclusiva TapFlow**. O Worker antigo `tapflow-preview` continua sem alteração.
- Endereço de diagnóstico (sem dados privados): https://tapflow-aparencia-demo.tapflowse.workers.dev/__preview/status
- CI pública: `.github/workflows/tapflow-live-smoke.yml`; verifica status HTTP e módulos. **O teste HTTP não equivale a QA visual em navegador.**
- O Worker foi publicado por envio controlado de código da branch de revisão. Mudanças futuras em GitHub **não são aplicadas automaticamente**; precisam de novo deploy e confirmação. Não confundir visualização instantânea das cores com automação de publicação de código.

## Para implantação comercial
A edição só deverá ficar disponível no painel autenticado do estabelecimento, com autorização por tenant/unidade, `draft` e `published`, auditoria, recuperação de versões, validação de contraste e configuração pública lida do backend. Não expor escrita de temas sem autenticação e não aplicar a migração D1 nesta prévia.
