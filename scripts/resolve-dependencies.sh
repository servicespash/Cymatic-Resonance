#!/bin/bash

# Exit on error
set -e

echo "--- Resolving dependency conflicts ---"

# Remove existing lockfile and node_modules to ensure a clean slate
rm -rf node_modules package-lock.json

# Perform a fresh install to resolve conflicts (ajv, json-schema-traverse)
npm install

# Deduplicate packages to ensure minimal duplication and version parity
npm dedupe

echo "--- Dependencies resolved and synchronized ---"
