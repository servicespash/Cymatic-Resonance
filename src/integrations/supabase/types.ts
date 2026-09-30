export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      payment_intents: {
        Row: {
          id: string;
          organization_id: string;
          provider: string;
          transaction_reference: string;
          feature_key: string;
          target_plan: string;
          currency: string;
          amount_minor: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider: string;
          transaction_reference: string;
          feature_key: string;
          target_plan: string;
          currency: string;
          amount_minor: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          provider?: string;
          transaction_reference?: string;
          feature_key?: string;
          target_plan?: string;
          currency?: string;
          amount_minor?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      },
      revenue_ledger: {
        Row: {
          id: string;
          organization_id: string;
          provider: string;
          provider_reference: string;
          transaction_reference: string;
          currency: string;
          gross_amount_minor: number;
          provider_fee_minor: number;
          infrastructure_reserve_minor: number;
          net_revenue_minor: number;
          target_plan: string;
          feature_key: string;
          status: string;
          metadata: Json;
          created_at: string;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider: string;
          provider_reference: string;
          transaction_reference: string;
          currency: string;
          gross_amount_minor: number;
          provider_fee_minor?: number;
          infrastructure_reserve_minor?: number;
          net_revenue_minor?: number;
          target_plan: string;
          feature_key: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          settled_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          provider?: string;
          provider_reference?: string;
          transaction_reference?: string;
          currency?: string;
          gross_amount_minor?: number;
          provider_fee_minor?: number;
          infrastructure_reserve_minor?: number;
          net_revenue_minor?: number;
          target_plan?: string;
          feature_key?: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          settled_at?: string | null;
        };
        Relationships: [];
      },
      service_controls: {
        Row: {
          id: string;
          organization_id: string;
          feature_key: string;
          status: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          feature_key: string;
          status: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          feature_key?: string;
          status?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      },
      system_usage_metrics: {
        Row: {
          id: string;
          organization_id: string | null;
          metric_key: string;
          metric_value: number;
          unit: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          metric_key: string;
          metric_value: number;
          unit: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          metric_key?: string;
          metric_value?: number;
          unit?: string;
          recorded_at?: string;
        };
        Relationships: [];
      },
      attendance: {
        Row: {
          attendance_date: string
          break_started_at: string | null
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          distance_variance_meters: number | null
          id: string
          ip_hash: string | null
          is_late: boolean
          latitude: number | null
          location_status: string | null
          longitude: number | null
          note: string | null
          org_id: string
          session_source: string | null
          status: string
          total_break_minutes: number
          user_id: string
        }
        Insert: {
          attendance_date?: string
          break_started_at?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          distance_variance_meters?: number | null
          id?: string
          ip_hash?: string | null
          is_late?: boolean
          latitude?: number | null
          location_status?: string | null
          longitude?: number | null
          note?: string | null
          org_id: string
          session_source?: string | null
          status?: string
          total_break_minutes?: number
          user_id: string
        }
        Update: {
          attendance_date?: string
          break_started_at?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          distance_variance_meters?: number | null
          id?: string
          ip_hash?: string | null
          is_late?: boolean
          latitude?: number | null
          location_status?: string | null
          longitude?: number | null
          note?: string | null
          org_id?: string
          session_source?: string | null
          status?: string
          total_break_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string
          server_recorded_at: string
          session_id: string
          source: string
          type: string
          user_id: string
        }
        Insert: {
          id?: string
          metadata?: Json
          occurred_at: string
          organization_id: string
          server_recorded_at?: string
          session_id: string
          source: string
          type: string
          user_id: string
        }
        Update: {
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          server_recorded_at?: string
          session_id?: string
          source?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          accuracy_meters: number
          created_at: string
          created_by: string
          ends_at: string
          grace_seconds: number
          id: string
          latitude: number
          longitude: number
          name: string
          organization_id: string
          radius_meters: number
          starts_at: string
          state: string
          tracking_required: boolean
          updated_at: string
        }
        Insert: {
          accuracy_meters: number
          created_at?: string
          created_by: string
          ends_at: string
          grace_seconds?: number
          id?: string
          latitude: number
          longitude: number
          name: string
          organization_id: string
          radius_meters: number
          starts_at: string
          state?: string
          tracking_required?: boolean
          updated_at?: string
        }
        Update: {
          accuracy_meters?: number
          created_at?: string
          created_by?: string
          ends_at?: string
          grace_seconds?: number
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          organization_id?: string
          radius_meters?: number
          starts_at?: string
          state?: string
          tracking_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          state: Database["public"]["Enums"]["participant_state"]
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: Database["public"]["Enums"]["participant_state"]
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          state?: Database["public"]["Enums"]["participant_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_uid: string
          id: string
          payload: Json
          signal_type: string
          to_uid: string | null
          type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_uid: string
          id?: string
          payload: Json
          signal_type?: string
          to_uid?: string | null
          type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_uid?: string
          id?: string
          payload?: Json
          signal_type?: string
          to_uid?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          channel_id: string
          created_at: string
          ended_at: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          metadata: Json | null
          org_id: string
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          channel_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          initiator_id: string
          kind?: Database["public"]["Enums"]["call_kind"]
          metadata?: Json | null
          org_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          channel_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          initiator_id?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          metadata?: Json | null
          org_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          kind: string | null
          name: string
          org_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          kind?: string | null
          name: string
          org_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          kind?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          last_seen_at: string | null
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_threads: {
        Row: {
          archived_at: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          org_id: string
          user_a: string
          user_b: string
        }
        Insert: {
          archived_at?: string | null
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          org_id: string
          user_a: string
          user_b: string
        }
        Update: {
          archived_at?: string | null
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          org_id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      download_history: {
        Row: {
          created_at: string
          data_range_end: string | null
          data_range_start: string | null
          format: string
          id: string
          org_id: string
          row_count: number | null
          scope: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_range_end?: string | null
          data_range_start?: string | null
          format: string
          id?: string
          org_id: string
          row_count?: number | null
          scope?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_range_end?: string | null
          data_range_start?: string | null
          format?: string
          id?: string
          org_id?: string
          row_count?: number | null
          scope?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          feature: string
          id: string
          limit_value: number | null
          organization_id: string
          plan: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          limit_value?: number | null
          organization_id: string
          plan: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          limit_value?: number | null
          organization_id?: string
          plan?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_upgrade_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          organization_id: string
          requested_by: string
          requested_plan: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id: string
          requested_by: string
          requested_plan: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          requested_by?: string
          requested_plan?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_upgrade_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          end_date: string
          id: string
          org_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_date: string
          id?: string
          org_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_date?: string
          id?: string
          org_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_evidence: {
        Row: {
          accuracy_meters: number
          captured_at: string
          created_at: string
          distance_meters: number
          id: string
          is_inside_geofence: boolean
          latitude: number
          longitude: number
          metadata: Json
          organization_id: string
          quality: string
          session_id: string
          source: string
          user_id: string
        }
        Insert: {
          accuracy_meters: number
          captured_at: string
          created_at?: string
          distance_meters: number
          id?: string
          is_inside_geofence: boolean
          latitude: number
          longitude: number
          metadata?: Json
          organization_id: string
          quality: string
          session_id: string
          source?: string
          user_id: string
        }
        Update: {
          accuracy_meters?: number
          captured_at?: string
          created_at?: string
          distance_meters?: number
          id?: string
          is_inside_geofence?: boolean
          latitude?: number
          longitude?: number
          metadata?: Json
          organization_id?: string
          quality?: string
          session_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_evidence_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          livekit_room_name: string
          organization_id: string
          room_id: string
          started_at: string | null
          state: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          livekit_room_name: string
          organization_id: string
          room_id: string
          started_at?: string | null
          state?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          livekit_room_name?: string
          organization_id?: string
          room_id?: string
          started_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          duration_ms: number | null
          filename: string
          height: number | null
          id: string
          kind: string
          message_id: string
          mime_type: string
          org_id: string
          size_bytes: number
          storage_path: string
          uploader_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          filename: string
          height?: number | null
          id?: string
          kind: string
          message_id: string
          mime_type: string
          org_id: string
          size_bytes: number
          storage_path: string
          uploader_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          filename?: string
          height?: number | null
          id?: string
          kind?: string
          message_id?: string
          mime_type?: string
          org_id?: string
          size_bytes?: number
          storage_path?: string
          uploader_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean | null
          org_id: string
          sender_id: string
          status: string | null
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean | null
          org_id: string
          sender_id: string
          status?: string | null
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean | null
          org_id?: string
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          category: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          org_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          org_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          access_code: string
          created_at: string
          created_by: string
          day_start_cutoff: string
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          org_type: string
          plan: string
          radius_meters: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          access_code: string
          created_at?: string
          created_by: string
          day_start_cutoff?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          org_type?: string
          plan?: string
          radius_meters?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          access_code?: string
          created_at?: string
          created_by?: string
          day_start_cutoff?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          org_type?: string
          plan?: string
          radius_meters?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          category: string | null
          created_at: string
          full_name: string | null
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          org_id: string | null
          phone: string | null
          position: string | null
          role: string | null
          self_rush_token_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          org_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          self_rush_token_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          org_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          self_rush_token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          active: boolean
          joined_at: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          joined_at?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          joined_at?: string
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      self_rush_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_used: boolean | null
          org_id: string
          profile_id: string
          session_nonce: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_used?: boolean | null
          org_id: string
          profile_id: string
          session_nonce: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean | null
          org_id?: string
          profile_id?: string
          session_nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_rush_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_rush_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          created_at: string | null
          id: string
          status: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          file_name: string
          file_type: string
          file_url: string
          id: string
          task_id: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_type: string
          file_url: string
          id?: string
          task_id: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string | null
          assignee_id: string | null
          category: string | null
          created_at: string
          description: string | null
          details: string | null
          due_date: string | null
          id: string
          org_id: string
          priority: string
          start_date: string | null
          status: string
          task_kind: string | null
          task_notes: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          org_id: string
          priority?: string
          start_date?: string | null
          status?: string
          task_kind?: string | null
          task_notes?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          org_id?: string
          priority?: string
          start_date?: string | null
          status?: string
          task_kind?: string | null
          task_notes?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          email_notifications: boolean
          pulse_alerts: boolean
          task_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_notifications?: boolean
          pulse_alerts?: boolean
          task_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_notifications?: boolean
          pulse_alerts?: boolean
          task_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { _token: string }
        Returns: {
          org_id: string
          org_name: string
        }[]
      }
      create_invite: {
        Args: {
          _category: string
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          category: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          org_id: string
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "org_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_org_as_admin: {
        Args: { _name: string; _org_type: string }
        Returns: {
          access_code: string
          org_id: string
          org_name: string
          org_type: string
        }[]
      }
      current_org_id: { Args: never; Returns: string }
      resolve_entitlement_upgrade_request: {
        Args: { _approved: boolean; _request_id: string }
        Returns: {
          accent_color: string | null
          access_code: string
          created_at: string
          created_by: string
          day_start_cutoff: string
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          org_type: string
          plan: string
          radius_meters: number | null
          timezone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_leave: {
        Args: { _approved: boolean; _id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          end_date: string
          id: string
          org_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_org: { Args: never; Returns: undefined }
      execute_master_pulse: {
        Args: {
          p_access_code: string
          p_ip_hash: string
          p_lat: number
          p_location_accepted: boolean
          p_long: number
          p_note?: string
          p_session_nonce: string
        }
        Returns: Json
      }
      gen_cym_code: { Args: never; Returns: string }
      get_dm_messages_v2: {
        Args: { p_thread_id: string }
        Returns: {
          body: string
          created_at: string
          is_archived: boolean
          message_id: string
          sender_avatar: string
          sender_id: string
          sender_name: string
          status: string
          thread_id: string
        }[]
      }
      get_dm_threads_v2: {
        Args: never
        Returns: {
          archived_at: string
          created_at: string
          last_message_at: string
          thread_id: string
          user_a: string
          user_a_avatar: string
          user_a_name: string
          user_b: string
          user_b_avatar: string
          user_b_name: string
        }[]
      }
      get_unread_counts: {
        Args: { _user_id: string }
        Returns: {
          channel_id: string
          unread_count: number
        }[]
      }
      invite_preview: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          email: string
          expires_at: string
          org_name: string
        }[]
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: { Args: never; Returns: boolean }
      join_call:
        | { Args: { _call_id: string }; Returns: undefined }
        | {
            Args: { _call_id: string; _device_info?: string }
            Returns: {
              call_id: string
              created_at: string
              id: string
              joined_at: string | null
              left_at: string | null
              state: Database["public"]["Enums"]["participant_state"]
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "call_participants"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      join_org_with_code: {
        Args: { _category: string; _code: string }
        Returns: {
          org_id: string
          org_name: string
        }[]
      }
      leave_call: { Args: { _call_id: string }; Returns: undefined }
      lookup_org_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
          org_type: string
        }[]
      }
      mark_channel_as_read: {
        Args: { _channel_id: string; _user_id: string }
        Returns: undefined
      }
      open_dm: {
        Args: { _other: string }
        Returns: {
          archived_at: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          org_id: string
          user_a: string
          user_b: string
        }
        SetofOptions: {
          from: "*"
          to: "direct_threads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_verified_payment: {
        Args: {
          p_organization_id: string;
          p_provider: string;
          p_provider_reference: string;
          p_transaction_reference: string;
          p_currency: string;
          p_gross_amount_minor: number;
          p_provider_fee_minor: number;
          p_infrastructure_reserve_minor: number;
          p_net_revenue_minor: number;
          p_target_plan: string;
          p_feature_key: string;
        };
        Returns: string;
      },
      pulse_checkin: {
        Args: { _note?: string }
        Returns: {
          attendance_date: string
          break_started_at: string | null
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          distance_variance_meters: number | null
          id: string
          ip_hash: string | null
          is_late: boolean
          latitude: number | null
          location_status: string | null
          longitude: number | null
          note: string | null
          org_id: string
          session_source: string | null
          status: string
          total_break_minutes: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pulse_checkout: {
        Args: { _id: string }
        Returns: {
          attendance_date: string
          break_started_at: string | null
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          distance_variance_meters: number | null
          id: string
          ip_hash: string | null
          is_late: boolean
          latitude: number | null
          location_status: string | null
          longitude: number | null
          note: string | null
          org_id: string
          session_source: string | null
          status: string
          total_break_minutes: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pulse_toggle_break: {
        Args: { _id: string }
        Returns: {
          attendance_date: string
          break_started_at: string | null
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          distance_variance_meters: number | null
          id: string
          ip_hash: string | null
          is_late: boolean
          latitude: number | null
          location_status: string | null
          longitude: number | null
          note: string | null
          org_id: string
          session_source: string | null
          status: string
          total_break_minutes: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_member: { Args: { _user: string }; Returns: undefined }
      request_leave: {
        Args: {
          _end: string
          _reason: string
          _start: string
          _type: Database["public"]["Enums"]["leave_type"]
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          end_date: string
          id: string
          org_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invite: { Args: { _id: string }; Returns: undefined }
      rotate_access_code: { Args: never; Returns: string }
      set_member_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: undefined
      }
      toggle_reaction: {
        Args: { _emoji: string; _message: string }
        Returns: boolean
      }
      update_org_brand: {
        Args: { _accent_color: string; _logo_url: string }
        Returns: {
          accent_color: string | null
          access_code: string
          created_at: string
          created_by: string
          day_start_cutoff: string
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          org_type: string
          radius_meters: number | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_org_settings: {
        Args: { _cutoff: string; _name: string; _org_type: string; _tz: string }
        Returns: {
          accent_color: string | null
          access_code: string
          created_at: string
          created_by: string
          day_start_cutoff: string
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          org_type: string
          radius_meters: number | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "member"
      call_kind: "audio" | "video"
      call_status: "ringing" | "active" | "ended" | "missed" | "declined"
      channel_kind: "broadcast" | "dm"
      leave_status: "pending" | "approved" | "denied"
      leave_type: "sick" | "vacation" | "personal" | "other"
      participant_state: "invited" | "joined" | "declined" | "left"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

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
} as const

