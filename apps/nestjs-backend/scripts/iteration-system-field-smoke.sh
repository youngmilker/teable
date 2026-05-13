#!/usr/bin/env bash
set -euo pipefail

# Local Phase0 smoke test for iteration-backed system fields.
# Required env:
#   BASE_URL=http://localhost:3000
#   SPACE_ID=spc...
#   TABLE_ID=tbl...
# Optional env:
#   AUTH_HEADER='Authorization: Bearer ...'
#   SMOKE_PREFIX='phase0-iteration'
#   CHECK_DEBUG_DISABLED=true  # run against a server started without SYSTEM_FIELD_DEBUG_BYPASS=true

BASE_URL="${BASE_URL:-http://localhost:3000}"
SPACE_ID="${SPACE_ID:?SPACE_ID is required}"
TABLE_ID="${TABLE_ID:?TABLE_ID is required}"
AUTH_HEADER="${AUTH_HEADER:-}"
SMOKE_PREFIX="${SMOKE_PREFIX:-phase0-iteration}"
CHECK_DEBUG_DISABLED="${CHECK_DEBUG_DISABLED:-false}"
RUN_ID="$(date +%Y%m%d%H%M%S)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

headers=(-H "Content-Type: application/json")
if [[ -n "$AUTH_HEADER" ]]; then
  headers+=(-H "$AUTH_HEADER")
fi

request() {
  local method="$1"
  local path="$2"
  local payload_file="${3:-}"
  local expected_status="${4:-200}"
  local out_file="$TMP_DIR/body.json"
  local status

  if [[ -n "$payload_file" ]]; then
    status="$(curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "${BASE_URL}${path}" "${headers[@]}" --data-binary "@$payload_file")"
  else
    status="$(curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "${BASE_URL}${path}" "${headers[@]}")"
  fi

  if [[ ",$expected_status," != *",$status,"* ]]; then
    printf 'Request: %s %s\nExpected: %s\nActual: %s\nBody:\n' "$method" "$path" "$expected_status" "$status" >&2
    cat "$out_file" >&2
    printf '\n' >&2
    exit 1
  fi

  cat "$out_file"
}

json_get() {
  local file="$1"
  local expr="$2"
  node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const root = data?.data ?? data; const value = (${expr}); if (value == null) process.exit(2); if (typeof value === 'object') console.log(JSON.stringify(value)); else console.log(value);" "$file"
}

json_assert() {
  local file="$1"
  local expr="$2"
  local message="$3"
  node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const root = data?.data ?? data; if (!(${expr})) { console.error(process.argv[2]); process.exit(1); }" "$file" "$message"
}

write_json() {
  local file="$1"
  local json="$2"
  printf '%s\n' "$json" > "$file"
}

attempt_debug_disabled_check() {
  log "Check debug-disabled system field creation guard"
  local payload="$TMP_DIR/debug-disabled-field.json"
  write_json "$payload" "{\"type\":\"singleSelect\",\"name\":\"Debug Disabled ${RUN_ID}\",\"dbFieldName\":\"__iteration_debug_disabled_${RUN_ID}\",\"isSystemField\":true,\"systemFieldKey\":\"iteration\",\"configSource\":{\"type\":\"iteration\",\"spaceId\":\"${SPACE_ID}\"},\"options\":{\"choices\":[]}}"
  request POST "/api/table/${TABLE_ID}/field" "$payload" 403 > /dev/null
  log "Debug-disabled creation guard rejected manual system field creation"
}

if [[ "$CHECK_DEBUG_DISABLED" == "true" ]]; then
  attempt_debug_disabled_check
  exit 0
fi

log "Create iteration baseline data"
iteration_one_payload="$TMP_DIR/iteration-one.json"
iteration_two_payload="$TMP_DIR/iteration-two.json"
write_json "$iteration_one_payload" "{\"name\":\"${SMOKE_PREFIX} Sprint 1 ${RUN_ID}\",\"description\":\"smoke iteration one\",\"color\":\"#2F80ED\",\"sortOrder\":10}"
write_json "$iteration_two_payload" "{\"name\":\"${SMOKE_PREFIX} Sprint 2 ${RUN_ID}\",\"description\":\"smoke iteration two\",\"color\":\"#27AE60\",\"sortOrder\":20}"
request POST "/api/space/${SPACE_ID}/iteration" "$iteration_one_payload" 201 > "$TMP_DIR/iteration-one-res.json"
request POST "/api/space/${SPACE_ID}/iteration" "$iteration_two_payload" 201 > "$TMP_DIR/iteration-two-res.json"
ITERATION_ONE_ID="$(json_get "$TMP_DIR/iteration-one-res.json" 'root.id')"
ITERATION_TWO_ID="$(json_get "$TMP_DIR/iteration-two-res.json" 'root.id')"

log "Verify iteration list contains created records"
request GET "/api/space/${SPACE_ID}/iteration" "" 200 > "$TMP_DIR/iteration-list.json"
json_assert "$TMP_DIR/iteration-list.json" "Array.isArray(root) && root.some((item) => item.id === '${ITERATION_ONE_ID}') && root.some((item) => item.id === '${ITERATION_TWO_ID}')" "Created iterations were not found in list response"

log "Create iteration-backed system field"
field_payload="$TMP_DIR/system-field.json"
write_json "$field_payload" "{\"type\":\"singleSelect\",\"name\":\"迭代 ${RUN_ID}\",\"dbFieldName\":\"__iteration_${RUN_ID}\",\"isSystemField\":true,\"systemFieldKey\":\"iteration\",\"configSource\":{\"type\":\"iteration\",\"spaceId\":\"${SPACE_ID}\"},\"options\":{\"choices\":[]}}"
request POST "/api/table/${TABLE_ID}/field" "$field_payload" 201 > "$TMP_DIR/field-create-res.json"
FIELD_ID="$(json_get "$TMP_DIR/field-create-res.json" 'root.id')"
json_assert "$TMP_DIR/field-create-res.json" "root.isSystemField === true && root.configSource?.type === 'iteration' && Array.isArray(root.options?.choices) && root.options.choices.some((choice) => choice.id === '${ITERATION_ONE_ID}') && root.options.choices.some((choice) => choice.id === '${ITERATION_TWO_ID}')" "Created field response did not contain synced iteration choices"

log "Patch iteration and verify field choices update"
iteration_patch_payload="$TMP_DIR/iteration-patch.json"
write_json "$iteration_patch_payload" "{\"name\":\"${SMOKE_PREFIX} Sprint One ${RUN_ID}\",\"color\":\"#EB5757\",\"sortOrder\":30}"
request PATCH "/api/space/${SPACE_ID}/iteration/${ITERATION_ONE_ID}" "$iteration_patch_payload" 200 > /dev/null
request GET "/api/table/${TABLE_ID}/field/${FIELD_ID}" "" 200 > "$TMP_DIR/field-after-patch.json"
json_assert "$TMP_DIR/field-after-patch.json" "root.options?.choices?.some((choice) => choice.id === '${ITERATION_ONE_ID}' && choice.name === '${SMOKE_PREFIX} Sprint One ${RUN_ID}')" "Iteration rename was not synced to field choices"

log "Delete iteration and verify choice removal"
request DELETE "/api/space/${SPACE_ID}/iteration/${ITERATION_TWO_ID}" "" 200 > /dev/null
request GET "/api/table/${TABLE_ID}/field/${FIELD_ID}" "" 200 > "$TMP_DIR/field-after-delete.json"
json_assert "$TMP_DIR/field-after-delete.json" "root.options?.choices?.some((choice) => choice.id === '${ITERATION_ONE_ID}') && !root.options.choices.some((choice) => choice.id === '${ITERATION_TWO_ID}')" "Deleted iteration choice was not removed from field choices"

log "Verify system field protection allows description"
field_patch_allowed_payload="$TMP_DIR/field-patch-allowed.json"
write_json "$field_patch_allowed_payload" "{\"description\":\"smoke description ${RUN_ID}\"}"
request PATCH "/api/table/${TABLE_ID}/field/${FIELD_ID}" "$field_patch_allowed_payload" 200 > /dev/null

log "Verify system field protection rejects protected changes"
field_patch_rejected_payload="$TMP_DIR/field-patch-rejected.json"
write_json "$field_patch_rejected_payload" "{\"name\":\"should be rejected ${RUN_ID}\"}"
request PATCH "/api/table/${TABLE_ID}/field/${FIELD_ID}" "$field_patch_rejected_payload" 403 > /dev/null

field_convert_rejected_payload="$TMP_DIR/field-convert-rejected.json"
write_json "$field_convert_rejected_payload" "{\"type\":\"singleSelect\",\"options\":{\"choices\":[{\"id\":\"manual\",\"name\":\"Manual\",\"color\":\"blue\"}]}}"
request PUT "/api/table/${TABLE_ID}/field/${FIELD_ID}/convert" "$field_convert_rejected_payload" 403 > /dev/null
request DELETE "/api/table/${TABLE_ID}/field/${FIELD_ID}" "" 403 > /dev/null

log "Verify normal fields cannot use reserved __ dbFieldName prefix"
normal_reserved_payload="$TMP_DIR/normal-reserved-field.json"
write_json "$normal_reserved_payload" "{\"type\":\"singleLineText\",\"name\":\"Reserved Prefix ${RUN_ID}\",\"dbFieldName\":\"__reserved_${RUN_ID}\"}"
request POST "/api/table/${TABLE_ID}/field" "$normal_reserved_payload" "400,403" > /dev/null

log "Phase0 iteration system field smoke passed"
