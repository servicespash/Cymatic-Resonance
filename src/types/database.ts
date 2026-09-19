export interface ClientData {
  id: string;
  org_id: string | null;
  created_by: string | null;
  name: string;
  status: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberData {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  role: string | null;
  email: string | null;
  joined_at: string;
}
