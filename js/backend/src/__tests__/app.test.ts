import request from "supertest";
import app from "../app";

describe("Express App", () => {
  describe("GET /health", () => {
    it("should return health check response", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: "healthy",
          environment: "test",
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe("GET /api", () => {
    it("should return API information", async () => {
      const response = await request(app).get("/api").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Claude Code Log API",
        version: "1.0.0",
        timestamp: expect.any(String),
      });
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/nonexistent").expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: "Route /nonexistent not found",
        timestamp: expect.any(String),
      });
    });
  });

  describe("CORS headers", () => {
    it("should block disallowed origins in test environment", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://malicious-site.com")
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should allow requests with no origin header", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
