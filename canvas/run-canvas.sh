#!/bin/bash
# Wrapper script to run canvas with proper environment
cd "$(dirname "$0")"

# Auto-install dependencies if missing
if [ ! -d "node_modules" ]; then
  bun install --silent
fi

exec bun run src/cli.ts "$@"
