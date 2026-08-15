import React, { useRef } from "react";
import { Users, Hash, BadgeCheck, Trash2 } from "lucide-react";

export type Channel = { id: string; name: string; kind: "broadcast" | "dm"; org_id: string };
export type Msg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

interface ChatItemProps {
  c: {
    channel: Channel;
    title: string;
    verified?: boolean;
    last?: Msg;
  };
  active: Channel | null;
  setActive: (channel: Channel | null) => void;
  onLongPress?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onDeleteChannel?: (channelId: string) => void;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  c,
  active,
  setActive,
  onLongPress,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onDeleteChannel,
}) => {
  const isDm = c.channel.kind === "dm";
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Strip ugly raw UUID strings automatically
  const formattedTitle =
    c.title.startsWith("dm:") || c.title.includes("-4a")
      ? c.title.replace(/^dm:/, "").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "Direct Message")
      : c.title;

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      if ("vibrate" in navigator) navigator.vibrate(40);
      if (onLongPress) onLongPress();
    }, 450);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onClick={() => {
        if (isSelectionMode && onToggleSelection) {
          onToggleSelection();
        } else {
          setActive(c.channel);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition select-none ${
        active?.id === c.channel.id ? "bg-white/10 shadow-inner" : "hover:bg-white/5 active:bg-white/10"
      } ${isSelected ? "ring-2 ring-frequency bg-white/15" : ""}`}
    >
      <div className="relative">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 ${
            isDm ? "bg-frequency/20 border-frequency/30 text-frequency" : "text-muted-foreground"
          }`}
        >
          {isDm ? <Users className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-foreground text-sm">{formattedTitle}</span>
          <div className="flex items-center gap-1">
            {c.verified && <BadgeCheck className="h-4 w-4 text-frequency" />}
            {onDeleteChannel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChannel(c.channel.id);
                }}
                className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition"
                aria-label="Delete chat thread"
                title="Delete chat thread"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="truncate text-xs text-muted-foreground/80 mt-0.5 font-mono">
          {c.last?.body ? c.last.body : "No messages"}
        </p>
      </div>
    </div>
  );
};
