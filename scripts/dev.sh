#!/usr/bin/env bash
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"
COMPOSE=(docker compose)
DEV_COMPOSE=(-f docker-compose.yml -f docker-compose.dev.yml)
UTILISATEUR=()
if command -v id >/dev/null 2>&1; then
  UID_HOTE="$(id -u 2>/dev/null || true)"
  GID_HOTE="$(id -g 2>/dev/null || true)"
  if [[ "$UID_HOTE" =~ ^[0-9]+$ && "$GID_HOTE" =~ ^[0-9]+$ ]]; then
    UTILISATEUR=(--user "$UID_HOTE:$GID_HOTE")
  fi
fi

usage() {
  echo "Usage : scripts/dev.sh {up|dev|down|test|test-ia|check|seed|reset|doctor}"
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 2
fi

TASK="$1"
shift

case "$TASK" in
  up)
    "${COMPOSE[@]}" up --build -d --wait
    ;;
  dev)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" up --build
    ;;
  down)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" down
    ;;
  test)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" run --build --rm "${UTILISATEUR[@]}" backend pytest "$@"
    ;;
  test-ia)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" run --build --rm --no-deps "${UTILISATEUR[@]}" ia-service pytest -p no:cacheprovider "$@"
    ;;
  check-backend)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" run --build --rm "${UTILISATEUR[@]}" -e RUFF_NO_CACHE=true backend sh -c \
      "ruff check . && ruff format --check . && pytest -q --cov=app --cov-fail-under=70"
    ;;
  check-ia)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" run --build --rm --no-deps "${UTILISATEUR[@]}" -e RUFF_NO_CACHE=true ia-service sh -c \
      "ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70"
    ;;
  check-front)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" run --build --rm --no-deps frontend npm run check
    ;;
  check)
    "$0" check-backend
    "$0" check-ia
    "$0" check-front
    ;;
  seed)
    "${COMPOSE[@]}" exec backend python -m app.seed
    ;;
  reset)
    "${COMPOSE[@]}" "${DEV_COMPOSE[@]}" down --volumes
    ;;
  doctor)
    if command -v python3 >/dev/null 2>&1; then
      python3 scripts/doctor.py
    elif command -v python >/dev/null 2>&1; then
      python scripts/doctor.py
    else
      echo "Python absent : installez Python 3.11 pour lancer doctor." >&2
      exit 1
    fi
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
