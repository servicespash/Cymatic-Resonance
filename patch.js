const fs = require('fs');
let content = fs.readFileSync('src/types/schema.types.ts', 'utf8');

const functionsCode = `
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

content = content.replace("};", "};\n" + functionsCode);
// wait, let's be careful with replace
// The last bit of src/types/schema.types.ts is:
//         };
//       };
//     };
//   };
// }

const patchPoint = content.lastIndexOf("};");
// Actually, it's safer to just replace `    };` that closes `Tables:` with `    };` + functionsCode.
// Let's do it via string replacement of the outer structure.
