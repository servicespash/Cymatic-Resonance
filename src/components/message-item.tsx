import React, { useRef } from "react";
import { User, Trash2, SmilePlus, CheckCircle2 } from "lucide-react";
import { CommAttachment, Attachment } from "./comm-attachment";

export type Msg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    role: string;
  };
};

interface MessageItemProps {
  m: Msg;
  showHeader: boolean;
  user: { id: string } | null;
  msgAttachments: Attachment[];
  reactionGroups: Record<string, { count: number; users: string[]; hasReacted: boolean }>;
  activeReactionPicker: string | null;
  setActiveReactionPicker: (id: string | null) => void;
  handleToggleReaction: (messageId: string, emoji: string) => void;
  handleDeleteMessage: (msgId: string) => void;
  onLongPress?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "🔥", "🚀", "💡", "🎉"];

export const MessageItem: React.FC<MessageItemProps> = ({
  m,
  showHeader,
  user,
  msgAttachments,
  reactionGroups,
  activeReactionPicker,
  setActiveReactionPicker,
  handleToggleReaction,
  handleDeleteMessage,
  onLongPress,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}) => {
  const isMe = m.sender_id === user?.id;

  // Use hydrated profile info
  const senderName = m.profiles?.full_name || "Cymatic Member";

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      if ("vibrate" in navigator) navigator.vibrate(40);
      if (onLongPress) onLongPress();
    }, 450);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const initials = senderName
    .split(" ")
    .filter(Boolean)
    .map((x: string) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formattedTime = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      onClick={() => {
        if (isSelectionMode && onToggleSelection) {
          onToggleSelection();
        }
      }}
      className={`group relative flex gap-3 transition-all rounded-xl p-2 select-none cursor-pointer ${
        isSelected
          ? "bg-frequency/15 ring-2 ring-frequency shadow-lg"
          : "hover:bg-white/5 active:bg-white/10"
      }`}
    >
      {isSelectionMode && (
        <div className="flex items-center justify-center pr-1">
          <CheckCircle2
            className={`h-5 w-5 transition-colors ${
              isSelected ? "text-frequency fill-frequency/20" : "text-muted-foreground/40"
            }`}
          />
        </div>
      )}

      {showHeader ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frequency/20 font-mono text-xs font-bold text-frequency ring-1 ring-frequency/30">
          {initials || <User className="h-4 w-4" />}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground">{senderName}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{formattedTime}</span>
          </div>
        )}

        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
          {m.body}
        </div>

        {msgAttachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msgAttachments.map((att) => (
              <CommAttachment key={att.id} a={att} mine={isMe} />
            ))}
          </div>
        )}

        {Object.keys(reactionGroups).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(reactionGroups).map(([emoji, group]) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleReaction(m.id, emoji);
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs border transition ${
                  group.hasReacted
                    ? "bg-frequency/20 border-frequency/50 text-frequency font-bold shadow-sm"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                }`}
              >
                <span>{emoji}</span>
                <span>{group.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!isSelectionMode && (
        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 rounded-lg bg-black/80 border border-white/10 p-1 shadow-xl backdrop-blur-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveReactionPicker(activeReactionPicker === m.id ? null : m.id);
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition"
            aria-label="Add reaction"
          >
            <SmilePlus className="h-4 w-4" />
          </button>
          {isMe && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteMessage(m.id);
              }}
              className="p-1 text-muted-foreground hover:text-red-400 rounded transition"
              aria-label="Delete message"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {activeReactionPicker === m.id && (
        <div className="absolute right-2 top-10 z-30 flex gap-1.5 rounded-2xl bg-black/90 border border-white/15 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleReaction(m.id, emoji);
                setActiveReactionPicker(null);
              }}
              className="p-1 hover:scale-125 active:scale-95 transition text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
