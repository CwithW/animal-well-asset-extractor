#!/bin/sh
set -e
set -x

rm -rf ./dist/*
npx webpack
cp ./extra/* ./dist/
