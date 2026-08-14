import React from "react";
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

  return (
    <div
      role="button"
      tabIndex={0}
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setActive(c.channel);
        }
      }}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition ${
        active?.id === c.channel.id ? "bg-white/10" : "hover:bg-white/5"
      } ${isSelected ? "ring-2 ring-frequency bg-white/15" : ""}`}
    >
      <div className="relative">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ${
            isDm ? "bg-frequency/20" : ""
          }`}
        >
          {isDm ? <Users className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-foreground">{c.title}</span>
          <div className="flex items-center gap-1">
            {c.verified && <BadgeCheck className="h-4 w-4 text-frequency" />}
            {onDeleteChannel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChannel(c.channel.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition"
                aria-label="Delete chat"
                title="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {c.last?.body ? c.last.body : "No messages"}
        </p>
      </div>
    </div>
  );
};
