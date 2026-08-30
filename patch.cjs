const fs = require('fs');
let content = fs.readFileSync('src/types/schema.types.ts', 'utf8');

const functionsCode = `
    Views: {
      [_ in never]: never;
    };
    Functions: {
      invite_preview: {
        Args: { _token: string };
        Returns: any;
      };
      join_workspace: {
        Args: { _code: string; _category: string };
        Returns: any;
      };
      create_workspace: {
        Args: { _name: string; _org_type: string };
        Returns: any;
      };
      decide_leave: {
        Args: { _id: string; _approved: boolean };
        Returns: any;
      };
      join_call: {
        Args: { _call_id: string };
        Returns: any;
      };
      set_user_role: {
        Args: { _user: string; _role: "admin" | "member" };
        Returns: any;
      };
      remove_user: {
        Args: { _user: string };
        Returns: any;
      };
      update_org_settings: {
        Args: { _name: string; _org_type: string; _cutoff: string; _tz: string };
        Returns: any;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
`;

const lastTablesClose = content.lastIndexOf("};", content.lastIndexOf("};") - 10);
// Wait, the structure is:
// export interface Database {
//   public: {
//     Tables: {
//        ...
//     };  <--- I want to insert here
//   };
// }
// Let's just do a regex replace to insert after `Tables: { ... }` closing.
// Actually, I can just replace the very last `  };\n}` with `  };\n` + functionsCode + `\n}\n`;
content = content.replace(/  };\n}/g, "  };\n" + functionsCode + "}");
fs.writeFileSync('src/types/schema.types.ts', content);
