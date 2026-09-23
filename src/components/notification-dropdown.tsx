/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Bell, Phone, MessageSquare, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { triggerVibration } from "@/lib/vibration";

type CallItem = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  initiator_id: string;
};

type MessageItem = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  channel_id: string;
};

export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    // Fetch user preferences first
    const { data: prefs } = await (supabase.from("user_preferences" as any) as any)
      .select("task_alerts, pulse_alerts")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch recent notifications
    const { data: notifData } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(10);

    const notifications = (notifData as any[]) || [];

    // Filter notifications based on preferences
    const filteredNotifications = notifications.filter((n) => {
      if (n.type === "call" && prefs?.pulse_alerts) return true;
      if (n.type === "message" && prefs?.task_alerts) return true;
      return false;
    });

    setCalls(filteredNotifications.filter((n) => n.type === "call"));
    setMessages(filteredNotifications.filter((n) => n.type === "message"));
    setUnreadCount(filteredNotifications.length);
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Realtime subscription for notifications
    const channel = supabase
      .channel("header-notifications-hub")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
        triggerVibration();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const handleItemClick = (type: "call" | "message") => {
    setOpen(false);
    if (type === "call") {
      navigate({ to: "/comms" });
    } else {
      navigate({ to: "/comms" });
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-xl border border-white/10 hover:bg-white/5"
        onClick={() => {
          setOpen(!open);
          triggerVibration();
        }}
        aria-label="Notifications"
      >
        <Bell className="size-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 z-50 glass rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-accent" />
                  <span className="font-display font-semibold text-sm">Notifications & Alerts</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  {unreadCount} active
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3 py-3">
                {calls.length === 0 && messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                    <CheckCircle className="size-8 mx-auto text-emerald-400 opacity-60" />
                    <p>All caught up! No active calls or unread messages.</p>
                  </div>
                ) : (
                  <>
                    {calls.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-400">
                          Active Calls ({calls.length})
                        </span>
                        {calls.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleItemClick("call")}
                            className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Phone className="size-4 text-indigo-400 animate-bounce" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">
                                  Incoming {c.kind} Call
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  Tap to join
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="size-3.5 text-indigo-400" />
                          </div>
                        ))}
                      </div>
                    )}

                    {messages.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                          Unread Messages ({messages.length})
                        </span>
                        {messages.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleItemClick("message")}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <MessageSquare className="size-4 text-emerald-400" />
                              <div className="min-w-0">
                                <p className="text-xs truncate font-medium">{m.body}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {new Date(m.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="size-3.5 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7 px-2"
                  onClick={() => {
                    setCalls([]);
                    setMessages([]);
                    setUnreadCount(0);
                    setOpen(false);
                  }}
                >
                  Clear all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-accent h-7 px-2"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/comms" });
                  }}
                >
                  Open Comms
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
