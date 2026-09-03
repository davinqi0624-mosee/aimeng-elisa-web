#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"

if [[ "$MODE" != "dry-run" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [dry-run|--apply]"
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw is required"
  exit 1
fi

run() {
  if [[ "$MODE" == "--apply" ]]; then
    "$@"
  else
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  fi
}

echo "Fetching Cloudflare IP ranges..."
mapfile -t CF_IPV4 < <(curl -fsSL https://www.cloudflare.com/ips-v4 | sed '/^$/d')
mapfile -t CF_IPV6 < <(curl -fsSL https://www.cloudflare.com/ips-v6 | sed '/^$/d')

if [[ "${#CF_IPV4[@]}" -eq 0 ]]; then
  echo "Cloudflare IPv4 list is empty; aborting."
  exit 1
fi

echo "Keeping SSH limited and allowing HTTP/HTTPS from Cloudflare only."
run ufw limit 22/tcp

run ufw delete allow 80/tcp || true
run ufw delete allow 443/tcp || true

for cidr in "${CF_IPV4[@]}"; do
  run ufw allow proto tcp from "$cidr" to any port 80
  run ufw allow proto tcp from "$cidr" to any port 443
done

for cidr in "${CF_IPV6[@]}"; do
  run ufw allow proto tcp from "$cidr" to any port 80
  run ufw allow proto tcp from "$cidr" to any port 443
done

run ufw reload
run ufw status numbered

echo "Done. Run with --apply only after animaluni.com and www.animaluni.com are proxied through Cloudflare."
