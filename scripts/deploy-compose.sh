#!/usr/bin/env bash
set -euo pipefail

service=${1:?Usage: bash scripts/deploy-compose.sh web|api}
case "$service" in
  web) export GSOR_REQUIRE_API_ENV=false; image=gsor-frontend ;;
  api)
    export GSOR_REQUIRE_API_ENV=true
    image=gsor-backend
    test -s .env.production || { echo 'Missing .env.production' >&2; exit 1; }
    ;;
  *) echo "Unsupported service: $service" >&2; exit 1 ;;
esac

export COMPOSE_PROJECT_NAME=github_star_group
# Keep the physical log volume when changing Compose project ownership.
export GSOR_LOGS_VOLUME=${GSOR_LOGS_VOLUME:-github_star_group-github-star-organizer-backend_gsor-logs}
echo "Deploying $service in Compose project $COMPOSE_PROJECT_NAME"
docker compose -f docker-compose.yml config --quiet

# ps may display an image ID after latest is retagged. Config.Image retains
# the image reference used to create the container, independent of new builds.
container_ids=$(docker ps -aq --filter label=com.docker.compose.project --filter "label=com.docker.compose.service=$service")
containers=
if [[ -n $container_ids ]]; then
  inspection_ids=()
  while IFS= read -r container_id; do
    inspection_ids+=("$container_id")
  done <<< "$container_ids"
  containers=$(docker inspect --format '{{.Id}}|{{.Config.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' "${inspection_ids[@]}")
fi
legacy=$(printf '%s\n' "$containers" | awk -F '|' -v project="$COMPOSE_PROJECT_NAME" -v service="$service" -v image="$image" 'index($2, image ":") == 1 || index($2, image "@") == 1 {if ($4 == service && $3 != project) print $1}')
if [[ $(printf '%s\n' "$legacy" | sed '/^$/d' | wc -l) -gt 1 ]]; then
  echo "Multiple legacy $service containers found; migration requires manual selection." >&2
  exit 1
fi

legacy_running=false
if [[ -n $legacy ]]; then
  current=$(docker compose -f docker-compose.yml ps -a -q "$service")
  if [[ -n $current ]]; then
    current_status=$(docker inspect --format '{{.State.Status}}' "$current")
    if [[ $current_status != created ]]; then
      echo "Both legacy and target $service containers exist ($current_status); inspect before migrating." >&2
      exit 1
    fi
    echo "Removing unstarted $service candidate left by the failed migration: $current"
    docker rm "$current"
  fi
  legacy_running=$(docker inspect --format '{{.State.Running}}' "$legacy")
fi

# New installations need a volume; existing installations reuse it unchanged.
docker volume inspect "$GSOR_LOGS_VOLUME" >/dev/null 2>&1 || docker volume create "$GSOR_LOGS_VOLUME"

if [[ -n $legacy ]]; then
  recover_legacy() {
    status=$?
    trap - EXIT
    if [[ $status -ne 0 ]]; then
      echo "$service migration failed; removing the candidate and restoring the old container." >&2
      if docker compose -f docker-compose.yml rm --stop --force "$service"; then
        if [[ $legacy_running == true ]]; then
          docker start "$legacy" || echo 'Could not restart the old container; operator intervention required.' >&2
        fi
      else
        echo 'Could not remove the candidate; the old container remains stopped to avoid a port conflict.' >&2
      fi
    fi
    exit "$status"
  }
  trap recover_legacy EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  docker stop "$legacy"
fi

docker compose -f docker-compose.yml up -d --no-build --no-deps "$service"

if [[ -n $legacy ]]; then
  ready=false
  for ((attempt = 0; attempt < 20; attempt++)); do
    if [[ $service == web ]]; then
      if docker compose -f docker-compose.yml exec -T web wget -q -T 2 -O /dev/null http://127.0.0.1/; then ready=true; break; fi
    elif docker compose -f docker-compose.yml exec -T api node -e 'fetch("http://127.0.0.1:3000/healthz", {signal: AbortSignal.timeout(2000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'; then
      ready=true
      break
    fi
    sleep 1
  done
  [[ $ready == true ]] || { echo "Replacement $service did not respond." >&2; exit 1; }
  trap - EXIT INT TERM
  docker rm "$legacy"
fi
