import fs from 'fs';

const openapi = fs.readFileSync('./src/integrations/supabase/openapi-types.ts', 'utf-8');

const defsStart = openapi.indexOf('export interface definitions {');
if (defsStart === -1) throw new Error('Definitions not found');

const defsBlock = openapi.slice(defsStart);

// We need to parse each block:
//   tableName: {
//      ...
//   };
let tablesMap = {};
let currentTable = null;
let currentBlock = [];

const lines = defsBlock.split('\n');
for (const line of lines) {
  const match = line.match(/^  ([a-zA-Z_0-9]+): \{$/);
  if (match) {
    currentTable = match[1];
    currentBlock = [];
  } else if (currentTable && line.match(/^  \};$/)) {
    tablesMap[currentTable] = currentBlock.join('\n');
    currentTable = null;
  } else if (currentTable) {
    currentBlock.push(line.substring(2)); // unindent 2 spaces
  }
}

let out = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
`;

for (const [table, block] of Object.entries(tablesMap)) {
  out += `      ${table}: {
        Row: {
${block}
        };
        Insert: Partial<{
${block}
        }>;
        Update: Partial<{
${block}
        }>;
        Relationships: [];
      };\n`;
}

out += `    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
    };
    Functions: {
      [key: string]: any;
      join_call: {
        Args: { _call_id: string };
        Returns: void;
      };
    };
    Enums: {
      [key: string]: any;
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
}
`;

fs.writeFileSync('./src/integrations/supabase/types.ts', out);
