/**
 * Generic typed event emitter for WebSocket and other event-driven components
 */

export type EventHandler<T = any> = (data: T) => void;
export type UnsubscribeFn = () => void;

export interface IEventEmitter<EventMap extends Record<string, any>> {
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): UnsubscribeFn;
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): UnsubscribeFn;
  off<K extends keyof EventMap>(
    event: K,
    handler?: EventHandler<EventMap[K]>,
  ): void;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
  removeAllListeners(event?: keyof EventMap): void;
  listenerCount(event: keyof EventMap): number;
}

/**
 * Typed event emitter implementation
 */
export class EventEmitter<EventMap extends Record<string, any>>
  implements IEventEmitter<EventMap>
{
  private events: Map<keyof EventMap, Set<EventHandler>> = new Map();
  private maxListeners = 100;

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): UnsubscribeFn {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    const handlers = this.events.get(event)!;

    // Warn if approaching max listeners (potential memory leak)
    if (handlers.size >= this.maxListeners) {
      console.warn(
        `Warning: Possible event emitter memory leak detected. ${handlers.size} listeners added for event "${String(event)}"`,
      );
    }

    handlers.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first emission)
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): UnsubscribeFn {
    const onceHandler: EventHandler<EventMap[K]> = (data) => {
      handler(data);
      this.off(event, onceHandler);
    };

    return this.on(event, onceHandler);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(
    event: K,
    handler?: EventHandler<EventMap[K]>,
  ): void {
    const handlers = this.events.get(event);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    } else {
      // Remove all handlers for this event if no specific handler provided
      this.events.delete(event);
    }
  }

  /**
   * Emit an event to all listeners
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) return;

    // Create a copy to prevent issues if handlers modify the set during iteration
    const handlersCopy = Array.from(handlers);

    for (const handler of handlersCopy) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event
   */
  listenerCount(event: keyof EventMap): number {
    const handlers = this.events.get(event);
    return handlers ? handlers.size : 0;
  }

  /**
   * Set the maximum number of listeners (for memory leak detection)
   */
  setMaxListeners(max: number): void {
    this.maxListeners = max;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): Array<keyof EventMap> {
    return Array.from(this.events.keys());
  }
}

/**
 * Create a new typed event emitter
 */
export function createEventEmitter<
  T extends Record<string, any>,
>(): EventEmitter<T> {
  return new EventEmitter<T>();
}
