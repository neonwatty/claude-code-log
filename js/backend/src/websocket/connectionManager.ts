import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import {
  WebSocketEventMessage,
  WebSocketMessageType,
  IHeartbeatMessage,
  IPongMessage,
} from "./messageTypes";

export interface IWebSocketClient {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastPing: number;
  connectedAt: number;
  metadata?: {
    userAgent?: string;
    ip?: string;
  };
}

export class ConnectionManager {
  private clients: Map<string, IWebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT = 60000; // 60 seconds

  constructor() {
    this.startHeartbeat();
  }

  public addClient(socket: WebSocket, metadata?: any): string {
    const clientId = uuidv4();
    const client: IWebSocketClient = {
      id: clientId,
      socket,
      isAlive: true,
      lastPing: Date.now(),
      connectedAt: Date.now(),
      metadata,
    };

    this.clients.set(clientId, client);

    // Set up socket event handlers
    this.setupSocketHandlers(client);

    console.log(
      `WebSocket client connected: ${clientId} (Total: ${this.clients.size})`,
    );
    return clientId;
  }

  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.terminate();
      this.clients.delete(clientId);
      console.log(
        `WebSocket client disconnected: ${clientId} (Total: ${this.clients.size})`,
      );
    }
  }

  public getClient(clientId: string): IWebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

  public getClientList(): IWebSocketClient[] {
    return Array.from(this.clients.values());
  }

  public broadcast(message: WebSocketEventMessage): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    let failedCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          failedCount++;
          this.removeClient(clientId);
        }
      } else {
        // Clean up closed connections
        this.removeClient(clientId);
        failedCount++;
      }
    }

    console.log(
      `Broadcast message: ${message.type}, sent to ${sentCount} clients, ${failedCount} failed`,
    );
  }

  public sendToClient(
    clientId: string,
    message: WebSocketEventMessage,
  ): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  private setupSocketHandlers(client: IWebSocketClient): void {
    const { socket, id } = client;

    socket.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketEventMessage;
        this.handleClientMessage(id, message);
      } catch (error) {
        console.error(`Invalid message from client ${id}:`, error);
      }
    });

    socket.on("pong", () => {
      const clientRef = this.clients.get(id);
      if (clientRef) {
        clientRef.isAlive = true;
        clientRef.lastPing = Date.now();
      }
    });

    socket.on("close", () => {
      this.removeClient(id);
    });

    socket.on("error", (error) => {
      console.error(`WebSocket error for client ${id}:`, error);
      this.removeClient(id);
    });
  }

  private handleClientMessage(
    clientId: string,
    message: WebSocketEventMessage,
  ): void {
    switch (message.type) {
      case WebSocketMessageType.PONG:
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
        break;

      case WebSocketMessageType.HEARTBEAT:
        // Respond with pong
        const pongMessage: IPongMessage = {
          type: WebSocketMessageType.PONG,
          timestamp: new Date().toISOString(),
        };
        this.sendToClient(clientId, pongMessage);
        break;

      default:
        console.log(`Received message from client ${clientId}:`, message.type);
        break;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      for (const [clientId, client] of this.clients) {
        // Check if client has timed out
        if (now - client.lastPing > this.CLIENT_TIMEOUT) {
          clientsToRemove.push(clientId);
          continue;
        }

        // Send ping to check if client is still alive
        if (client.socket.readyState === WebSocket.OPEN) {
          client.isAlive = false;

          try {
            client.socket.ping();

            // Also send heartbeat message
            const heartbeatMessage: IHeartbeatMessage = {
              type: WebSocketMessageType.HEARTBEAT,
              timestamp: new Date().toISOString(),
            };
            client.socket.send(JSON.stringify(heartbeatMessage));
          } catch (error) {
            console.error(`Failed to ping client ${clientId}:`, error);
            clientsToRemove.push(clientId);
          }
        } else {
          clientsToRemove.push(clientId);
        }
      }

      // Remove timed out or broken clients
      for (const clientId of clientsToRemove) {
        this.removeClient(clientId);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.socket.terminate();
    }

    this.clients.clear();
    console.log("WebSocket connection manager destroyed");
  }
}
