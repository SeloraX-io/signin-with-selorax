#!/bin/bash
# Publish script that ensures README is included in npm package metadata.
# npm's browser-based 2FA flow drops the readme field. This script injects it.
#
# Usage: ./publish.sh

set -e

cd "$(dirname "$0")"

echo "Injecting README into package.json..."

# Backup original package.json
cp package.json package.json.bak

# Inject readme content into package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.readme = fs.readFileSync('README.md', 'utf8');
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "Publishing..."
npm publish --access public

# Restore original package.json
mv package.json.bak package.json

echo "Done! README should now appear on npm."
