#!/usr/bin/env bash
set -euo pipefail

CONTEXT="orbstack-anon-news"
NAMESPACE="anon-news"

echo "=== Seed Data — Anonymous News Browsing ==="

# -------------------------------------------------------
# Generate an API key
# -------------------------------------------------------
RAW=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
API_KEY="ank_${RAW}"

if command -v shasum >/dev/null 2>&1; then
  API_KEY_HASH=$(printf '%s' "${API_KEY}" | shasum -a 256 | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  API_KEY_HASH=$(printf '%s' "${API_KEY}" | sha256sum | awk '{print $1}')
else
  echo "ERROR: Neither shasum nor sha256sum found." >&2
  exit 1
fi

# -------------------------------------------------------
# Find the postgres pod
# -------------------------------------------------------
echo "[..] Looking for PostgreSQL pod in namespace '${NAMESPACE}'..."
POSTGRES_POD=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get pods \
  -l app=postgresql -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -z "${POSTGRES_POD}" ]; then
  POSTGRES_POD=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get pods \
    -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
fi

if [ -z "${POSTGRES_POD}" ]; then
  echo "ERROR: Could not find a PostgreSQL pod in namespace '${NAMESPACE}'." >&2
  echo "Make sure PostgreSQL is deployed and the pod has label app=postgresql or app.kubernetes.io/name=postgresql." >&2
  exit 1
fi

echo "[OK] Found PostgreSQL pod: ${POSTGRES_POD}"

# -------------------------------------------------------
# Insert test user and API key
# -------------------------------------------------------
echo "[..] Inserting test user and API key..."

kubectl --context="${CONTEXT}" -n "${NAMESPACE}" exec "${POSTGRES_POD}" -- \
  psql -U anonnews -d anonnews -c "
    INSERT INTO users (id, created_at, updated_at)
    VALUES (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at, expires_at)
    VALUES (
      'b1ffcd00-1d1c-5fa9-cc7e-7ccace491b22',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      '${API_KEY_HASH}',
      '${API_KEY:0:8}',
      'seed-test-key',
      NOW(),
      NOW() + INTERVAL '365 days'
    )
    ON CONFLICT (id) DO NOTHING;
  "

echo "[OK] Seed data inserted."
echo ""
echo "=== Test API Key ==="
echo "Key:    ${API_KEY}"
echo "Hash:   ${API_KEY_HASH}"
echo "Prefix: ${API_KEY:0:8}"
echo ""
echo "Use this key in the X-API-Key header to authenticate requests."
