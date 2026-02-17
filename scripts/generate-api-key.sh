#!/usr/bin/env bash
set -euo pipefail

# Generate a random API key in ank_ format: ank_ + 48 random alphanumeric characters
RAW=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
API_KEY="ank_${RAW}"

# Compute SHA-256 hash of the full key
if command -v shasum >/dev/null 2>&1; then
  HASH=$(printf '%s' "${API_KEY}" | shasum -a 256 | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  HASH=$(printf '%s' "${API_KEY}" | sha256sum | awk '{print $1}')
else
  echo "ERROR: Neither shasum nor sha256sum found on this system." >&2
  exit 1
fi

echo "=== Generated API Key ==="
echo "Key:    ${API_KEY}"
echo "SHA256: ${HASH}"
echo ""
echo "Store the key securely — only the hash is saved in the database."
