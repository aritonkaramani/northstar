#!/usr/bin/env sh

set -e

# Build the project
yarn run build

# Navigate to the build output directory
cd dist

# Create a CNAME file for custom domain
echo 'www.northstarguild.com' > CNAME

# Initialize a new git repository
git init

# Switch to a branch before committing (e.g., `main` or `master`)
git checkout -b master

# Add all files and commit
git add -A
git commit -m 'deploy'

# Push to the GitHub pages branch (e.g., `gh-pages` or `pages`)
git push -f git@github.com:aritonkaramani/northstar.git master:pages

# Return to the previous working directory
cd -