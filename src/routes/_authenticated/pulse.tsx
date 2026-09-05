import { GreetingBanner } from "@/components/greeting-banner";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { CymaticWave } from "@/components/cymatic-wave";
import { RequireWorkspace } from "@/components/require-workspace";
import {
  Check,
  Clock,
  Coffee,
  LogOut,
  Flame,
  AlertTriangle,
  MapPin,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LeavePanel } from "@/components/leave-panel";
import { ResonanceSessionTimer } from "@/components/resonance-session-timer";
import { ProfessionalCheckIn } from "@/components/professional-check-in";
import { CheckInHistory } from "@/components/check-in-history";
import { SignalMap } from "@/components/signal-map";
import { DEFAULT_FALLBACK_LOCATION, getDistance, isValidLatLng, safeCoordinates } from "@/lib/geo";

import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/_authenticated/pulse")({
  component: () => (
    <RequireWorkspace>
      <PulsePage />
    </RequireWorkspace>
  ),
});

type AttRow = {
  id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  break_started_at: string | null;
  total_break_minutes: number;
  is_late: boolean;
  status: string;
  note: string | null;
};

function parseOrgType(raw: string) {
  try {
    if (raw.startsWith("{")) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return { type: raw, location: null };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PulsePage() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [today, setToday] = useState<AttRow | null>(null);
  const [history, setHistory] = useState<AttRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locPermission, setLocPermission] = useState<PermissionState | "unknown">("unknown");

  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          setLocPermission(status.state);
          status.onchange = () => setLocPermission(status.state);
        })
        .catch(() => setLocPermission("unknown"));
    }
  }, []);

  const requestLocationPermission = async () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocPermission("granted");
            toast.success("Location signal linked");
            resolve(pos);
          },
          (err) => {
            setLocPermission("denied");
            toast.error("Location permission denied or timed out");
            reject(err);
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
    } catch {
      // handled
    }
  };

  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingData, setGreetingData] = useState<Record<string, unknown> | null>(null);

  const [lastTelemetry, setLastTelemetry] = useState<{
    status: string;
    variance: number;
    lat: number;
    lng: number;
  } | null>(null);

  const [stationLocation, setStationLocation] = useState<{
    lat: number;
    lng: number;
    radius: number;
  }>(DEFAULT_FALLBACK_LOCATION);

  const refresh = useCallback(async () => {
    if (!user) return;

    let locFound = false;

    // 1. Fetch workspace settings for map
    const { data: ws } = await supabase.from("workspaces").select("settings").maybeSingle();
    if (
      ws?.settings?.location &&
      isValidLatLng(ws.settings.location.lat, ws.settings.location.lng)
    ) {
      setStationLocation({
        lat: Number(ws.settings.location.lat),
        lng: Number(ws.settings.location.lng),
        radius:
          typeof ws.settings.location.radius === "number" && !isNaN(ws.settings.location.radius)
            ? ws.settings.location.radius
            : 200,
      });
      locFound = true;
    }

    // 2. If not found in workspace settings, query organization
    if (!locFound) {
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (p?.org_id) {
        const { data: o } = await supabase
          .from("organizations")
          .select("org_type")
          .eq("id", p.org_id)
          .maybeSingle();

        const parsed = parseOrgType(o?.org_type || "");
        if (parsed.location && isValidLatLng(parsed.location.lat, parsed.location.lng)) {
          setStationLocation({
            lat: Number(parsed.location.lat),
            lng: Number(parsed.location.lng),
            radius:
              typeof parsed.location.radius === "number" && !isNaN(parsed.location.radius)
                ? parsed.location.radius
                : 200,
          });
          locFound = true;
        }
      }
    }

    if (!locFound) {
      setStationLocation(DEFAULT_FALLBACK_LOCATION);
    }

    const { data } = await supabase
      .from("attendance")
      .select(
        "id, attendance_date, checked_in_at, checked_out_at, break_started_at, total_break_minutes, is_late, status, note",
      )
      .eq("user_id", user.id)
      .order("attendance_date", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as AttRow[];
    setHistory(rows);

    const todayRow = rows.find((r) => r.attendance_date === todayISO());
    setToday(todayRow ?? null);

    if (todayRow?.note?.startsWith("{")) {
      try {
        const parsed = JSON.parse(todayRow.note);
        if (parsed.telemetry) {
          const validCoords = safeCoordinates(
            parsed.telemetry.lat,
            parsed.telemetry.lng,
            DEFAULT_FALLBACK_LOCATION,
          );
          setLastTelemetry({
            status: parsed.telemetry.status || "unverified",
            variance:
              typeof parsed.telemetry.variance === "number" && !isNaN(parsed.telemetry.variance)
                ? parsed.telemetry.variance
                : 0,
            lat: validCoords.lat,
            lng: validCoords.lng,
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkIn = async () => {
    setBusy(true);
    let status = "unverified";
    let variance = 0;
    let externalLat = DEFAULT_FALLBACK_LOCATION.lat;
    let externalLng = DEFAULT_FALLBACK_LOCATION.lng;

    try {
      // 1. Get org boundaries
      const { data: p } = await supabase
        .from("profiles")
        .select("org_id, full_name")
        .eq("id", user?.id)
        .single();
      const { data: o } = await supabase
        .from("organizations")
        .select("name, org_type")
        .eq("id", p?.org_id)
        .single();

      const parsedType = parseOrgType(o?.org_type || "");
      const orgBoundary = parsedType.location;
      const targetBoundary =
        orgBoundary && isValidLatLng(orgBoundary.lat, orgBoundary.lng)
          ? orgBoundary
          : stationLocation && isValidLatLng(stationLocation.lat, stationLocation.lng)
            ? stationLocation
            : DEFAULT_FALLBACK_LOCATION;

      // 2. Request Geolocation with safe validation & fallback
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true,
            });
          });

          if (pos?.coords && isValidLatLng(pos.coords.latitude, pos.coords.longitude)) {
            externalLat = pos.coords.latitude;
            externalLng = pos.coords.longitude;
            setLocPermission("granted");

            variance = getDistance(
              targetBoundary.lat,
              targetBoundary.lng,
              externalLat,
              externalLng,
            );

            const allowedRadius = targetBoundary.radius || 200;
            if (variance <= allowedRadius) {
              status = "verified";
            } else {
              const confirmExternal = window.confirm(
                `You are outside the station perimeter (${Math.round(variance)}m away). Log this position for today's pulse?`,
              );
              if (confirmExternal) {
                status = "external";
              }
            }
          } else {
            // Unverified or invalid coords fallback
            status = "unverified";
            externalLat = targetBoundary.lat;
            externalLng = targetBoundary.lng;
          }
        } catch (geoErr) {
          console.warn("Geolocation access denied or timed out; using fallback:", geoErr);
          status = "denied";
          setLocPermission("denied");
          externalLat = targetBoundary.lat;
          externalLng = targetBoundary.lng;
          variance = 0;
        }
      } else {
        // Fallback if browser doesn't support geolocation
        status = "denied";
        setLocPermission("denied");
        externalLat = targetBoundary.lat;
        externalLng = targetBoundary.lng;
        variance = 0;
      }

      // Strict validation layer before persistence - guarantees non-NaN values
      const validatedCoords = safeCoordinates(externalLat, externalLng, DEFAULT_FALLBACK_LOCATION);
      externalLat = validatedCoords.lat;
      externalLng = validatedCoords.lng;
      if (isNaN(variance) || !isFinite(variance) || variance < 0) {
        variance = 0;
      }

      // Fetch Tasks
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assignee_id", user?.id)
        .eq("status", "pending");

      const telemetryObj = { status, variance, lat: externalLat, lng: externalLng };
      const telemetryNote = JSON.stringify({
        text: note,
        telemetry: telemetryObj,
      });

      const { data, error } = await supabase.rpc("pulse_checkin", { _note: telemetryNote });
      if (error) throw error;

      toast.success("Resonance recorded");
      setNote("");
      const newToday = data as AttRow;
      setToday(newToday);
      setLastTelemetry(telemetryObj);
      setHistory((h) => [newToday, ...h]);

      setGreetingData({
        name: p?.full_name || "Agent",
        institution: o?.name || "Institution",
        status,
        tasksCount: count || 0,
      });
      setShowGreeting(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!today) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pulse_checkout", { _id: today.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Day sealed");
    setToday(data as AttRow);
    refresh();
  };

  const toggleBreak = async () => {
    if (!today) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pulse_toggle_break", { _id: today.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setToday(data as AttRow);
  };

  const state: "out" | "in" | "break" | "sealed" = !today
    ? "out"
    : today.checked_out_at
      ? "sealed"
      : today.break_started_at
        ? "break"
        : "in";

  const liveMinutes = useMemo(() => {
    if (!today) return 0;
    const end = today.checked_out_at ? new Date(today.checked_out_at) : now;
    const total = Math.max(
      0,
      Math.floor((end.getTime() - new Date(today.checked_in_at).getTime()) / 60000),
    );
    const activeBreak =
      today.break_started_at && !today.checked_out_at
        ? Math.floor((now.getTime() - new Date(today.break_started_at).getTime()) / 60000)
        : 0;
    return Math.max(0, total - today.total_break_minutes - activeBreak);
  }, [today, now]);

  const streak = useMemo(() => {
    const set = new Set(history.map((r) => r.attendance_date));
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (set.has(d)) s++;
      else break;
    }
    return s;
  }, [history]);

  const stationLocationMemo = useMemo(() => {
    if (stationLocation && isValidLatLng(stationLocation.lat, stationLocation.lng)) {
      return {
        lat: Number(stationLocation.lat),
        lng: Number(stationLocation.lng),
        radius:
          typeof stationLocation.radius === "number" && !isNaN(stationLocation.radius)
            ? stationLocation.radius
            : 200,
      };
    }
    return DEFAULT_FALLBACK_LOCATION;
  }, [stationLocation]);

  const userPosMemo = useMemo(() => {
    if (!lastTelemetry || !isValidLatLng(lastTelemetry.lat, lastTelemetry.lng)) {
      return null;
    }
    return { lat: Number(lastTelemetry.lat), lng: Number(lastTelemetry.lng) };
  }, [lastTelemetry]);

  return (
    <ClientOnly fallback={<div className="p-4">Loading...</div>}>
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <h1 className="sr-only">Your Resonance Pulse</h1>

        {/* Location permission banner / request prompt */}
        {locPermission !== "granted" && (
          <div
            id="location-permission-card"
            className="rounded-2xl border border-accent/20 bg-accent/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Navigation className="size-4 animate-pulse" />
              </div>
              <div>
                <div className="font-mono text-xs font-semibold text-foreground">
                  Location Permissions
                </div>
                <p className="text-xs text-muted-foreground">
                  {locPermission === "denied"
                    ? "GPS access was denied. Check-ins will default to verified station fallback."
                    : "Authorize GPS access to enable instant perimeter resonance and automatic check-in telemetry."}
                </p>
              </div>
            </div>
            {locPermission !== "denied" ? (
              <button
                id="btn-request-location"
                type="button"
                onClick={requestLocationPermission}
                className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
              >
                <MapPin className="size-3.5" />
                Allow Location Access
              </button>
            ) : (
              <button
                id="btn-retry-location"
                type="button"
                onClick={requestLocationPermission}
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 transition"
              >
                Retry GPS
              </button>
            )}
          </div>
        )}
        <section className="glass-strong relative overflow-hidden rounded-3xl p-8 resonance-glow animate-fade-up">
          <div className="absolute inset-0 -z-10 bg-frequency/30 blur-3xl" />

          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            {streak > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-accent">
                <Flame className="size-3" /> {streak}-day streak
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <div className="font-display text-6xl font-bold tracking-tight tabular-nums md:text-7xl">
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>

            {/* big pulse button */}
            <div className="mt-8 flex flex-col items-center">
              <PulseButton state={state} busy={busy} onClick={checkIn} />

              {state === "out" && (
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="mt-6 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm outline-none focus:border-primary/40"
                />
              )}

              {today && state !== "sealed" && (
                <div className="mt-6 flex items-center gap-2">
                  <button
                    onClick={toggleBreak}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs transition hover:bg-white/10 disabled:opacity-50"
                  >
                    <Coffee className="size-3.5" />
                    {state === "break" ? "Resume" : "Take break"}
                  </button>
                  <button
                    onClick={checkOut}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs transition hover:bg-white/10 disabled:opacity-50"
                  >
                    <LogOut className="size-3.5" />
                    Check out
                  </button>
                </div>
              )}

              {today && (
                <div className="mt-8 flex flex-col gap-6 w-full max-w-xl">
                  {stationLocationMemo && (
                    <div className="animate-fade-in">
                      <SignalMap
                        center={stationLocationMemo}
                        radius={stationLocationMemo.radius}
                        userPos={userPosMemo}
                      />
                    </div>
                  )}

                  {lastTelemetry && (
                    <ProfessionalCheckIn
                      status={lastTelemetry.status}
                      variance={lastTelemetry.variance}
                      lat={lastTelemetry.lat}
                      lng={lastTelemetry.lng}
                      referencePoint={stationLocationMemo}
                      isLate={today.is_late}
                    />
                  )}

                  <div className="grid w-full grid-cols-3 gap-3">
                    <Stat label="Logged" value={fmtH(liveMinutes)} />
                    <Stat label="Break" value={`${today.total_break_minutes}m`} />
                    <Stat
                      label="Status"
                      value={
                        state === "sealed" ? "Sealed" : state === "break" ? "On break" : "Active"
                      }
                      tone={today.is_late ? "warn" : state === "sealed" ? "muted" : "ok"}
                    />
                  </div>
                </div>
              )}

              {today?.is_late && (
                <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-400">
                  <AlertTriangle className="size-3" /> Late check-in
                </div>
              )}
            </div>
          </div>
        </section>

        {/* History */}
        <CheckInHistory history={history} />

        {/* Resonance Focus Session Timer */}
        <section className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <ResonanceSessionTimer />
        </section>

        <LeavePanel />
      </div>
      {showGreeting && greetingData && (
        <GreetingBanner {...greetingData} onDismiss={() => setShowGreeting(false)} />
      )}
    </ClientOnly>
  );
}

function PulseButton({
  state,
  busy,
  onClick,
}: {
  state: "out" | "in" | "break" | "sealed";
  busy: boolean;
  onClick: () => void;
}) {
  const disabled = busy || state !== "out";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative size-44 rounded-full transition ${
        state === "out"
          ? "bg-frequency resonance-glow hover:scale-[1.02] animate-pulse-ring"
          : state === "sealed"
            ? "bg-muted/30 border border-white/10"
            : state === "break"
              ? "bg-amber-500/15 border border-amber-400/30"
              : "bg-accent/20 border border-accent/40"
      } disabled:cursor-default`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col items-center justify-center gap-2"
        >
          {state === "out" ? (
            <>
              <CymaticWave className="h-8" bars={6} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary-foreground">
                Sync pulse
              </span>
            </>
          ) : state === "in" ? (
            <>
              <Check className="size-10 text-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
                Active
              </span>
            </>
          ) : state === "break" ? (
            <>
              <Coffee className="size-10 text-amber-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                On break
              </span>
            </>
          ) : (
            <>
              <LogOut className="size-10 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Sealed
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "warn" ? "text-amber-400" : tone === "muted" ? "text-muted-foreground" : "text-accent";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-base font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
