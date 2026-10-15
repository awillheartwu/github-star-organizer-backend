#!/usr/bin/env bash
set -euo pipefail

service=${1:?Usage: bash scripts/deploy-compose.sh web|api}
case "$service" in
  web) export GSOR_REQUIRE_API_ENV=false ;;
  api)
    export GSOR_REQUIRE_API_ENV=true
    test -s .env.production || { echo 'Missing .env.production' >&2; exit 1; }
    ;;
  *) echo "Unsupported service: $service" >&2; exit 1 ;;
esac

# Keep the existing backend project and its gsor-logs volume. The volume label
# also identifies the project while Compose is replacing the API container.
containers=$(docker ps -a --format '{{.ID}}|{{.Image}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}')
if [[ -z ${COMPOSE_PROJECT_NAME:-} ]]; then
  projects=$(
    {
      printf '%s\n' "$containers" | awk -F '|' '$2 ~ /^gsor-backend(:|@)/ && $4 == "api" {print $3}'
      docker volume ls --filter label=com.docker.compose.volume=gsor-logs --format '{{.Label "com.docker.compose.project"}}'
    } | sed '/^$/d' | sort -u
  )
  if [[ $(printf '%s\n' "$projects" | sed '/^$/d' | wc -l) -gt 1 ]]; then
    echo 'Multiple backend projects found; set COMPOSE_PROJECT_NAME explicitly.' >&2
    exit 1
  fi
  export COMPOSE_PROJECT_NAME=${projects:-gsor}
fi
echo "Deploying $service in Compose project $COMPOSE_PROJECT_NAME"
docker compose -f docker-compose.yml config --quiet

legacy_web=
legacy_running=false
if [[ $service == web ]]; then
  legacy_web=$(printf '%s\n' "$containers" | awk -F '|' -v project="$COMPOSE_PROJECT_NAME" '$2 ~ /^gsor-frontend(:|@)/ && $4 == "web" && $3 != project {print $1}')
  if [[ $(printf '%s\n' "$legacy_web" | sed '/^$/d' | wc -l) -gt 1 ]]; then
    echo 'Multiple legacy frontend containers found; migration requires manual selection.' >&2
    exit 1
  fi
fi

if [[ -n $legacy_web ]]; then
  current_web=$(docker compose -f docker-compose.yml ps -a -q web)
  if [[ -n $current_web ]]; then
    echo 'Both legacy and target frontend containers exist; inspect before migrating.' >&2
    exit 1
  fi
  legacy_running=$(docker inspect --format '{{.State.Running}}' "$legacy_web")
  recover_legacy_web() {
    status=$?
    trap - EXIT
    if [[ $status -ne 0 ]]; then
      echo 'Frontend migration failed; removing the candidate and restoring the old container.' >&2
      if docker compose -f docker-compose.yml rm --stop --force web; then
        if [[ $legacy_running == true ]]; then
          docker start "$legacy_web" || echo 'Could not restart the old frontend; operator intervention required.' >&2
        fi
      else
        echo 'Could not remove the candidate; the old frontend remains stopped to avoid a port conflict.' >&2
      fi
    fi
    exit "$status"
  }
  trap recover_legacy_web EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  docker stop "$legacy_web"
fi

# Never remove or redeploy the other service from this repository's pipeline.
docker compose -f docker-compose.yml up -d --no-build --no-deps "$service"

if [[ -n $legacy_web ]]; then
  # Verify the replacement before discarding the stopped legacy container.
  ready=false
  for ((attempt = 0; attempt < 20; attempt++)); do
    if docker compose -f docker-compose.yml exec -T web wget -q -O /dev/null http://127.0.0.1/; then
      ready=true
      break
    fi
    sleep 1
  done
  [[ $ready == true ]] || { echo 'Replacement frontend did not respond.' >&2; exit 1; }
  # The verified replacement now owns the port; cleanup failure must not roll it back.
  trap - EXIT INT TERM
  docker rm "$legacy_web"
fi
