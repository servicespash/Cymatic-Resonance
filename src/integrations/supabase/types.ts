export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string;
          break_started_at: string | null;
          checked_in_at: string;
          checked_out_at: string | null;
          created_at: string;
          id: string;
          is_late: boolean;
          note: string | null;
          org_id: string;
          status: string;
          total_break_minutes: number;
          user_id: string;
        };
        Insert: {
          attendance_date?: string;
          break_started_at?: string | null;
          checked_in_at?: string;
          checked_out_at?: string | null;
          created_at?: string;
          id?: string;
          is_late?: boolean;
          note?: string | null;
          org_id: string;
          status?: string;
          total_break_minutes?: number;
          user_id: string;
        };
        Update: {
          attendance_date?: string;
          break_started_at?: string | null;
          checked_in_at?: string;
          checked_out_at?: string | null;
          created_at?: string;
          id?: string;
          is_late?: boolean;
          note?: string | null;
          org_id?: string;
          status?: string;
          total_break_minutes?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      call_participants: {
        Row: {
          call_id: string;
          created_at: string;
          id: string;
          joined_at: string | null;
          left_at: string | null;
          state: Database["public"]["Enums"]["participant_state"];
          user_id: string;
        };
        Insert: {
          call_id: string;
          created_at?: string;
          id?: string;
          joined_at?: string | null;
          left_at?: string | null;
          state?: Database["public"]["Enums"]["participant_state"];
          user_id: string;
        };
        Update: {
          call_id?: string;
          created_at?: string;
          id?: string;
          joined_at?: string | null;
          left_at?: string | null;
          state?: Database["public"]["Enums"]["participant_state"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      calls: {
        Row: {
          channel_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          initiator_id: string;
          kind: Database["public"]["Enums"]["call_kind"];
          org_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["call_status"];
        };
        Insert: {
          channel_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          initiator_id: string;
          kind?: Database["public"]["Enums"]["call_kind"];
          org_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
        };
        Update: {
          channel_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          initiator_id?: string;
          kind?: Database["public"]["Enums"]["call_kind"];
          org_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
        };
        Relationships: [
          {
            foreignKeyName: "calls_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          kind: Database["public"]["Enums"]["channel_kind"];
          name: string;
          org_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          kind?: Database["public"]["Enums"]["channel_kind"];
          name: string;
          org_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["channel_kind"];
          name?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      direct_threads: {
        Row: {
          channel_id: string;
          created_at: string;
          id: string;
          last_message_at: string;
          org_id: string;
          user_a: string;
          user_b: string;
        };
        Insert: {
          channel_id: string;
          created_at?: string;
          id?: string;
          last_message_at?: string;
          org_id: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          channel_id?: string;
          created_at?: string;
          id?: string;
          last_message_at?: string;
          org_id?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "direct_threads_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          end_date: string;
          id: string;
          org_id: string;
          reason: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["leave_status"];
          type: Database["public"]["Enums"]["leave_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          end_date: string;
          id?: string;
          org_id: string;
          reason?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["leave_status"];
          type?: Database["public"]["Enums"]["leave_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          end_date?: string;
          id?: string;
          org_id?: string;
          reason?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["leave_status"];
          type?: Database["public"]["Enums"]["leave_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          filename: string;
          height: number | null;
          id: string;
          kind: string;
          message_id: string;
          mime_type: string;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          uploader_id: string;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          filename: string;
          height?: number | null;
          id?: string;
          kind: string;
          message_id: string;
          mime_type: string;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          uploader_id: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          filename?: string;
          height?: number | null;
          id?: string;
          kind?: string;
          message_id?: string;
          mime_type?: string;
          org_id?: string;
          size_bytes?: number;
          storage_path?: string;
          uploader_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_attachments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reads: {
        Row: {
          channel_id: string;
          last_read_at: string;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          last_read_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          last_read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reads_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          channel_id: string;
          created_at: string;
          id: string;
          org_id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          channel_id: string;
          created_at?: string;
          id?: string;
          org_id: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          channel_id?: string;
          created_at?: string;
          id?: string;
          org_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          category: string | null;
          created_at: string;
          created_by: string;
          email: string;
          expires_at: string;
          id: string;
          org_id: string;
          role: Database["public"]["Enums"]["app_role"];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          category?: string | null;
          created_at?: string;
          created_by: string;
          email: string;
          expires_at?: string;
          id?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          accent_color: string | null;
          access_code: string;
          created_at: string;
          created_by: string;
          day_start_cutoff: string;
          id: string;
          logo_url: string | null;
          name: string;
          org_type: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          accent_color?: string | null;
          access_code: string;
          created_at?: string;
          created_by: string;
          day_start_cutoff?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          org_type?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          accent_color?: string | null;
          access_code?: string;
          created_at?: string;
          created_by?: string;
          day_start_cutoff?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          org_type?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          category: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          org_id: string | null;
          phone: string | null;
          position: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          org_id?: string | null;
          phone?: string | null;
          position?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          org_id?: string | null;
          phone?: string | null;
          position?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: {
        Args: { _token: string };
        Returns: {
          org_id: string;
          org_name: string;
        }[];
      };
      create_invite: {
        Args: {
          _category: string;
          _email: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: {
          accepted_at: string | null;
          accepted_by: string | null;
          category: string | null;
          created_at: string;
          created_by: string;
          email: string;
          expires_at: string;
          id: string;
          org_id: string;
          role: Database["public"]["Enums"]["app_role"];
          token: string;
        };
        SetofOptions: {
          from: "*";
          to: "org_invites";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_org_as_admin: {
        Args: { _name: string; _org_type: string };
        Returns: {
          access_code: string;
          org_id: string;
          org_name: string;
          org_type: string;
        }[];
      };
      current_org_id: { Args: never; Returns: string };
      decide_leave: {
        Args: { _approved: boolean; _id: string };
        Returns: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          end_date: string;
          id: string;
          org_id: string;
          reason: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["leave_status"];
          type: Database["public"]["Enums"]["leave_type"];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "leave_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_org: { Args: never; Returns: undefined };
      gen_cym_code: { Args: never; Returns: string };
      invite_preview: {
        Args: { _token: string };
        Returns: {
          accepted: boolean;
          email: string;
          expires_at: string;
          org_name: string;
        }[];
      };
      is_group_member: {
        Args: { _group_id: string; _user_id: string };
        Returns: boolean;
      };
      is_org_admin: { Args: never; Returns: boolean };
      join_org_with_code: {
        Args: { _category: string; _code: string };
        Returns: {
          org_id: string;
          org_name: string;
        }[];
      };
      open_dm: {
        Args: { _other: string };
        Returns: {
          channel_id: string;
          created_at: string;
          id: string;
          last_message_at: string;
          org_id: string;
          user_a: string;
          user_b: string;
        };
        SetofOptions: {
          from: "*";
          to: "direct_threads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pulse_checkin: {
        Args: { _note?: string };
        Returns: {
          attendance_date: string;
          break_started_at: string | null;
          checked_in_at: string;
          checked_out_at: string | null;
          created_at: string;
          id: string;
          is_late: boolean;
          note: string | null;
          org_id: string;
          status: string;
          total_break_minutes: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pulse_checkout: {
        Args: { _id: string };
        Returns: {
          attendance_date: string;
          break_started_at: string | null;
          checked_in_at: string;
          checked_out_at: string | null;
          created_at: string;
          id: string;
          is_late: boolean;
          note: string | null;
          org_id: string;
          status: string;
          total_break_minutes: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pulse_toggle_break: {
        Args: { _id: string };
        Returns: {
          attendance_date: string;
          break_started_at: string | null;
          checked_in_at: string;
          checked_out_at: string | null;
          created_at: string;
          id: string;
          is_late: boolean;
          note: string | null;
          org_id: string;
          status: string;
          total_break_minutes: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_member: { Args: { _user: string }; Returns: undefined };
      request_leave: {
        Args: {
          _end: string;
          _reason: string;
          _start: string;
          _type: Database["public"]["Enums"]["leave_type"];
        };
        Returns: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          end_date: string;
          id: string;
          org_id: string;
          reason: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["leave_status"];
          type: Database["public"]["Enums"]["leave_type"];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "leave_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revoke_invite: { Args: { _id: string }; Returns: undefined };
      rotate_access_code: { Args: never; Returns: string };
      set_member_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string };
        Returns: undefined;
      };
      toggle_reaction: {
        Args: { _emoji: string; _message: string };
        Returns: boolean;
      };
      update_org_brand: {
        Args: { _accent_color: string; _logo_url: string };
        Returns: {
          accent_color: string | null;
          access_code: string;
          created_at: string;
          created_by: string;
          day_start_cutoff: string;
          id: string;
          logo_url: string | null;
          name: string;
          org_type: string;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_org_settings: {
        Args: { _cutoff: string; _name: string; _org_type: string; _tz: string };
        Returns: {
          accent_color: string | null;
          access_code: string;
          created_at: string;
          created_by: string;
          day_start_cutoff: string;
          id: string;
          logo_url: string | null;
          name: string;
          org_type: string;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "admin" | "member";
      call_kind: "audio" | "video";
      call_status: "ringing" | "active" | "ended" | "missed" | "declined";
      channel_kind: "broadcast" | "dm";
      leave_status: "pending" | "approved" | "denied";
      leave_type: "sick" | "vacation" | "personal" | "other";
      participant_state: "invited" | "joined" | "declined" | "left";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
      call_kind: ["audio", "video"],
      call_status: ["ringing", "active", "ended", "missed", "declined"],
      channel_kind: ["broadcast", "dm"],
      leave_status: ["pending", "approved", "denied"],
      leave_type: ["sick", "vacation", "personal", "other"],
      participant_state: ["invited", "joined", "declined", "left"],
    },
  },
} as const;
