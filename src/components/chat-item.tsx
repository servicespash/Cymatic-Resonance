import { useLongPress } from "@/hooks/use-long-press";
import { Users, Hash, BadgeCheck, Trash2 } from "lucide-react";
import { Msg, Channel } from "@/lib/comms-context-def";

export const ChatItem = ({
  c,
  active,
  setActive,
  onLongPress,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}: {
  c: { channel: Channel; title: string; verified: boolean; last?: Msg };
  active: Channel | null;
  setActive: (c: Channel) => void;
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) => {
  const deleteLongPress = useLongPress((e) => onLongPress(e), 500);

  return (
    <div className="group flex items-center gap-1">
      {isSelectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="size-4 accent-accent"
        />
      )}
      <button
        {...deleteLongPress}
        onClick={() => {
          if (isSelectionMode) onToggleSelection();
          else setActive(c.channel);
        }}
        className={`flex-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
          active?.id === c.channel.id ? "bg-accent/10 text-accent" : "hover:bg-white/5"
        }`}
      >
        <div className="relative">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
              active?.id === c.channel.id
                ? "bg-accent text-primary-foreground shadow-lg shadow-accent/20"
                : "bg-white/5 group-hover:bg-white/10"
            }`}
          >
            {c.channel.kind === "dm" ? <Users className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium">{c.title}</span>
            {c.verified && <BadgeCheck className="h-4 w-4 text-accent" />}
          </div>
          <p className="truncate text-[11px] text-muted-foreground/60 leading-relaxed mt-0.5">
            {c.last?.body ?? "No messages"}
          </p>
        </div>
      </button>
      {/* {c.channel.kind === "dm" && (
        <button
          onClick={() => onDelete(c.channel.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="size-4" />
        </button>
      )} */}
    </div>
  );
};
