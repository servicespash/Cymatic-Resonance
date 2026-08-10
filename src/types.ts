export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  position: string | null;
  category: string | null;
  role: "admin" | "member";
  org_id: string | null;
};

export type Org = {
  id: string;
  name: string;
  access_code: string;
  org_type: string;
  day_start_cutoff: string;
  timezone: string;
  logo_url: string | null;
  accent_color: string | null;
};

export type Member = {
  id: string;
  full_name: string | null;
  role: string;
  position: string | null;
  category: string | null;
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  profiles?: { full_name: string | null };
};
