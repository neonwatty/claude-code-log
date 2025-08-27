/**
 * Unit tests for WebSocket message types and schemas
 * Tests TypeScript interfaces, enums, and schema validation
 */

import { describe, it, expect } from "vitest";
import {
  MessageType,
  MESSAGE_SCHEMAS,
  MessageErrorCode,
  type SessionCreatedMessage,
  type SessionUpdatedMessage,
  type SessionDeletedMessage,
  type CacheInvalidatedMessage,
  type SessionData,
  type MessageError,
} from "../../../src/utils/websocket/message-types";

describe("WebSocket Message Types", () => {
  describe("MessageType enum", () => {
    it("should have correct enum values", () => {
      expect(MessageType.SESSION_CREATED).toBe("SESSION_CREATED");
      expect(MessageType.SESSION_UPDATED).toBe("SESSION_UPDATED");
      expect(MessageType.SESSION_DELETED).toBe("SESSION_DELETED");
      expect(MessageType.CACHE_INVALIDATED).toBe("CACHE_INVALIDATED");
    });

    it("should have all required message types", () => {
      const messageTypes = Object.values(MessageType);
      expect(messageTypes).toHaveLength(8);
      expect(messageTypes).toContain("SESSION_CREATED");
      expect(messageTypes).toContain("SESSION_UPDATED");
      expect(messageTypes).toContain("SESSION_DELETED");
      expect(messageTypes).toContain("CACHE_INVALIDATED");
      expect(messageTypes).toContain("ANALYTICS_TOKEN_UPDATE");
      expect(messageTypes).toContain("ANALYTICS_INSIGHTS_UPDATE");
      expect(messageTypes).toContain("ANALYTICS_PERFORMANCE_UPDATE");
      expect(messageTypes).toContain("ANALYTICS_REAL_TIME_METRICS");
    });
  });

  describe("MessageErrorCode enum", () => {
    it("should have correct error code values", () => {
      expect(MessageErrorCode.INVALID_FORMAT).toBe("INVALID_FORMAT");
      expect(MessageErrorCode.UNKNOWN_TYPE).toBe("UNKNOWN_TYPE");
      expect(MessageErrorCode.MISSING_FIELDS).toBe("MISSING_FIELDS");
      expect(MessageErrorCode.INVALID_PAYLOAD).toBe("INVALID_PAYLOAD");
      expect(MessageErrorCode.PROCESSING_ERROR).toBe("PROCESSING_ERROR");
    });
  });

  describe("Message Schemas", () => {
    it("should have schemas for all message types", () => {
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.SESSION_CREATED);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.SESSION_UPDATED);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.SESSION_DELETED);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.CACHE_INVALIDATED);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.ANALYTICS_TOKEN_UPDATE);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.ANALYTICS_INSIGHTS_UPDATE);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.ANALYTICS_PERFORMANCE_UPDATE);
      expect(MESSAGE_SCHEMAS).toHaveProperty(MessageType.ANALYTICS_REAL_TIME_METRICS);
    });

    it("should have correct schema structure for SESSION_CREATED", () => {
      const schema = MESSAGE_SCHEMAS[MessageType.SESSION_CREATED];
      expect(schema.type).toBe(MessageType.SESSION_CREATED);
      expect(schema.requiredFields).toEqual([
        "type",
        "timestamp",
        "id",
        "payload",
      ]);
      expect(schema.payloadSchema).toEqual({
        session: "object",
      });
    });

    it("should have correct schema structure for SESSION_UPDATED", () => {
      const schema = MESSAGE_SCHEMAS[MessageType.SESSION_UPDATED];
      expect(schema.type).toBe(MessageType.SESSION_UPDATED);
      expect(schema.requiredFields).toEqual([
        "type",
        "timestamp",
        "id",
        "payload",
      ]);
      expect(schema.payloadSchema).toEqual({
        session: "object",
        changes: "object",
      });
    });

    it("should have correct schema structure for SESSION_DELETED", () => {
      const schema = MESSAGE_SCHEMAS[MessageType.SESSION_DELETED];
      expect(schema.type).toBe(MessageType.SESSION_DELETED);
      expect(schema.requiredFields).toEqual([
        "type",
        "timestamp",
        "id",
        "payload",
      ]);
      expect(schema.payloadSchema).toEqual({
        sessionId: "string",
        deletedAt: "string",
      });
    });

    it("should have correct schema structure for CACHE_INVALIDATED", () => {
      const schema = MESSAGE_SCHEMAS[MessageType.CACHE_INVALIDATED];
      expect(schema.type).toBe(MessageType.CACHE_INVALIDATED);
      expect(schema.requiredFields).toEqual([
        "type",
        "timestamp",
        "id",
        "payload",
      ]);
      expect(schema.payloadSchema).toEqual({
        scope: "string",
        reason: "string",
      });
    });
  });

  describe("Message Type Interfaces", () => {
    it("should create valid SessionCreatedMessage", () => {
      const sessionData: SessionData = {
        sessionId: "test-session-123",
        title: "Test Session",
        createdAt: "2024-01-01T00:00:00Z",
        status: "active",
      };

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: "2024-01-01T00:00:00Z",
        id: "msg-123",
        payload: {
          session: sessionData,
        },
      };

      expect(message.type).toBe(MessageType.SESSION_CREATED);
      expect(message.payload.session.sessionId).toBe("test-session-123");
    });

    it("should create valid SessionUpdatedMessage", () => {
      const sessionData: SessionData = {
        sessionId: "test-session-123",
        title: "Updated Test Session",
        updatedAt: "2024-01-01T01:00:00Z",
      };

      const message: SessionUpdatedMessage = {
        type: MessageType.SESSION_UPDATED,
        timestamp: "2024-01-01T01:00:00Z",
        id: "msg-124",
        payload: {
          session: sessionData,
          changes: {
            fields: ["title", "updatedAt"],
            previousValues: {
              title: "Test Session",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
      };

      expect(message.type).toBe(MessageType.SESSION_UPDATED);
      expect(message.payload.changes.fields).toEqual(["title", "updatedAt"]);
    });

    it("should create valid SessionDeletedMessage", () => {
      const message: SessionDeletedMessage = {
        type: MessageType.SESSION_DELETED,
        timestamp: "2024-01-01T02:00:00Z",
        id: "msg-125",
        payload: {
          sessionId: "test-session-123",
          deletedAt: "2024-01-01T02:00:00Z",
        },
      };

      expect(message.type).toBe(MessageType.SESSION_DELETED);
      expect(message.payload.sessionId).toBe("test-session-123");
    });

    it("should create valid CacheInvalidatedMessage", () => {
      const message: CacheInvalidatedMessage = {
        type: MessageType.CACHE_INVALIDATED,
        timestamp: "2024-01-01T03:00:00Z",
        id: "msg-126",
        payload: {
          scope: "session",
          sessionIds: ["test-session-123"],
          reason: "Session updated",
        },
      };

      expect(message.type).toBe(MessageType.CACHE_INVALIDATED);
      expect(message.payload.scope).toBe("session");
      expect(message.payload.sessionIds).toEqual(["test-session-123"]);
    });
  });

  describe("SessionData interface", () => {
    it("should accept minimal session data", () => {
      const sessionData: SessionData = {
        sessionId: "minimal-session",
      };

      expect(sessionData.sessionId).toBe("minimal-session");
    });

    it("should accept full session data", () => {
      const sessionData: SessionData = {
        sessionId: "full-session",
        title: "Full Session",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
        status: "active",
        metadata: {
          projectPath: "/test/project",
          version: "1.0.0",
        },
      };

      expect(sessionData.sessionId).toBe("full-session");
      expect(sessionData.title).toBe("Full Session");
      expect(sessionData.metadata).toEqual({
        projectPath: "/test/project",
        version: "1.0.0",
      });
    });
  });

  describe("MessageError interface", () => {
    it("should create valid message error", () => {
      const error: MessageError = {
        code: MessageErrorCode.INVALID_FORMAT,
        message: "Invalid message format",
        originalMessage: { invalid: "data" },
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(error.code).toBe(MessageErrorCode.INVALID_FORMAT);
      expect(error.message).toBe("Invalid message format");
      expect(error.originalMessage).toEqual({ invalid: "data" });
    });

    it("should create error without original message", () => {
      const error: MessageError = {
        code: MessageErrorCode.PROCESSING_ERROR,
        message: "Processing failed",
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(error.code).toBe(MessageErrorCode.PROCESSING_ERROR);
      expect(error.originalMessage).toBeUndefined();
    });
  });
});
