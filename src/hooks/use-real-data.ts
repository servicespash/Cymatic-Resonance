import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientData, MemberData } from "@/types/database";

export function useRealData() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("No authenticated user found");
        }

        // Get the user's profile to find their org_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.org_id) {
          console.warn("[useRealData] User has no org_id associated");
          if (active) {
            setClients([]);
            setMembers([]);
            setLoading(false);
          }
          return;
        }

        // Query authentic clients list from the real clients table, filtered by org_id
        const { data: clientsData, error: clientsErr } = await supabase
          .from("clients")
          .select("*")
          .eq("org_id", profile.org_id)
          .order("name", { ascending: true });

        if (clientsErr) {
          throw clientsErr;
        }

        // Query authentic members list from the profiles table, filtered by org_id
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, last_seen_at, created_at")
          .eq("org_id", profile.org_id)
          .order("full_name", { ascending: true });

        if (profilesErr) {
          throw profilesErr;
        }

        // Fetch today's attendance for these members
        const today = new Date().toISOString().split("T")[0];
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("user_id, checked_in_at, checked_out_at")
          .eq("org_id", profile.org_id)
          .eq("attendance_date", today);

        // Dynamic active presence check: active if checked in today and not checked out
        const activeUserIds = new Set(
          attendanceData
            ?.filter((a) => a.checked_in_at && !a.checked_out_at)
            .map((a) => a.user_id) || [],
        );

        const membersList: MemberData[] = (profilesData || []).map((p) => ({
          id: p.id,
          name: p.full_name || "Unknown",
          role: p.role || "Member",
          last_seen_at: p.last_seen_at,
          status: activeUserIds.has(p.id) ? "active" : "inactive",
          email: "",
          joined_at: p.created_at,
        }));

        if (active) {
          setClients(clientsData || []);
          setMembers(membersList);
        }
      } catch (err: unknown) {
        console.error("[useRealData] Supabase fetch error:", err);
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load real database data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Subscribe to real-time changes on attendance and profiles for dynamic member presence
    const channel = supabase
      .channel("real-data-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { clients, members, loading, error };
}
