import { useEffect } from 'react';
import { toast } from 'sonner';

export function useWebRTCConnection(pc: RTCPeerConnection | null) {
  useEffect(() => {
    if (!pc) return;

    const handleConnectionStateChange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        toast.error('Connection dropped. Reconnecting...', { duration: 5000 });
      } else if (state === 'connected') {
        toast.success('Call quality stabilized.');
      }
    };

    pc.addEventListener('connectionstatechange', handleConnectionStateChange);

    return () => {
      pc.removeEventListener('connectionstatechange', handleConnectionStateChange);
    };
  }, [pc]);
}
