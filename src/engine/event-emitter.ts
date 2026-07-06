// Event emitter for call engine — pub/sub system for state changes.

import type { CallEngineEvent } from "./types";

type Listener = (event: CallEngineEvent) => void;

export class EventEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: CallEngineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[CallEngine] Listener error:", error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
