#!/bin/sh
set -e
set -x

MODE=${1:-production}
mkdir -p ./dist
rm -rf ./dist/*
npx webpack --mode=$MODE
cp ./extra/* ./dist/
