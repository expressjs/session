#! /bin/sh
set -ex

openssl genpkey -algorithm RSA -out new_server.key -pkeyopt rsa_keygen_bits:2048

openssl x509 -in ./test/fixtures/server.crt -signkey new_server.key -days 3650 -out new_server.crt

openssl x509 -in new_server.crt -text -noout

mv new_server.crt ./test/fixtures/server.crt

mv new_server.key ./test/fixtures/server.key
