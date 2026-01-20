#!/bin/sh
if [ "$1" = "--auth" ]; then
  # Run auth command
  exec bun run dist/main.js auth
else
  # Support both GH_TOKEN (single) and GH_TOKENS (multiple, comma-separated)
  # Priority: GH_TOKENS > GH_TOKEN
  if [ -n "$GH_TOKENS" ]; then
    exec bun run dist/main.js start -g "$GH_TOKENS" "$@"
  elif [ -n "$GH_TOKEN" ]; then
    exec bun run dist/main.js start -g "$GH_TOKEN" "$@"
  else
    exec bun run dist/main.js start "$@"
  fi
fi
