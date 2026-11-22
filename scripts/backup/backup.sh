#!/usr/bin/env bash
# FarmaStock — backup da base de dados da aplicação.
#
# Passos (secção 10.3): exportar -> validar -> comprimir e cifrar -> SHA-256 -> manifest
#   -> [envio para bucket privado + confirmação do checksum] -> registo em backup_runs.
#
# Variáveis:
#   SUPABASE_DB_URL               ligação Postgres (obrigatória; GitHub Secret ou ambiente local)
#   BACKUP_ENCRYPTION_RECIPIENT   chave PÚBLICA age (age1...). A chave privada nunca entra aqui.
#   BACKUP_DIR                    pasta de saída (por defeito ./backups, ignorada pelo git)
#   BACKUP_INCLUDE_AUTH_USERS     "true" para exportar auth.users/auth.identities (contém hashes de palavra-passe)
#   BACKUP_RECORD_RUN             "true" (defeito) regista o resultado em public.backup_runs
#   BACKUP_UPLOAD_ENABLED         "true" para enviar para o R2. Por defeito NÃO envia.
#   LEGAL_TRANSFER_APPROVED       tem de ser "true" para o envio: só depois de validada a transferência
#                                 internacional com jurista/APD (secção 10.5).
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME   (só para envio)
#
# Requer: supabase CLI, psql, age, gzip, tar, sha256sum; aws CLI apenas para envio.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
source scripts/backup/lib.sh

require_cmd supabase psql age tar gzip sha256sum
require_env SUPABASE_DB_URL BACKUP_ENCRYPTION_RECIPIENT
[[ "$BACKUP_ENCRYPTION_RECIPIENT" == age1* ]] || die "BACKUP_ENCRYPTION_RECIPIENT tem de ser uma chave pública age (age1...)"

BACKUP_DIR="${BACKUP_DIR:-backups}"
INCLUDE_AUTH="${BACKUP_INCLUDE_AUTH_USERS:-false}"
RECORD_RUN="${BACKUP_RECORD_RUN:-true}"
UPLOAD="${BACKUP_UPLOAD_ENABLED:-false}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="farmastock-${STAMP}"
mkdir -p "$BACKUP_DIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"
mkdir "$WORK/$NAME"

RUN_ID=""
record_start() {
  [[ "$RECORD_RUN" == "true" ]] || return 0
  RUN_ID="$(psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -At -c \
    "insert into public.backup_runs (status) values ('started') returning id;")"
}
record_end() { # status, file, size, sha, destination, error
  [[ "$RECORD_RUN" == "true" && -n "$RUN_ID" ]] || return 0
  psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 \
    -v id="$RUN_ID" -v st="$1" -v fn="$2" -v sz="${3:-0}" -v sha="$4" -v dest="$5" -v err="$6" <<'SQL' || log "aviso: não foi possível registar em backup_runs"
update public.backup_runs set status = :'st'::public.backup_status, finished_at = now(),
  file_name = nullif(:'fn', ''), file_size_bytes = nullif(:'sz', '0')::bigint,
  sha256_checksum = nullif(:'sha', ''), destination = nullif(:'dest', ''),
  error_summary = left(nullif(:'err', ''), 500)
where id = :'id'::uuid;
SQL
}
on_error() {
  local line=$1
  log "falhou na linha $line"
  record_end failed "" 0 "" "" "Falha no passo do script (linha $line). Ver registo do job."
  exit 1
}
trap 'on_error $LINENO' ERR

record_start
log "1/6 Exportar (roles, schema, dados da aplicação)"
D="$WORK/$NAME"
supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$D/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$D/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy --schema public -f "$D/data.sql"

if [[ "$INCLUDE_AUTH" == "true" ]]; then
  log "    + contas Supabase Auth (auth.users, auth.identities) em CSV"
  for t in users identities; do
    cols="$(non_generated_columns "$SUPABASE_DB_URL" auth "$t")"
    psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -c \
      "\\copy (select $cols from auth.$t) to '$D/auth_$t.csv' with (format csv, header)"
  done
fi

log "2/6 Validar ficheiros e contar linhas"
for f in roles.sql schema.sql data.sql; do [[ -s "$D/$f" ]] || die "$f vazio ou inexistente"; done
grep -q 'CREATE TABLE IF NOT EXISTS "public"."stock_movements"\|CREATE TABLE "public"."stock_movements"' "$D/schema.sql" \
  || die "schema.sql não contém public.stock_movements"
count_copy_rows "$D/data.sql" > "$D/row_counts.tsv"
[[ -s "$D/row_counts.tsv" ]] || die "não foi possível contar linhas"

log "3/6 Comprimir e cifrar (age, destinatário público)"
tar -C "$WORK" -cf - "$NAME" | gzip -9 | age -r "$BACKUP_ENCRYPTION_RECIPIENT" -o "$BACKUP_DIR/$NAME.tar.gz.age"
ARCHIVE="$BACKUP_DIR/$NAME.tar.gz.age"
[[ -s "$ARCHIVE" ]] || die "arquivo cifrado vazio"

log "4/6 SHA-256 e manifest"
SHA="$(sha256_of "$ARCHIVE")"
SIZE="$(stat -c %s "$ARCHIVE")"
{
  printf '{\n'
  printf '  "format": "farmastock-backup/1",\n'
  printf '  "created_at": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "archive": "%s",\n' "$NAME.tar.gz.age"
  printf '  "size_bytes": %s,\n' "$SIZE"
  printf '  "sha256": "%s",\n' "$SHA"
  printf '  "encryption": "age (X25519), destinatário público",\n'
  printf '  "git_commit": "%s",\n' "$(git rev-parse --short HEAD 2>/dev/null || echo desconhecido)"
  printf '  "contents": ["roles.sql", "schema.sql", "data.sql (schema public)", "row_counts.tsv"%s],\n' \
    "$([[ "$INCLUDE_AUTH" == "true" ]] && echo ', "auth_users.csv", "auth_identities.csv"')"
  printf '  "not_included": ["dados de outros schemas geridos pelo Supabase (storage, realtime, vault...)", "objectos do Supabase Storage (não usado no MVP)", "configuração do projecto Supabase (Auth, SMTP, URLs)", "Edge Functions e os seus segredos (estão no repositório / no painel)"%s],\n' \
    "$([[ "$INCLUDE_AUTH" == "true" ]] || echo ', "contas Supabase Auth (auth.users, auth.identities)"')"
  printf '  "row_counts": {'
  awk -F'\t' 'BEGIN{s=""} {printf "%s\"%s\": %s", s, $1, $2; s=", "}' "$D/row_counts.tsv"
  printf '}\n}\n'
} > "$BACKUP_DIR/$NAME.manifest.json"
log "    $NAME.tar.gz.age  $SIZE bytes  sha256=$SHA"

DEST="local:$BACKUP_DIR"
if [[ "$UPLOAD" == "true" ]]; then
  [[ "${LEGAL_TRANSFER_APPROVED:-false}" == "true" ]] \
    || die "envio bloqueado: LEGAL_TRANSFER_APPROVED não é true (validação jurídica da transferência pendente)"
  require_cmd aws
  require_env R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  PREFIX="daily/$(date -u +%Y/%m)"
  log "5/6 Enviar para o bucket privado ($PREFIX/)"
  aws s3 cp "$ARCHIVE" "s3://$R2_BUCKET_NAME/$PREFIX/$NAME.tar.gz.age" --endpoint-url "$ENDPOINT" --only-show-errors \
    --metadata "sha256=$SHA"
  aws s3 cp "$BACKUP_DIR/$NAME.manifest.json" "s3://$R2_BUCKET_NAME/$PREFIX/$NAME.manifest.json" --endpoint-url "$ENDPOINT" --only-show-errors
  log "    confirmar objecto e checksum"
  aws s3 cp "s3://$R2_BUCKET_NAME/$PREFIX/$NAME.tar.gz.age" "$WORK/check.age" --endpoint-url "$ENDPOINT" --only-show-errors
  [[ "$(sha256_of "$WORK/check.age")" == "$SHA" ]] || die "checksum do objecto enviado não coincide"
  DEST="r2:$R2_BUCKET_NAME/$PREFIX"
else
  log "5/6 Envio DESACTIVADO (BACKUP_UPLOAD_ENABLED != true). Arquivo fica em $BACKUP_DIR/."
fi

log "6/6 Registar sucesso"
record_end success "$NAME.tar.gz.age" "$SIZE" "$SHA" "$DEST" ""
echo "$ARCHIVE"
