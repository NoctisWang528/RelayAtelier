#!/bin/zsh
cd "${0:A:h:h}" || exit 1
if [[ -d release/mac-arm64/'Relay Atelier.app' ]]; then
  open release/mac-arm64/'Relay Atelier.app'
else
  if [[ ! -d node_modules ]]; then npm ci || exit 1; fi
  npm start
fi
