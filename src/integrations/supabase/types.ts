export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      self_rush_sessions: {
        Row: {
          id: string;
          profile_id: string;
          org_id: string;
          session_nonce: string;
          expires_at: string;
          is_used: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          org_id: string;
          session_nonce: string;
          expires_at: string;
          is_used?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          org_id?: string;
          session_nonce?: string;
          expires_at?: string;
          is_used?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "self_rush_sessions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "self_rush_sessions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /** Format: text */
          code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /** Format: text */
          code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /** Format: text */
          code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
      direct_threads: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: uuid */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          user_a: string;
          /** Format: uuid */
          user_b: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_message_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: uuid */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          user_a: string;
          /** Format: uuid */
          user_b: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_message_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: uuid */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          user_a: string;
          /** Format: uuid */
          user_b: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_message_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        }>;
        Relationships: [];
      };
      call_participants: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.participant_state
           * @default invited
           * @enum {string}
           */
          state: "invited" | "joined" | "declined" | "left";
          /** Format: timestamp with time zone */
          joined_at?: string;
          /** Format: timestamp with time zone */
          left_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.participant_state
           * @default invited
           * @enum {string}
           */
          state: "invited" | "joined" | "declined" | "left";
          /** Format: timestamp with time zone */
          joined_at?: string;
          /** Format: timestamp with time zone */
          left_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.participant_state
           * @default invited
           * @enum {string}
           */
          state: "invited" | "joined" | "declined" | "left";
          /** Format: timestamp with time zone */
          joined_at?: string;
          /** Format: timestamp with time zone */
          left_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
      calls: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          initiator_id: string;
          /**
           * Format: public.call_kind
           * @default audio
           * @enum {string}
           */
          kind: "audio" | "video";
          /**
           * Format: public.call_status
           * @default ringing
           * @enum {string}
           */
          status: "ringing" | "active" | "ended" | "missed" | "declined";
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          started_at: string;
          /** Format: timestamp with time zone */
          ended_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: jsonb */
          metadata?: unknown;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          initiator_id: string;
          /**
           * Format: public.call_kind
           * @default audio
           * @enum {string}
           */
          kind: "audio" | "video";
          /**
           * Format: public.call_status
           * @default ringing
           * @enum {string}
           */
          status: "ringing" | "active" | "ended" | "missed" | "declined";
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          started_at: string;
          /** Format: timestamp with time zone */
          ended_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: jsonb */
          metadata?: unknown;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          initiator_id: string;
          /**
           * Format: public.call_kind
           * @default audio
           * @enum {string}
           */
          kind: "audio" | "video";
          /**
           * Format: public.call_status
           * @default ringing
           * @enum {string}
           */
          status: "ringing" | "active" | "ended" | "missed" | "declined";
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          started_at: string;
          /** Format: timestamp with time zone */
          ended_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: jsonb */
          metadata?: unknown;
        }>;
        Relationships: [];
      };
      download_history: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          format: string;
          /** Format: date */
          data_range_start?: string;
          /** Format: date */
          data_range_end?: string;
          /** Format: integer */
          row_count?: number;
          /** Format: text */
          scope?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          format: string;
          /** Format: date */
          data_range_start?: string;
          /** Format: date */
          data_range_end?: string;
          /** Format: integer */
          row_count?: number;
          /** Format: text */
          scope?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          format: string;
          /** Format: date */
          data_range_start?: string;
          /** Format: date */
          data_range_end?: string;
          /** Format: integer */
          row_count?: number;
          /** Format: text */
          scope?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
      tasks: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          title: string;
          /** Format: text */
          details?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assignee_id?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assigned_by: string;
          /**
           * Format: text
           * @default open
           */
          status: string;
          /**
           * Format: text
           * @default normal
           */
          priority: string;
          /** Format: timestamp with time zone */
          due_date?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: uuid */
          assigned_to?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          start_date?: string;
          /**
           * Format: text
           * @default General
           */
          category?: string;
          /** Format: text */
          description?: string;
          /**
           * Format: text
           * @default general
           */
          task_kind?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          title: string;
          /** Format: text */
          details?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assignee_id?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assigned_by: string;
          /**
           * Format: text
           * @default open
           */
          status: string;
          /**
           * Format: text
           * @default normal
           */
          priority: string;
          /** Format: timestamp with time zone */
          due_date?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: uuid */
          assigned_to?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          start_date?: string;
          /**
           * Format: text
           * @default General
           */
          category?: string;
          /** Format: text */
          description?: string;
          /**
           * Format: text
           * @default general
           */
          task_kind?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          title: string;
          /** Format: text */
          details?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assignee_id?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
           */
          assigned_by: string;
          /**
           * Format: text
           * @default open
           */
          status: string;
          /**
           * Format: text
           * @default normal
           */
          priority: string;
          /** Format: timestamp with time zone */
          due_date?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: uuid */
          assigned_to?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          start_date?: string;
          /**
           * Format: text
           * @default General
           */
          category?: string;
          /** Format: text */
          description?: string;
          /**
           * Format: text
           * @default general
           */
          task_kind?: string;
        }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default auth.uid()
           */
          id: string;
          /** Format: text */
          full_name?: string;
          /** Format: text */
          phone?: string;
          /** Format: text */
          position?: string;
          /** Format: text */
          category?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: text
           * @default member
           */
          role?: string;
          /** Format: text */
          avatar_url?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default auth.uid()
           */
          id: string;
          /** Format: text */
          full_name?: string;
          /** Format: text */
          phone?: string;
          /** Format: text */
          position?: string;
          /** Format: text */
          category?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: text
           * @default member
           */
          role?: string;
          /** Format: text */
          avatar_url?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default auth.uid()
           */
          id: string;
          /** Format: text */
          full_name?: string;
          /** Format: text */
          phone?: string;
          /** Format: text */
          position?: string;
          /** Format: text */
          category?: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: text
           * @default member
           */
          role?: string;
          /** Format: text */
          avatar_url?: string;
        }>;
        Relationships: [];
      };
      org_invites: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          email: string;
          /**
           * Format: text
           * @default encode(extensions.gen_random_bytes(18), 'hex'::text)
           */
          token: string;
          /** Format: text */
          category?: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default (now() + '14 days'::interval)
           */
          expires_at: string;
          /** Format: timestamp with time zone */
          accepted_at?: string;
          /** Format: uuid */
          accepted_by?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          email: string;
          /**
           * Format: text
           * @default encode(extensions.gen_random_bytes(18), 'hex'::text)
           */
          token: string;
          /** Format: text */
          category?: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default (now() + '14 days'::interval)
           */
          expires_at: string;
          /** Format: timestamp with time zone */
          accepted_at?: string;
          /** Format: uuid */
          accepted_by?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          email: string;
          /**
           * Format: text
           * @default encode(extensions.gen_random_bytes(18), 'hex'::text)
           */
          token: string;
          /** Format: text */
          category?: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default (now() + '14 days'::interval)
           */
          expires_at: string;
          /** Format: timestamp with time zone */
          accepted_at?: string;
          /** Format: uuid */
          accepted_by?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.leave_type
           * @default vacation
           * @enum {string}
           */
          type: "sick" | "vacation" | "personal" | "other";
          /** Format: date */
          start_date: string;
          /** Format: date */
          end_date: string;
          /** Format: text */
          reason?: string;
          /**
           * Format: public.leave_status
           * @default pending
           * @enum {string}
           */
          status: "pending" | "approved" | "denied";
          /** Format: uuid */
          decided_by?: string;
          /** Format: timestamp with time zone */
          decided_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.leave_type
           * @default vacation
           * @enum {string}
           */
          type: "sick" | "vacation" | "personal" | "other";
          /** Format: date */
          start_date: string;
          /** Format: date */
          end_date: string;
          /** Format: text */
          reason?: string;
          /**
           * Format: public.leave_status
           * @default pending
           * @enum {string}
           */
          status: "pending" | "approved" | "denied";
          /** Format: uuid */
          decided_by?: string;
          /** Format: timestamp with time zone */
          decided_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: public.leave_type
           * @default vacation
           * @enum {string}
           */
          type: "sick" | "vacation" | "personal" | "other";
          /** Format: date */
          start_date: string;
          /** Format: date */
          end_date: string;
          /** Format: text */
          reason?: string;
          /**
           * Format: public.leave_status
           * @default pending
           * @enum {string}
           */
          status: "pending" | "approved" | "denied";
          /** Format: uuid */
          decided_by?: string;
          /** Format: timestamp with time zone */
          decided_at?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
        }>;
        Relationships: [];
      };
      message_reads: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           */
          user_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_read_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           */
          user_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_read_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           */
          user_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          last_read_at: string;
        }>;
        Relationships: [];
      };
      call_signals: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          from_uid: string;
          /** Format: uuid */
          to_uid?: string;
          /** Format: text */
          type: string;
          /** Format: jsonb */
          payload: unknown;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default unknown
           */
          signal_type: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          from_uid: string;
          /** Format: uuid */
          to_uid?: string;
          /** Format: text */
          type: string;
          /** Format: jsonb */
          payload: unknown;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default unknown
           */
          signal_type: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `calls.id`.<fk table='calls' column='id'/>
           */
          call_id: string;
          /** Format: uuid */
          from_uid: string;
          /** Format: uuid */
          to_uid?: string;
          /** Format: text */
          type: string;
          /** Format: jsonb */
          payload: unknown;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default unknown
           */
          signal_type: string;
        }>;
        Relationships: [];
      };
      organizations: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /**
           * Format: text
           * @default generic
           */
          org_type: string;
          /** Format: text */
          access_code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: time without time zone
           * @default 09:00:00
           */
          day_start_cutoff: string;
          /**
           * Format: text
           * @default UTC
           */
          timezone: string;
          /** Format: text */
          logo_url?: string;
          /** Format: text */
          accent_color?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /**
           * Format: text
           * @default generic
           */
          org_type: string;
          /** Format: text */
          access_code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: time without time zone
           * @default 09:00:00
           */
          day_start_cutoff: string;
          /**
           * Format: text
           * @default UTC
           */
          timezone: string;
          /** Format: text */
          logo_url?: string;
          /** Format: text */
          accent_color?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /** Format: text */
          name: string;
          /**
           * Format: text
           * @default generic
           */
          org_type: string;
          /** Format: text */
          access_code: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          updated_at: string;
          /**
           * Format: time without time zone
           * @default 09:00:00
           */
          day_start_cutoff: string;
          /**
           * Format: text
           * @default UTC
           */
          timezone: string;
          /** Format: text */
          logo_url?: string;
          /** Format: text */
          accent_color?: string;
        }>;
        Relationships: [];
      };
      messages: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          sender_id: string;
          /** Format: text */
          body: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
          /**
           * Format: boolean
           * @default false
           */
          is_archived?: boolean;
          /**
           * Format: text
           * @default sent
           */
          status?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          sender_id: string;
          /** Format: text */
          body: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
          /**
           * Format: boolean
           * @default false
           */
          is_archived?: boolean;
          /**
           * Format: text
           * @default sent
           */
          status?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `channels.id`.<fk table='channels' column='id'/>
           */
          channel_id: string;
          /** Format: uuid */
          sender_id: string;
          /** Format: text */
          body: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
          /**
           * Format: boolean
           * @default false
           */
          is_archived?: boolean;
          /**
           * Format: text
           * @default sent
           */
          status?: string;
        }>;
        Relationships: [];
      };
      message_reactions: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          emoji: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          emoji: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /** Format: uuid */
          user_id: string;
          /** Format: text */
          emoji: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
      attendance: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: date
           * @default ((now() AT TIME ZONE 'utc'::text))
           */
          attendance_date: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          checked_in_at: string;
          /**
           * Format: text
           * @default present
           */
          status: string;
          /** Format: text */
          note?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          checked_out_at?: string;
          /** Format: timestamp with time zone */
          break_started_at?: string;
          /**
           * Format: integer
           * @default 0
           */
          total_break_minutes: number;
          /**
           * Format: boolean
           * @default false
           */
          is_late: boolean;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: date
           * @default ((now() AT TIME ZONE 'utc'::text))
           */
          attendance_date: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          checked_in_at: string;
          /**
           * Format: text
           * @default present
           */
          status: string;
          /** Format: text */
          note?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          checked_out_at?: string;
          /** Format: timestamp with time zone */
          break_started_at?: string;
          /**
           * Format: integer
           * @default 0
           */
          total_break_minutes: number;
          /**
           * Format: boolean
           * @default false
           */
          is_late: boolean;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: date
           * @default ((now() AT TIME ZONE 'utc'::text))
           */
          attendance_date: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          checked_in_at: string;
          /**
           * Format: text
           * @default present
           */
          status: string;
          /** Format: text */
          note?: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /** Format: timestamp with time zone */
          checked_out_at?: string;
          /** Format: timestamp with time zone */
          break_started_at?: string;
          /**
           * Format: integer
           * @default 0
           */
          total_break_minutes: number;
          /**
           * Format: boolean
           * @default false
           */
          is_late: boolean;
        }>;
        Relationships: [];
      };
      channels: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          name: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default public
           */
          kind?: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          name: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default public
           */
          kind?: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: text */
          name: string;
          /** Format: uuid */
          created_by: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
          /**
           * Format: text
           * @default public
           */
          kind?: string;
          /** Format: timestamp with time zone */
          archived_at?: string;
          /** Format: timestamp with time zone */
          deleted_at?: string;
        }>;
        Relationships: [];
      };
      group_members: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>
           */
          group_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: text
           * @default member
           */
          role: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          joined_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>
           */
          group_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: text
           * @default member
           */
          role: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          joined_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `groups.id`.<fk table='groups' column='id'/>
           */
          group_id: string;
          /** Format: uuid */
          user_id: string;
          /**
           * Format: text
           * @default member
           */
          role: string;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          joined_at: string;
        }>;
        Relationships: [];
      };
      message_attachments: {
        Row: {
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          uploader_id: string;
          /** Format: text */
          storage_path: string;
          /** Format: text */
          mime_type: string;
          /** Format: bigint */
          size_bytes: number;
          /** Format: text */
          kind: string;
          /** Format: text */
          filename: string;
          /** Format: integer */
          duration_ms?: number;
          /** Format: integer */
          width?: number;
          /** Format: integer */
          height?: number;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        };
        Insert: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          uploader_id: string;
          /** Format: text */
          storage_path: string;
          /** Format: text */
          mime_type: string;
          /** Format: bigint */
          size_bytes: number;
          /** Format: text */
          kind: string;
          /** Format: text */
          filename: string;
          /** Format: integer */
          duration_ms?: number;
          /** Format: integer */
          width?: number;
          /** Format: integer */
          height?: number;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Update: Partial<{
          /**
           * Format: uuid
           * @description Note:
           * This is a Primary Key.<pk/>
           * @default gen_random_uuid()
           */
          id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `messages.id`.<fk table='messages' column='id'/>
           */
          message_id: string;
          /**
           * Format: uuid
           * @description Note:
           * This is a Foreign Key to `organizations.id`.<fk table='organizations' column='id'/>
           */
          org_id: string;
          /** Format: uuid */
          uploader_id: string;
          /** Format: text */
          storage_path: string;
          /** Format: text */
          mime_type: string;
          /** Format: bigint */
          size_bytes: number;
          /** Format: text */
          kind: string;
          /** Format: text */
          filename: string;
          /** Format: integer */
          duration_ms?: number;
          /** Format: integer */
          width?: number;
          /** Format: integer */
          height?: number;
          /**
           * Format: timestamp with time zone
           * @default now()
           */
          created_at: string;
        }>;
        Relationships: [];
      };
    };
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
