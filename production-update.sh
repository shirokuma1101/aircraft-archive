#!/usr/bin/env bash
# Run on the production Ubuntu host, as the user who owns this checkout.
set -Eeuo pipefail
umask 077

if [[ "${1:-}" == --help ]]; then
  echo 'Usage: ./production-update.sh [--no-pull]'
  echo 'Fast-forward main, back up DB/uploads, build, apply schema, restart web.'
  echo '--no-pull deploys the current local commit (still requires a clean checkout).'
  exit 0
fi
if (( $# > 1 )) || [[ $# == 1 && $1 != --no-pull ]]; then
  echo 'Unknown argument. Use --help.' >&2; exit 2
fi
cd -- "$(dirname -- "$(realpath -- "${BASH_SOURCE[0]}")")"
for tool in git docker flock; do command -v "$tool" >/dev/null || { echo "Missing: $tool" >&2; exit 1; }; done
[[ -f .env ]] || { echo 'Missing .env. Complete initial deployment first.' >&2; exit 1; }
mkdir -p .local
exec 9>.local/production-update.lock
flock -n 9 || { echo 'Another update is running.' >&2; exit 1; }
step=preflight
backup=''
trap 'printf "Update failed during: %s\nBackup: %s\nNo automatic database rollback was performed.\n" "$step" "${backup:-not created}" >&2' ERR
[[ $(git branch --show-current) == main ]] || { echo 'Switch to main before updating.' >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo 'Uncommitted files found. Commit or move them before updating; .env is ignored.' >&2; exit 1; }
compose=(docker compose --project-directory "$PWD" --env-file "$PWD/.env" -f "$PWD/compose.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" exec -T database pg_isready -U archive -d archive >/dev/null
"${compose[@]}" exec -T directus node -e 'fetch("http://127.0.0.1:8055/server/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
previous=$(git rev-parse HEAD)
step=backup
mkdir -p .local/backups
backup=$(mktemp -d "$PWD/.local/backups/$(date -u +%Y%m%dT%H%M%SZ)-${previous:0:12}-XXXXXX")
printf '%s\n' "$previous" > "$backup/previous-commit.txt"
cp .env "$backup/env"
cp compose.yaml "$backup/compose.yaml"
echo "Backing up database and original images to $backup"
"${compose[@]}" exec -T database pg_dump -U archive -d archive -Fc > "$backup/database.dump"
"${compose[@]}" exec -T directus tar -czf - -C /directus/uploads . > "$backup/uploads.tar.gz"
[[ -s "$backup/database.dump" && -s "$backup/uploads.tar.gz" ]]
touch "$backup/COMPLETE"
step=git-update
if [[ "${1:-}" != --no-pull ]]; then
  git fetch origin main
  git merge --ff-only origin/main
fi
printf '%s\n' "$(git rev-parse HEAD)" > "$backup/target-commit.txt"
"${compose[@]}" config --quiet
step=build
echo 'Building web and schema setup images (existing web stays running).'
"${compose[@]}" --profile setup build web init
step=schema
"${compose[@]}" --profile setup run --rm --no-deps init
step=web-restart
"${compose[@]}" up -d --no-deps web
step=health-check
healthy=false
for ((attempt=1; attempt<=12; attempt++)); do
  if "${compose[@]}" exec -T web node -e 'fetch("http://127.0.0.1:3000/",{signal:AbortSignal.timeout(15000)}).then(async r=>{const body=await r.text();if(!r.ok||body.includes("データに接続できません")||body.includes("セットアップ待ち"))process.exit(1)}).catch(()=>process.exit(1))'; then
    healthy=true; break
  fi
  sleep 5
done
if [[ "$healthy" != true ]]; then echo 'Web health check failed. Inspect: docker compose logs --tail=100 web directus' >&2; false; fi
echo "Update complete: $(git rev-parse --short HEAD)"
echo "Backup retained: $backup"
echo 'Check login and editing at the public HTTPS URL.'
