import { CallContainer } from "@/components/call-container";

type Sender = { id: string; full_name: string | null };

export function CallRoom(props: {
  callId: string;
  selfId: string;
  video: boolean;
  peers: Record<string, Sender>;
  kind: "audio" | "video";
  onLeave: () => void;
}) {
  return <CallContainer {...props} />;
}

export { CallContainer };
