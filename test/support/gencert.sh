#! /bin/sh
set -ex

openssl req -x509 -nodes -newkey rsa:2048 -keyout ./test/fixtures/server.key -out ./test/fixtures/server.crt -days 3650 \
-subj "/C=US/ST=Illinois/L=Chicago/O=node-express-session/CN=express-session.local"
