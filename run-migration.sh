#!/bin/bash
# Usage: ./run-migration.sh [PASSWORD]
if [ -z "$1" ]; then
  echo "Usage: ./run-migration.sh [PASSWORD]"
  exit 1
fi

DB_PASSWORD=$1
MIGRATION_FILE="supabase/migrations/20260826170000_consolidated_message_policies.sql"
CONNECTION_STRING="postgresql://postgres:${DB_PASSWORD}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"

echo "Running migration..."
psql "$CONNECTION_STRING" -f "$MIGRATION_FILE"
echo "Migration finished."
