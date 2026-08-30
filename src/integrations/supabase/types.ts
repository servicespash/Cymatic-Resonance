export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// We use any here to prevent TS from collapsing missing relational joins to 'never'
// when running in environments without the full pg_meta schema.
export type Database = any;
