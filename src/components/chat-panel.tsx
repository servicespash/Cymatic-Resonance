import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageItem, Msg } from "./message-item";
import { Paperclip, Mic, Send } from "lucide-react";
import { toast } from "sonner";

interface ChatPanelProps {
  channelId: string;
  orgId: string;
  user: { id: string } | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ channelId, orgId, user }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("id, channel_id, sender_id, body, created_at, profiles(full_name)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load messages");
    } else {
      setMessages(data as unknown as Msg[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [channelId]);

  const sendMessage = async () => {
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("messages").insert({
      org_id: orgId,
      channel_id: channelId,
      sender_id: user.id,
      body: body.trim(),
    });
    if (error) {
      toast.error("Failed to send message");
    } else {
      setBody("");
      fetchMessages();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/5 rounded-xl border border-white/5 p-4">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            m={m}
            showHeader={true}
            user={user}
            msgAttachments={[]}
            reactionGroups={{}}
            activeReactionPicker={null}
            setActiveReactionPicker={() => {}}
            handleToggleReaction={() => {}}
            handleDeleteMessage={() => {}}
            isRead={false}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 pt-3">
        <button className="text-muted-foreground hover:text-white" title="Attach file">
          <Paperclip className="size-5" />
        </button>
        <button className="text-muted-foreground hover:text-white" title="Record audio">
          <Mic className="size-5" />
        </button>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={sendMessage} className="bg-frequency text-white p-2 rounded-lg">
          <Send className="size-5" />
        </button>
      </div>
    </div>
  );
};
