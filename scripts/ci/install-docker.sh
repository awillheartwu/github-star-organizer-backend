#!/bin/sh
# Copy CLI tools from an official image kept in the NAS Docker cache.
set -eu
image='docker:27.5.1-cli@sha256:851f91d241214e7c6db86513b270d58776379aacc5eb9c4a87e5b47115e3065c'
api() {
  endpoint=$1
  shift
  curl --fail-with-body --silent --show-error --unix-socket /var/run/docker.sock \
    "http://localhost/v${DOCKER_API_VERSION:-1.43}$endpoint" "$@"
}

temporary=$(mktemp -d)
container_id=''
cleanup() {
  if [ -n "$container_id" ]; then
    api "/containers/$container_id" --request DELETE >/dev/null || true
  fi
  rm -rf "$temporary"
}
trap cleanup EXIT HUP INT TERM

status=$(curl --silent --show-error --unix-socket /var/run/docker.sock \
  --output "$temporary/image.json" --write-out '%{http_code}' \
  "http://localhost/v${DOCKER_API_VERSION:-1.43}/images/$image/json")
case "$status" in
  200) echo "Using host-cached Docker CLI/Compose/Buildx image: $image" ;;
  404)
    echo "CLI image is absent from this host; downloading once: $image"
    api "/images/create?fromImage=$image" --request POST
    ;;
  *) echo "Cannot inspect cached CLI image (Docker API HTTP $status); refusing to pull." >&2; exit 1 ;;
esac

# The fresh Node job has no Docker CLI yet, so use the daemon API to copy it.
api /containers/create --header 'Content-Type: application/json' \
  --data "{\"Image\":\"$image\",\"HostConfig\":{\"NetworkMode\":\"none\"}}" \
  --output "$temporary/container.json"
container_id=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).Id)' "$temporary/container.json")
api "/containers/$container_id/archive?path=/usr/local/bin/docker" --output "$temporary/docker.tar"
tar -xf "$temporary/docker.tar" -C /usr/local/bin
mkdir -p /usr/local/lib/docker/cli-plugins
for plugin in docker-compose docker-buildx; do
  api "/containers/$container_id/archive?path=/usr/local/libexec/docker/cli-plugins/$plugin" --output "$temporary/$plugin.tar"
  tar -xf "$temporary/$plugin.tar" -C /usr/local/lib/docker/cli-plugins
done
docker version
docker compose version
docker buildx version
