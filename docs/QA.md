# Qualidade (planejamento)

Consulte a seção 13 de [PRD.md](PRD.md). A automação de testes ainda não foi implementada; não há suíte aprovada ou execução de CI.


**Banco:** `tests/integration/banco/rodar.sh` roda 168 verificações de RLS, pedido, pagamento e mídia num Postgres descartável (CI: `.github/workflows/banco.yml`). Detalhes em [BANCO.md](BANCO.md).
