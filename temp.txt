export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      attendance: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          attendance_date: string;
          checked_in_at: string;
          status: string;
          note: string | null;
          created_at: string;
          checked_out_at: string | null;
          break_started_at: string | null;
          total_break_minutes: number;
          is_late: boolean;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          attendance_date: string;
          checked_in_at: string;
          status: string;
          note?: string | null;
          created_at?: string;
          checked_out_at?: string | null;
          break_started_at?: string | null;
          total_break_minutes?: number;
          is_late?: boolean;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          attendance_date?: string;
          checked_in_at?: string;
          status?: string;
          note?: string | null;
          created_at?: string;
          checked_out_at?: string | null;
          break_started_at?: string | null;
          total_break_minutes?: number;
          is_late?: boolean;
        };
      };
      call_participants: {
        Row: {
          id: string;
          call_id: string;
          user_id: string;
          state: string;
          joined_at: string | null;
          left_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_id: string;
          user_id: string;
          state: string;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          call_id?: string;
          user_id?: string;
          state?: string;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
        };
      };
      call_signals: {
        Row: {
          id: string;
          call_id: string;
          from_uid: string;
          to_uid: string | null;
          signal_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_id: string;
          from_uid: string;
          to_uid?: string | null;
          signal_type: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          call_id?: string;
          from_uid?: string;
          to_uid?: string | null;
          signal_type?: string;
          payload?: Json;
          created_at?: string;
        };
      };
      calls: {
        Row: {
          id: string;
          org_id: string;
          initiator_id: string;
          started_at: string;
          ended_at: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          initiator_id: string;
          started_at: string;
          ended_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          initiator_id?: string;
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      channels: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          kind: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          kind: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          kind?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
      };
      direct_threads: {
        Row: {
          id: string;
          org_id: string;
          channel_id: string;
          user_a: string;
          user_b: string;
          last_message_at: string;
          created_at: string;
          archived_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          channel_id: string;
          user_a: string;
          user_b: string;
          last_message_at?: string;
          created_at?: string;
          archived_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          channel_id?: string;
          user_a?: string;
          user_b?: string;
          last_message_at?: string;
          created_at?: string;
          archived_at?: string | null;
          deleted_at?: string | null;
        };
      };
      group_members: {
        Row: { id: string; group_id: string; user_id: string; role: string; joined_at: string };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
      };
      groups: {
        Row: { id: string; name: string; code: string; created_by: string; created_at: string };
        Insert: {
          id?: string;
          name: string;
          code: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      leave_requests: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          type: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          status: string;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          type: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          status: string;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          type?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          status?: string;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          org_id: string;
          uploader_id: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          kind: string;
          filename: string;
          duration_ms: number | null;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          org_id: string;
          uploader_id: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          kind: string;
          filename: string;
          duration_ms?: number | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          org_id?: string;
          uploader_id?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          kind?: string;
          filename?: string;
          duration_ms?: number | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
      };
      message_reactions: {
        Row: { id: string; message_id: string; user_id: string; emoji: string; created_at: string };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
      };
      message_reads: {
        Row: { user_id: string; channel_id: string; last_read_at: string };
        Insert: { user_id: string; channel_id: string; last_read_at?: string };
        Update: { user_id?: string; channel_id?: string; last_read_at?: string };
      };
      messages: {
        Row: {
          id: string;
          org_id: string;
          channel_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          is_archived: boolean | null;
          status: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          channel_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          is_archived?: boolean | null;
          status?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          channel_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          is_archived?: boolean | null;
          status?: string | null;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          org_type: string;
          access_code: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          day_start_cutoff: string;
          timezone: string;
          logo_url: string | null;
          accent_color: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          org_type: string;
          access_code: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          day_start_cutoff: string;
          timezone: string;
          logo_url?: string | null;
          accent_color?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          org_type?: string;
          access_code?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          day_start_cutoff?: string;
          timezone?: string;
          logo_url?: string | null;
          accent_color?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          position: string | null;
          category: string | null;
          org_id: string | null;
          created_at: string;
          updated_at: string;
          role: string | null;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          position?: string | null;
          category?: string | null;
          org_id?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          position?: string | null;
          category?: string | null;
          org_id?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string | null;
          avatar_url?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          org_id: string;
          title: string;
          details: string | null;
          assignee_id: string | null;
          assigned_by: string;
          status: string;
          priority: string;
          due_date: string | null;
          created_at: string;
          assigned_to: string | null;
          start_date: string | null;
          category: string | null;
          description: string | null;
          task_kind: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          title: string;
          details?: string | null;
          assignee_id?: string | null;
          assigned_by: string;
          status?: string;
          priority?: string;
          due_date?: string | null;
          created_at?: string;
          assigned_to?: string | null;
          start_date?: string | null;
          category?: string | null;
          description?: string | null;
          task_kind?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          title?: string;
          details?: string | null;
          assignee_id?: string | null;
          assigned_by?: string;
          status?: string;
          priority?: string;
          due_date?: string | null;
          created_at?: string;
          assigned_to?: string | null;
          start_date?: string | null;
          category?: string | null;
          description?: string | null;
          task_kind?: string | null;
        };
      };
    };
  };
}
