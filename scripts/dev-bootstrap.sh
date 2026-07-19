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

# The local dev .env is intentionally untracked (see .gitignore). Generate it
# from a dev template when it is missing or still contains the placeholder
# tokens shipped in .env.example, so a fresh boot is zero-touch. These are
# throwaway local-only credentials — never use them outside development.
write_dev_env() {
  cat > .env <<'EOF'
COMPOSE_PROJECT_NAME=ghostfolio-development

# CACHE
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# POSTGRES
POSTGRES_DB=ghostfolio-db
POSTGRES_USER=user
POSTGRES_PASSWORD=dev-local-postgres-password

ACCESS_TOKEN_SALT=dev-local-access-token-salt
ALPHA_VANTAGE_API_KEY=
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?sslmode=prefer
JWT_SECRET_KEY=dev-local-jwt-secret-key
EOF
}

if [ ! -f .env ]; then
  echo "==> .env not found; generating local dev .env"
  write_dev_env
elif grep -q '<INSERT' .env; then
  echo "==> .env contains placeholders; regenerating local dev .env"
  write_dev_env
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
