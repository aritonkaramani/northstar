#!/usr/bin/env sh

set -e

yarn run build

cd dist

echo 'www.northstarguild.com' > CNAME

git init
git add -A
git commit -m 'deploy'

git push -f git@github.com:aritonkaramani/northstar.git master:pages

cd -