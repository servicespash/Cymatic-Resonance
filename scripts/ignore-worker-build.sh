#!/usr/bin/env bash
# This script can be set as the "Ignored build step" in Cloudflare Dashboard
# under Workers Builds -> Settings -> Builds -> Ignored build step.
# Returning exit code 0 tells Cloudflare Workers to skip the build.
echo "[Cloudflare Workers] Worker deployment is disabled. Only Cloudflare Pages is deployed."
exit 0
