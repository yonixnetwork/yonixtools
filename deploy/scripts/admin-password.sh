#!/usr/bin/env bash
# Create or replace the administrator password for /admin/ (ad delivery test page).
#   bash deploy/scripts/admin-password.sh            # random password, printed once
# Writes only a password HASH to deploy/admin-auth/htpasswd (git-ignored), which the web
# container reads (read-only). Takes effect immediately; no restart needed.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }
user="${ADMIN_USER:-admin}"
printf '%s' "$user" | grep -Eq '^[a-z][a-z0-9_-]{2,31}$' || { echo "invalid ADMIN_USER" >&2; exit 1; }
pw="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 28)"
mkdir -p admin-auth
chmod 755 admin-auth
tmp="$(mktemp admin-auth/.htpasswd.XXXXXX)"
printf '%s:%s\n' "$user" "$(openssl passwd -apr1 "$pw")" > "$tmp"
chmod 644 "$tmp"   # hash only; the nginx worker must be able to read it
mv "$tmp" admin-auth/htpasswd
echo "Admin login for /admin/ads/ (shown once, store it in your password manager):"
echo "  user:     $user"
echo "  password: $pw"
