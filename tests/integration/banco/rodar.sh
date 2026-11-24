#!/usr/bin/env bash
# Ensaia as migrações do TapFlow num Postgres descartável e roda os testes de banco.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres tests/integration/banco/rodar.sh
# Cria um banco temporário com nome próprio e apaga só ele no fim. Nunca aponte para um banco real.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
dir="$raiz/tests/integration/banco"
banco="tapflow_teste_$$"
psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

createdb "$banco"
trap 'dropdb --if-exists "$banco" >/dev/null 2>&1 || true' EXIT

psql_q -d "$banco" -f "$dir/supabase-local.sql"
for m in "$raiz"/supabase/migrations/*.sql; do
  echo "migração: $(basename "$m")"
  psql_q -d "$banco" -1 -f "$m"
done
echo "seed: demo.sql"
psql_q -d "$banco" -1 -f "$raiz/supabase/seed/demo.sql"

falhas=0
for t in "$dir"/teste-*.sql; do
  if psql_q -d "$banco" -f "$dir/apoio.sql" -f "$t" >"$dir/.saida" 2>&1; then
    echo "ok    $(basename "$t") ($(grep -c '^ok ' "$dir/.saida" || true) verificações)"
  else
    echo "FALHA $(basename "$t")"; sed 's/^/      /' "$dir/.saida"; falhas=$((falhas + 1))
  fi
done
rm -f "$dir/.saida"
[ "$falhas" -eq 0 ] || { echo "$falhas arquivo(s) com falha"; exit 1; }
echo "todos os testes de banco passaram"
