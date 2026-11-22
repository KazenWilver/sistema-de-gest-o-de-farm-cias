#!/usr/bin/env bash
# Retenção no bucket: mantém as 30 cópias diárias mais recentes e a primeira cópia de cada mês
# durante 12 meses (secção 10.2). Por defeito só MOSTRA o que apagaria; use --apply para apagar.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
source scripts/backup/lib.sh

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true
KEEP_DAILY="${BACKUP_KEEP_DAILY:-30}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-12}"

[[ "${LEGAL_TRANSFER_APPROVED:-false}" == "true" ]] || die "retenção remota bloqueada: LEGAL_TRANSFER_APPROVED não é true"
require_cmd aws
require_env R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Chaves ordenadas da mais recente para a mais antiga (o nome contém o carimbo UTC).
mapfile -t KEYS < <(aws s3api list-objects-v2 --bucket "$R2_BUCKET_NAME" --prefix daily/ --endpoint-url "$ENDPOINT" \
  --query 'Contents[].Key' --output text | tr '\t' '\n' | grep '\.tar\.gz\.age$' | sort -r)

declare -A KEEP=() MONTHS=()
i=0
for k in "${KEYS[@]}"; do
  i=$((i + 1))
  (( i <= KEEP_DAILY )) && KEEP[$k]=1
done
# Mais antiga de cada mês = cópia mensal (percorrer do mais antigo para o mais recente).
for (( j=${#KEYS[@]}-1; j>=0; j-- )); do
  k="${KEYS[$j]}"
  month="$(sed -E 's/.*farmastock-([0-9]{6}).*/\1/' <<<"$k")"
  [[ -z "${MONTHS[$month]:-}" ]] && MONTHS[$month]="$k"
done
mapfile -t RECENT_MONTHS < <(printf '%s\n' "${!MONTHS[@]}" | sort -r | head -n "$KEEP_MONTHLY")
for m in "${RECENT_MONTHS[@]}"; do KEEP[${MONTHS[$m]}]=1; done

for k in "${KEYS[@]}"; do
  [[ -n "${KEEP[$k]:-}" ]] && continue
  if $APPLY; then
    log "apagar $k (+ manifest)"
    aws s3 rm "s3://$R2_BUCKET_NAME/$k" --endpoint-url "$ENDPOINT" --only-show-errors
    aws s3 rm "s3://$R2_BUCKET_NAME/${k%.tar.gz.age}.manifest.json" --endpoint-url "$ENDPOINT" --only-show-errors || true
  else
    log "(simulação) apagaria $k"
  fi
done
log "retenção: ${#KEYS[@]} cópias, ${#KEEP[@]} mantidas"
