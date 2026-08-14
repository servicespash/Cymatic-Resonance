import React from "react";
import { User, Trash2, SmilePlus } from "lucide-react";
import { CommAttachment, Attachment } from "./comm-attachment";

export type Msg = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Sender = {
  id: string;
  full_name: string | null;
  role: string;
};

interface MessageItemProps {
  m: Msg;
  showHeader: boolean;
  senders: Record<string, Sender>;
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
  senders,
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
  const senderInfo = senders[m.sender_id];
  const senderName =
    senderInfo?.full_name || (m.sender_id ? `User ${m.sender_id.slice(0, 4)}` : "Unknown");

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
      onContextMenu={(e) => {
        e.preventDefault();
        if (onLongPress) onLongPress();
      }}
      onClick={() => {
        if (isSelectionMode && onToggleSelection) {
          onToggleSelection();
        }
      }}
      className={`group relative flex gap-3 transition-colors rounded-xl p-2 ${
        isSelected ? "bg-white/10 ring-1 ring-frequency" : "hover:bg-white/5"
      }`}
    >
      {showHeader ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frequency/20 font-mono text-xs font-bold text-frequency">
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

        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{m.body}</div>

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
                onClick={() => handleToggleReaction(m.id, emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition ${
                  group.hasReacted
                    ? "bg-frequency/20 border-frequency/40 text-frequency font-bold"
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

      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 rounded-lg bg-card border border-white/10 p-1 shadow-md">
        <button
          onClick={() => setActiveReactionPicker(activeReactionPicker === m.id ? null : m.id)}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition"
          aria-label="Add reaction"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
        {isMe && (
          <button
            onClick={() => handleDeleteMessage(m.id)}
            className="p-1 text-muted-foreground hover:text-red-400 rounded transition"
            aria-label="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {activeReactionPicker === m.id && (
        <div className="absolute right-2 top-9 z-20 flex gap-1 rounded-xl bg-card border border-white/10 p-2 shadow-xl backdrop-blur-xl animate-fade-in">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                handleToggleReaction(m.id, emoji);
                setActiveReactionPicker(null);
              }}
              className="p-1 hover:scale-125 transition text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
