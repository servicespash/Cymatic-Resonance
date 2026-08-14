import { useLongPress } from "@/hooks/use-long-press";
import type { User } from "@supabase/supabase-js";
import { Shield, Smile, Trash2 } from "lucide-react";
import { Msg, Reaction, Sender } from "@/lib/comms-context-def";
import { CommAttachment, type Attachment } from "@/components/comm-attachment";
import { getNotificationPrefs } from "@/lib/notifications";

export const MessageItem = ({
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
}: {
  m: Msg;
  showHeader: boolean;
  senders: Record<string, Sender>;
  user: User | null;
  msgAttachments: Attachment[];
  reactionGroups: Record<string, { count: number; users: string[]; hasReacted: boolean }>;
  activeReactionPicker: string | null;
  setActiveReactionPicker: (id: string | null) => void;
  handleToggleReaction: (messageId: string, emoji: string) => void;
  handleDeleteMessage: (messageId: string) => void;
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) => {
  const messageLongPress = useLongPress((e) => onLongPress(e), 500);
  const isMine = !!(user?.id && m.sender_id === user.id);

  return (
    <div
      key={`msg-${m.id}`}
      {...messageLongPress}
      className={`group relative flex gap-3 ${showHeader ? "mt-4" : "mt-1"} ${
        isMine ? "flex-row-reverse text-right" : "flex-row text-left"
      }`}
    >
      {isSelectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="size-4 accent-accent mt-2"
        />
      )}

      {showHeader ? (
        <div
          className={`grid size-9 place-items-center rounded-xl font-mono text-xs font-bold shrink-0 border ${
            isMine
              ? "bg-frequency/20 text-frequency border-frequency/30"
              : "bg-accent/10 text-accent border-accent/20"
          }`}
        >
          {senders[m.sender_id]?.full_name
            ?.split(" ")
            .map((x) => x[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "U"}
        </div>
      ) : (
        <div className="w-9 shrink-0" />
      )}

      <div className={`flex-1 min-w-0 flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        {showHeader && (
          <div className={`flex items-center gap-2 mb-1 ${isMine ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-bold tracking-tight text-foreground">
              {senders[m.sender_id]?.full_name ?? "Member"}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-tighter text-muted-foreground/60">
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Text Body */}
        {m.body && (
          <div
            className={`inline-block rounded-2xl px-4 py-2.5 text-sm ring-1 shadow-sm max-w-[85%] break-words leading-relaxed ${
              isMine
                ? "bg-frequency text-primary-foreground rounded-tr-none ring-frequency/30"
                : "bg-white/5 text-foreground/90 rounded-tl-none ring-white/5"
            }`}
          >
            {m.body.startsWith("[e2ee]") ? (
              <div className="flex flex-col gap-1">
                {getNotificationPrefs().showEncryptionBadges && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-accent font-semibold tracking-wider">
                    <Shield className="size-3" /> E2EE ENCRYPTED
                  </div>
                )}
                <span>{m.body.slice(6)}</span>
              </div>
            ) : (
              m.body
            )}
          </div>
        )}

        {/* Attachments rendering */}
        {msgAttachments.length > 0 && (
          <div className={`mt-2 flex flex-col gap-2 ${isMine ? "items-end" : "items-start"}`}>
            {msgAttachments.map((att, j) => (
              <CommAttachment key={`${att.id}-${j}`} a={att} mine={isMine} />
            ))}
          </div>
        )}

        {/* Reaction Badges */}
        <div
          className={`flex items-center gap-1.5 flex-wrap mt-1.5 ${isMine ? "flex-row-reverse" : ""}`}
        >
          {Object.entries(reactionGroups).map(([emoji, g]) => (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(m.id, emoji)}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-all border ${
                g.hasReacted
                  ? "bg-accent/20 border-accent/50 text-accent font-bold"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <span>{emoji}</span>
              <span className="font-mono text-[10px]">{g.count}</span>
            </button>
          ))}

          {/* Trigger Reaction Picker */}
          <div className="relative">
            <button
              onClick={() => setActiveReactionPicker(activeReactionPicker === m.id ? null : m.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
              title="Add Reaction"
            >
              <Smile className="size-3.5" />
            </button>
          </div>

          {isMine && (
            <button
              onClick={() => handleDeleteMessage(m.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              title="Delete message"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
