#!/usr/bin/env bash
set -e

# Detect OS
OS="$(uname -s)"

SUBJ="/C=US/ST=Illinois/L=Chicago/O=node-express-session/CN=express-session.local"

if [[ "$OS" == MINGW* || "$OS" == MSYS* ]]; then
  SUBJ=/"/C=US/ST=Illinois/L=Chicago/O=node-express-session/CN=express-session.local"
fi

openssl req -x509 -nodes -newkey rsa:2048 -keyout ./test/fixtures/server.key -out ./test/fixtures/server.crt -days 3650 \
-subj "$SUBJ"
