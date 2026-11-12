#!/usr/bin/env bash
# READ-ONLY disk report for the droplet. Deletes nothing, changes nothing.
#   bash deploy/scripts/disk-report.sh
# Shows what uses space and whether there is enough free space for the staging build
# plus a production rollback build. Cleanup is only PROPOSED (see the end); run any of
# it yourself after reading the consequences in docs/STAGING_RUNBOOK.md.
set -uo pipefail
NEED_GB="${NEED_GB:-6}"   # staging build (~2.5 GB) + a production rollback build (~2.5 GB) + headroom
hr() { printf '\n== %s\n' "$1"; }

hr "Filesystem"
df -h / /var/lib/docker 2>/dev/null | awk 'NR==1 || !seen[$0]++'
df -i / | tail -1 | awk '{print "inodes used: " $5}'
free_kb=$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2{print $4}'); free_kb=${free_kb:-$(df -Pk / | awk 'NR==2{print $4}')}
free_gb=$(( free_kb / 1024 / 1024 ))
if [ "$free_gb" -ge "$NEED_GB" ]; then echo "PASS  ${free_gb} GB free (need >= ${NEED_GB} GB for staging + rollback)"; else echo "WARN  only ${free_gb} GB free (need >= ${NEED_GB} GB for staging + rollback): free space first"; fi

hr "Docker summary"
docker system df 2>/dev/null || echo "docker not available"

hr "Images (largest first; RUNNING = used by a running container, keep)"
running_images=$(docker ps --format '{{.Image}}' 2>/dev/null | sort -u)
docker images --format '{{.Size}}\t{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' 2>/dev/null | sort -h -r | head -25 | while IFS=$'\t' read -r size ref id age; do
  use="unused"; echo "$running_images" | grep -qxF "$ref" && use="RUNNING"; [ "$ref" = "<none>:<none>" ] && use="dangling"
  printf '%-9s %-8s %-55s %s\n' "$size" "$use" "$ref" "$age"
done

hr "Build cache"
docker buildx du 2>/dev/null | tail -3 || docker system df 2>/dev/null | grep -i "build cache"

hr "Volumes (data: NEVER delete; listed for information)"
docker system df -v 2>/dev/null | awk '/^Local Volumes space usage:/{f=1;next} /^Build cache usage:/{f=0} f' | head -20

hr "Container logs (largest)"
for f in /var/lib/docker/containers/*/*-json.log; do [ -f "$f" ] || continue
  id=$(basename "$(dirname "$f")" | cut -c1-12); name=$(docker ps -a --filter "id=$id" --format '{{.Names}}' 2>/dev/null)
  printf '%s\t%s\n' "$(du -h "$f" | cut -f1)" "${name:-$id}"
done 2>/dev/null | sort -h -r | head -10

hr "System logs"
journalctl --disk-usage 2>/dev/null || true
find /var/log -xdev -type f -size +50M -printf '%s\t%p\n' 2>/dev/null | sort -n -r | head -10 | awk -F'\t' '{printf "%.0f MB\t%s\n", $1/1048576, $2}'

hr "Package caches"
du -sh /var/cache/apt 2>/dev/null || true
du -sh /var/lib/snapd/cache 2>/dev/null || true

hr "Largest directories (same filesystem)"
du -xh --max-depth=2 / 2>/dev/null | sort -h -r | head -20

hr "Proposed cleanup (NOT run). Consequences in docs/STAGING_RUNBOOK.md, section 1"
echo "  A. docker builder prune -f --filter until=168h   # build cache older than 7 days (all projects)"
echo "  B. docker image prune -f                         # dangling (<none>) images only"
echo "  C. journalctl --vacuum-size=300M                 # old system journal beyond 300 MB"
echo "  D. apt-get clean                                 # downloaded package files"
echo "Never: docker volume prune, docker system prune -a, deleting under /var/lib/docker or /opt by hand."
