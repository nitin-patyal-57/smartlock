#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- Installing frontend dependencies ---"
npm install

echo "--- Building frontend ---"
npm run build

echo "--- Installing server dependencies ---"
cd server
npm install

echo "--- Building TypeScript server ---"
npm run build

echo "--- Copying frontend build into server public directory ---"
mkdir -p public
cp -r ../dist/* public/

echo "--- Build complete! ---"
