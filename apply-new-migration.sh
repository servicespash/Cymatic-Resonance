#!/bin/bash
# Usage: ./apply-new-migration.sh [PASSWORD] [MIGRATION_FILE]
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./apply-new-migration.sh [PASSWORD] [MIGRATION_FILE]"
  exit 1
fi

DB_PASSWORD=$1
MIGRATION_FILE=$2
CONNECTION_STRING="postgresql://postgres.umsgecaeozngdejwvcsu:${DB_PASSWORD}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"

echo "Applying migration: $MIGRATION_FILE"
psql "$CONNECTION_STRING" -f "$MIGRATION_FILE"
echo "Migration finished."
