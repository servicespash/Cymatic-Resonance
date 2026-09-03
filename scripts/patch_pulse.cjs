const fs = require("fs");

const path = "src/routes/_authenticated/pulse.tsx";
let code = fs.readFileSync(path, "utf8");

code = `import { GreetingBanner } from "@/components/greeting-banner";\n` + code;

const telemetryCode = `
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function parseOrgType(raw: string) {
  try {
    if (raw.startsWith("{")) return JSON.parse(raw);
  } catch (e) {}
  return { type: raw, location: null };
}
`;
code = code.replace("function todayISO()", telemetryCode + "\nfunction todayISO()");

const stateBlock = `
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingData, setGreetingData] = useState<any>(null);
`;
code = code.replace(
  "const [busy, setBusy] = useState(false);",
  "const [busy, setBusy] = useState(false);\n" + stateBlock,
);

// Inside PulsePage component, replace checkIn function
const checkInRegex = /const checkIn = async \(\) => \{[\s\S]*?\};/;
const newCheckIn = `
  const checkIn = async () => {
    setBusy(true);
    let status = "unverified";
    let variance = 0;
    let externalLat = 0;
    let externalLng = 0;

    try {
      // 1. Get org boundaries
      const { data: p } = await supabase.from("profiles").select("org_id, full_name").eq("id", user?.id).single();
      const { data: o } = await supabase.from("organizations").select("name, org_type").eq("id", p?.org_id).single();
      
      const parsedType = parseOrgType(o?.org_type || "");
      const boundary = parsedType.location;
      
      let locConfirmed = false;

      // Spoofing detection caveat: Browser environment cannot natively detect Developer Options/Mock locations.
      // We rely on standard HTML5 geolocation accuracy and timeouts.
      if ("geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
        }).catch(() => null);

        if (pos && boundary) {
          externalLat = pos.coords.latitude;
          externalLng = pos.coords.longitude;
          variance = getDistance(boundary.lat, boundary.lng, externalLat, externalLng);
          
          if (variance <= boundary.radius) {
            status = "verified";
            locConfirmed = true;
          } else {
            const confirmExternal = window.confirm("You are outside the station boundary (" + Math.round(variance) + "m away). Log current location for this pulse? (Yes/No)");
            if (confirmExternal) {
              status = "external";
              locConfirmed = true;
            }
          }
        } else if (!pos) {
          status = "denied"; // or unverified
        }
      }

      // Fetch Tasks
      const { count } = await supabase.from("tasks").select("*", { count: 'exact', head: true }).eq("assignee_id", user?.id).eq("status", "pending");

      const telemetryNote = JSON.stringify({
        text: note,
        telemetry: { status, variance, lat: externalLat, lng: externalLng }
      });

      const { data, error } = await supabase.rpc("pulse_checkin", { _note: telemetryNote });
      if (error) throw error;
      
      toast.success("Resonance recorded");
      setNote("");
      setToday(data as AttRow);
      setHistory((h) => [data as AttRow, ...h]);
      
      setGreetingData({
        name: p?.full_name || "Agent",
        institution: o?.name || "Institution",
        status,
        tasksCount: count || 0
      });
      setShowGreeting(true);

    } catch (e: any) {
      toast.error(e.message || "Check-in failed");
    } finally {
      setBusy(false);
    }
  };
`;
code = code.replace(checkInRegex, newCheckIn);

// Add GreetingBanner to render
code = code.replace(
  "</ClientOnly>",
  `  {showGreeting && greetingData && (
        <GreetingBanner 
          {...greetingData} 
          onDismiss={() => setShowGreeting(false)} 
        />
      )}
    </ClientOnly>`,
);

// We need to parse telemetry note in the UI (History)
const historyRegex = /\{r\.note && \([\s\S]*?\{r\.note\}[\s\S]*?\}<\/div>\)[\s\S]*?\}/;
const newHistory = `{r.note && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {r.note.startsWith('{') ? JSON.parse(r.note).text : r.note}
                          {r.note.startsWith('{') && JSON.parse(r.note).telemetry && (
                            <span className={\`ml-2 uppercase tracking-widest text-[9px] px-1.5 py-0.5 rounded-md \${
                              JSON.parse(r.note).telemetry.status === 'verified' ? 'bg-green-500/15 text-green-400' :
                              JSON.parse(r.note).telemetry.status === 'external' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-red-500/15 text-red-400'
                            }\`}>
                              {JSON.parse(r.note).telemetry.status}
                            </span>
                          )}
                        </div>
                      )}`;
code = code.replace(historyRegex, newHistory);

fs.writeFileSync(path, code);
