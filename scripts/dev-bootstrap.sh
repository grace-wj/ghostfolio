#!/usr/bin/env bash
#
# Idempotent development bootstrap: brings up Postgres + Redis, applies the
# Prisma schema, and seeds the base data plus a sample portfolio with fixed
# MarketData fixtures (no live market data required). Safe to re-run; run this
# at the start of a session because the database is empty on a fresh boot.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $ROOT_DIR" >&2
  exit 1
fi

# Export env vars (POSTGRES_*, DATABASE_URL with interpolation, ACCESS_TOKEN_SALT).
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Starting Postgres + Redis"
docker compose --env-file ./.env -f docker/docker-compose.dev.yml up -d

echo "==> Waiting for Postgres"
for i in $(seq 1 60); do
  if docker exec postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Applying Prisma schema"
yarn database:push

echo "==> Seeding base data"
yarn database:seed

echo "==> Seeding sample portfolio"
yarn database:seed-dev-portfolio

echo "==> Done. Start the app with: yarn start:server (:3333) and yarn start:client (:4200)"
