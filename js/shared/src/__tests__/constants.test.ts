import {
  MESSAGE_TYPES,
  CONTENT_TYPES,
  TODO_STATUSES,
  TODO_PRIORITIES,
  API_ENDPOINTS,
  PAGINATION_DEFAULTS,
} from "../constants";

describe("Shared Constants", () => {
  describe("MESSAGE_TYPES", () => {
    it("should have correct message type values", () => {
      expect(MESSAGE_TYPES.USER).toBe("user");
      expect(MESSAGE_TYPES.ASSISTANT).toBe("assistant");
      expect(MESSAGE_TYPES.SYSTEM).toBe("system");
      expect(MESSAGE_TYPES.SUMMARY).toBe("summary");
    });
  });

  describe("CONTENT_TYPES", () => {
    it("should have correct content type values", () => {
      expect(CONTENT_TYPES.TEXT).toBe("text");
      expect(CONTENT_TYPES.TOOL_USE).toBe("tool_use");
      expect(CONTENT_TYPES.TOOL_RESULT).toBe("tool_result");
      expect(CONTENT_TYPES.THINKING).toBe("thinking");
      expect(CONTENT_TYPES.IMAGE).toBe("image");
    });
  });

  describe("TODO_STATUSES", () => {
    it("should have correct todo status values", () => {
      expect(TODO_STATUSES.PENDING).toBe("pending");
      expect(TODO_STATUSES.IN_PROGRESS).toBe("in_progress");
      expect(TODO_STATUSES.COMPLETED).toBe("completed");
    });
  });

  describe("TODO_PRIORITIES", () => {
    it("should have correct priority values", () => {
      expect(TODO_PRIORITIES.HIGH).toBe("high");
      expect(TODO_PRIORITIES.MEDIUM).toBe("medium");
      expect(TODO_PRIORITIES.LOW).toBe("low");
    });
  });

  describe("API_ENDPOINTS", () => {
    it("should have correct API endpoint paths", () => {
      expect(API_ENDPOINTS.SESSIONS).toBe("/api/sessions");
      expect(API_ENDPOINTS.TRANSCRIPTS).toBe("/api/transcripts");
      expect(API_ENDPOINTS.PROJECTS).toBe("/api/projects");
      expect(API_ENDPOINTS.HEALTH).toBe("/health");
    });
  });

  describe("PAGINATION_DEFAULTS", () => {
    it("should have sensible pagination defaults", () => {
      expect(PAGINATION_DEFAULTS.PAGE).toBe(1);
      expect(PAGINATION_DEFAULTS.LIMIT).toBe(50);
      expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBe(1000);
    });
  });

  describe("Constants Type Safety", () => {
    it("should have consistent string values", () => {
      // Verify constants are string literals
      expect(typeof MESSAGE_TYPES.USER).toBe("string");
      expect(typeof CONTENT_TYPES.TEXT).toBe("string");
      expect(typeof TODO_STATUSES.PENDING).toBe("string");
    });
  });
});
