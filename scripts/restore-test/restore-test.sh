#!/usr/bin/env bash
# FarmaStock — teste de restauro numa base de dados SEPARADA e descartável.
#
# Uso:
#   RESTORE_DB_URL=... RESTORE_TARGET_IS_DISPOSABLE=yes BACKUP_DECRYPTION_KEY_FILE=~/chave-age.txt \
#     scripts/restore-test/restore-test.sh backups/farmastock-<carimbo>.tar.gz.age [--reset-target]
#
#   RESTORE_DB_URL                 base de dados de destino: projecto Supabase de teste/staging ou Supabase local.
#                                  NUNCA a base de produção (o script recusa se for igual a SUPABASE_DB_URL).
#   RESTORE_TARGET_IS_DISPOSABLE   tem de ser "yes": confirma que o destino pode ser apagado.
#   BACKUP_DECRYPTION_KEY_FILE     ficheiro com a chave PRIVADA age. Guardar offline; nunca no repositório nem no bucket.
#   --reset-target                 apaga os schemas public/private e as contas auth do destino antes de restaurar
#                                  (necessário quando o destino já tem as migrações aplicadas).
#
# Verifica: checksum do manifest, contagens por tabela, RLS activo, saldos de stock coerentes.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
source scripts/backup/lib.sh

ARCHIVE="${1:-}"
RESET=false
[[ "${2:-}" == "--reset-target" ]] && RESET=true
[[ -f "$ARCHIVE" ]] || die "indique o ficheiro .tar.gz.age"
require_cmd psql age tar gzip sha256sum
require_env RESTORE_DB_URL BACKUP_DECRYPTION_KEY_FILE
[[ "${RESTORE_TARGET_IS_DISPOSABLE:-}" == "yes" ]] || die "defina RESTORE_TARGET_IS_DISPOSABLE=yes (o destino será alterado)"
[[ "$RESTORE_DB_URL" != "${SUPABASE_DB_URL:-}" ]] || die "o destino é igual a SUPABASE_DB_URL: restauro de teste nunca na base de origem"
[[ -f "$BACKUP_DECRYPTION_KEY_FILE" ]] || die "chave de desencriptação não encontrada"

MANIFEST="${ARCHIVE%.tar.gz.age}.manifest.json"
if [[ -f "$MANIFEST" ]]; then
  expected="$(grep -o '"sha256": "[0-9a-f]*"' "$MANIFEST" | grep -o '[0-9a-f]\{64\}')"
  [[ "$(sha256_of "$ARCHIVE")" == "$expected" ]] || die "SHA-256 não coincide com o manifest"
  log "1/6 SHA-256 confere com o manifest"
else
  log "1/6 AVISO: manifest não encontrado; checksum não verificado"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"
log "2/6 Desencriptar e extrair"
age -d -i "$BACKUP_DECRYPTION_KEY_FILE" "$ARCHIVE" | gzip -d | tar -C "$WORK" -xf -
D="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -n1)"
for f in roles.sql schema.sql data.sql row_counts.tsv; do [[ -s "$D/$f" ]] || die "$f em falta no arquivo"; done

PSQL=(psql "$RESTORE_DB_URL" -X -q -v ON_ERROR_STOP=1)
if $RESET; then
  log "3/6 Limpar destino (schemas public/private e contas auth)"
  "${PSQL[@]}" -f scripts/restore-test/reset-target.sql
else
  log "3/6 Destino usado tal como está (sem --reset-target)"
fi

log "4/6 Restaurar roles, schema e dados (numa transacção, triggers desligados durante a carga)"
# roles.sql pode falhar em roles que já existem num projecto Supabase: não é fatal.
psql "$RESTORE_DB_URL" -X -q -f "$D/roles.sql" >/dev/null 2>&1 || log "    (avisos em roles.sql ignorados: roles já existentes)"
AUTH_COPY=()
for t in users identities; do
  if [[ -s "$D/auth_$t.csv" ]]; then
    cols="$(head -n1 "$D/auth_$t.csv")"
    AUTH_COPY+=(-c "\\copy auth.$t ($cols) from '$D/auth_$t.csv' with (format csv, header)")
  fi
done
"${PSQL[@]}" --single-transaction \
  -c "set session_replication_role = replica" \
  -f "$D/schema.sql" \
  "${AUTH_COPY[@]}" \
  -f "$D/data.sql" \
  -f scripts/restore-test/post-restore.sql
[[ ${#AUTH_COPY[@]} -gt 0 ]] && log "    contas auth restauradas a partir do CSV" || log "    AVISO: arquivo sem contas auth (restaurar contas pelo procedimento separado)"

log "5/6 Comparar contagens por tabela"
count_rows "$RESTORE_DB_URL" > "$WORK/restored.tsv"
if ! diff <(sort "$D/row_counts.tsv") <(sort "$WORK/restored.tsv") > "$WORK/diff.txt"; then
  cat "$WORK/diff.txt" >&2
  die "contagens diferentes entre o backup e o restauro"
fi
log "    $(wc -l < "$WORK/restored.tsv") tabelas, contagens iguais"

log "6/6 Verificações de integridade"
"${PSQL[@]}" -f scripts/restore-test/verify.sql
log "RESTAURO DE TESTE CONCLUÍDO COM SUCESSO"
