#!/usr/bin/env bash
# Network-level SSRF defence for the YoniXTools containers (run as root, idempotent).
# Drops NEW connections from the stack's subnet to private, loopback, link-local
# (incl. cloud metadata 169.254.169.254), CGNAT, multicast/reserved ranges and to
# the host itself. Public internet and replies to inbound traffic are unaffected.
# This covers every library (yt-dlp/curl_cffi, gallery-dl, FFmpeg), not just Python.
#   bash deploy/scripts/egress-firewall.sh          # apply
#   bash deploy/scripts/egress-firewall.sh --print  # show rules only
#   bash deploy/scripts/egress-firewall.sh --remove
set -euo pipefail
SUBNET="${YONIXTOOLS_SUBNET:-172.30.99.0/24}"
# Chain per stack: staging MUST use its own chain (YONIXTOOLS_EGRESS_CHAIN) so it never
# flushes production's rules. The default is production's chain, unchanged.
CHAIN="${YONIXTOOLS_EGRESS_CHAIN:-YONIXTOOLS-EGRESS}"
if [ "$CHAIN" != "YONIXTOOLS-EGRESS" ] && [ "$SUBNET" = "172.30.99.0/24" ]; then echo "refusing: a non-production chain needs its own subnet" >&2; exit 1; fi
if [ "$CHAIN" = "YONIXTOOLS-EGRESS" ] && [ "$SUBNET" != "172.30.99.0/24" ] && [ -z "${YONIXTOOLS_SUBNET_OVERRIDE_OK:-}" ]; then
  echo "refusing: production's chain with a different subnet would replace production's rules (set YONIXTOOLS_EGRESS_CHAIN)" >&2; exit 1
fi
BLOCK=(0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4)
IPT="iptables"
[ "${1:-}" = "--print" ] && IPT="echo iptables"

remove() {
  iptables -D DOCKER-USER -s "$SUBNET" -j "$CHAIN" 2>/dev/null || true
  iptables -D INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP 2>/dev/null || true
  iptables -F "$CHAIN" 2>/dev/null || true
  iptables -X "$CHAIN" 2>/dev/null || true
}
if [ "${1:-}" = "--remove" ]; then remove; echo "removed"; exit 0; fi
if [ "${1:-}" != "--print" ]; then
  [ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
  command -v iptables >/dev/null || { echo "iptables not found" >&2; exit 1; }
  iptables -L DOCKER-USER -n >/dev/null 2>&1 || { echo "DOCKER-USER chain missing: is Docker running?" >&2; exit 1; }
fi

$IPT -N "$CHAIN" 2>/dev/null || true
$IPT -F "$CHAIN"
$IPT -A "$CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
$IPT -A "$CHAIN" -d "$SUBNET" -j RETURN                 # web <-> downloader inside the stack
for net in "${BLOCK[@]}"; do $IPT -A "$CHAIN" -d "$net" -j DROP; done
$IPT -A "$CHAIN" -j RETURN
if [ "${1:-}" = "--print" ]; then
  echo "iptables -I DOCKER-USER -s $SUBNET -j $CHAIN"
  echo "iptables -I INPUT -s $SUBNET -m conntrack --ctstate NEW -j DROP"
  exit 0
fi
iptables -C DOCKER-USER -s "$SUBNET" -j "$CHAIN" 2>/dev/null || iptables -I DOCKER-USER -s "$SUBNET" -j "$CHAIN"
# Containers reaching the host's own services (SSH, other stacks' published ports) go via INPUT.
iptables -C INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP 2>/dev/null || iptables -I INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP
echo "egress firewall active for $SUBNET"
