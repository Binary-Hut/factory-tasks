#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOYMENT_URL:?DEPLOYMENT_URL must identify the deployment that was just created}"

npm install
npx playwright install --with-deps chromium
LIVE_URL="$DEPLOYMENT_URL" npx playwright test tests/production.spec.js
