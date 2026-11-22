#!/usr/bin/env bash
# Funções partilhadas pelos scripts de backup e restauro. Nunca imprimir segredos.

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() { log "ERRO: $*"; exit 1; }

require_cmd() {
  for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "comando em falta: $c"; done
}

require_env() {
  for v in "$@"; do
    local val="${!v:-}"
    [[ -n "$val" && "$val" != "REPLACE_ME" ]] || die "variável de ambiente em falta: $v"
  done
}

sha256_of() { sha256sum "$1" | awk '{print $1}'; }

# Contagem exacta de linhas por tabela do schema public (usado no manifest e na verificação do restauro).
# Saída: "tabela<TAB>contagem" por linha, ordenada.
COUNT_ROWS_SQL="select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;"

count_rows() { psql "$1" -X -v ON_ERROR_STOP=1 -At -F $'\t' -c "$COUNT_ROWS_SQL"; }

# Colunas não geradas de uma tabela (para exportar/importar auth.users sem colunas geradas).
non_generated_columns() {
  psql "$1" -X -v ON_ERROR_STOP=1 -At -c "select string_agg(quote_ident(column_name), ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = '$2' and table_name = '$3' and is_generated = 'NEVER';"
}

# Contagem de linhas por tabela a partir do próprio dump (blocos COPY ... FROM stdin; ... \.).
# Conta o que ficou no ficheiro, sem depender de escritas que ocorram depois da exportação.
count_copy_rows() {
  awk '
    /^COPY "public"\."[^"]+"/ { match($0, /"public"\."[^"]+"/); t = substr($0, RSTART + 10, RLENGTH - 11); c = 0; inb = 1; next }
    inb && /^\\.$/ { print t "\t" c; inb = 0; next }
    inb { c++ }
  ' "$1" | sort
}
