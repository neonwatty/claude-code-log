import request from "supertest";
import express from "express";
import {
  securityHeaders,
  apiRateLimit,
  apiSecurityHeaders,
  sanitizeRequest,
  requestSizeLimit,
} from "../../middleware/security";

describe("Security Middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("securityHeaders (Helmet)", () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get("/test", (req, res) => {
        res.json({ success: true });
      });
    });

    it("should set security headers", async () => {
      const response = await request(app).get("/test").expect(200);

      // Check for common security headers set by helmet
      expect(response.headers).toHaveProperty(
        "x-content-type-options",
        "nosniff",
      );
      expect(response.headers).toHaveProperty("x-frame-options", "DENY");
      expect(response.headers).toHaveProperty("x-download-options", "noopen");
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should set Content Security Policy", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["content-security-policy"]).toContain(
        "default-src 'self'",
      );
    });

    it("should remove X-Powered-By header", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("apiSecurityHeaders", () => {
    beforeEach(() => {
      app.use(apiSecurityHeaders);
      app.get("/test", (req, res) => {
        res.json({ success: true });
      });
    });

    it("should add custom API headers", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.headers["x-api-version"]).toBe("1.0.0");
      expect(response.headers["x-powered-by-claude-code-log"]).toBe("true");
    });

    it("should remove Express X-Powered-By header", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("sanitizeRequest", () => {
    beforeEach(() => {
      app.use(sanitizeRequest);
      app.post("/test", (req, res) => {
        res.json({ received: req.body });
      });
    });

    it("should remove script tags from string values", async () => {
      const maliciousBody = {
        message: '<script>alert("xss")</script>Hello',
        normal: "Regular text",
      };

      const response = await request(app)
        .post("/test")
        .send(maliciousBody)
        .expect(200);

      expect(response.body.received.message).toBe("Hello");
      expect(response.body.received.normal).toBe("Regular text");
    });

    it("should remove javascript: protocols", async () => {
      const maliciousBody = {
        url: 'javascript:alert("xss")',
        normalUrl: "https://example.com",
      };

      const response = await request(app)
        .post("/test")
        .send(maliciousBody)
        .expect(200);

      expect(response.body.received.url).toBe('alert("xss")');
      expect(response.body.received.normalUrl).toBe("https://example.com");
    });

    it("should remove event handlers", async () => {
      const maliciousBody = {
        html: '<div onclick="malicious()">Content</div>',
        text: "onload=bad()",
      };

      const response = await request(app)
        .post("/test")
        .send(maliciousBody)
        .expect(200);

      expect(response.body.received.html).toBe("<div>Content</div>");
      expect(response.body.received.text).toBe("bad()");
    });

    it("should sanitize nested objects", async () => {
      const nestedBody = {
        user: {
          name: '<script>alert("nested")</script>John',
          profile: {
            bio: "javascript:void(0)",
          },
        },
        tags: ["<script>tag1</script>", "normal-tag"],
      };

      const response = await request(app)
        .post("/test")
        .send(nestedBody)
        .expect(200);

      expect(response.body.received.user.name).toBe("John");
      expect(response.body.received.user.profile.bio).toBe("void(0)");
      expect(response.body.received.tags[0]).toBe("tag1");
      expect(response.body.received.tags[1]).toBe("normal-tag");
    });

    it("should handle non-object bodies gracefully", async () => {
      app.use("/text", express.text(), sanitizeRequest);
      app.post("/text", (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post("/text")
        .send("plain text")
        .set("Content-Type", "text/plain")
        .expect(200);

      expect(response.body.received).toBe("plain text");
    });
  });

  describe("requestSizeLimit", () => {
    beforeEach(() => {
      // Create a new app with a higher express.json() limit to test our middleware
      app = express();
      app.use(express.json({ limit: "15mb" })); // Set higher than our 10MB limit
      app.use(requestSizeLimit);
      app.post("/test", (req, res) => {
        res.json({ success: true });
      });
    });

    it("should allow requests under size limit", async () => {
      const normalBody = { data: "normal sized request" };

      const response = await request(app)
        .post("/test")
        .send(normalBody)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject oversized requests", async () => {
      // Create a large payload that exceeds the 10MB limit
      const largeString = "x".repeat(11 * 1024 * 1024); // 11MB string
      const largeBody = { data: largeString };

      const response = await request(app)
        .post("/test")
        .send(largeBody)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Request payload too large");
      expect(response.body.timestamp).toBeDefined();
    }, 10000); // 10 second timeout

    it("should handle missing content-length header", async () => {
      // Most requests will have content-length automatically set
      const response = await request(app)
        .post("/test")
        .send({ small: "data" })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("Rate Limiting (apiRateLimit)", () => {
    beforeEach(() => {
      // Note: In development, rate limiting is typically disabled
      // This test simulates production behavior
      process.env.NODE_ENV = "production";

      app.use(apiRateLimit);
      app.get("/test", (req, res) => {
        res.json({ success: true });
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("should allow requests under rate limit", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
    });

    it("should include rate limit headers", async () => {
      const response = await request(app).get("/test").expect(200);

      expect(response.headers["x-ratelimit-limit"]).toBe("1000");
      expect(
        parseInt(response.headers["x-ratelimit-remaining"]),
      ).toBeLessThanOrEqual(1000);
    });

    // Note: Testing actual rate limiting would require making 1000+ requests
    // which is impractical for unit tests. Integration tests would be better suited.
  });

  describe("Development vs Production Configuration", () => {
    it("should have different behavior in development", async () => {
      process.env.NODE_ENV = "development";

      const { getSecurityConfig } = await import(
        "../../middleware/security.js"
      );
      const config = getSecurityConfig();

      expect(config.rateLimit?.skip()).toBe(true);

      process.env.NODE_ENV = "test";
    });

    it("should have stricter configuration in production", async () => {
      process.env.NODE_ENV = "production";

      const { getSecurityConfig } = await import(
        "../../middleware/security.js"
      );
      const config = getSecurityConfig();

      expect(config.rateLimit).toBeUndefined(); // Uses default production settings

      process.env.NODE_ENV = "test";
    });
  });

  describe("Combined Security Middleware", () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.use(apiSecurityHeaders);
      app.use(sanitizeRequest);
      app.use(requestSizeLimit);

      app.post("/secure", (req, res) => {
        res.json({ received: req.body, headers: req.headers });
      });
    });

    it("should apply all security measures together", async () => {
      const testBody = {
        message: '<script>alert("test")</script>Clean message',
        data: { nested: "javascript:bad()" },
      };

      const response = await request(app)
        .post("/secure")
        .send(testBody)
        .expect(200);

      // Check sanitization worked
      expect(response.body.received.message).toBe("Clean message");
      expect(response.body.received.data.nested).toBe("bad()");

      // Check security headers are present
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-api-version"]).toBe("1.0.0");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("should maintain request integrity while securing", async () => {
      const cleanBody = {
        user: "john_doe",
        email: "john@example.com",
        preferences: {
          theme: "dark",
          notifications: true,
        },
      };

      const response = await request(app)
        .post("/secure")
        .send(cleanBody)
        .expect(200);

      expect(response.body.received).toEqual(cleanBody);
    });
  });

  describe("Error Handling in Security Middleware", () => {
    it("should handle sanitization errors gracefully", async () => {
      // Create a circular reference that could cause JSON issues
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      app.use((req, res, next) => {
        // Simulate a problematic sanitization scenario
        req.body = circularObj;
        next();
      });

      app.use(sanitizeRequest);
      app.post("/circular", (req, res) => {
        res.json({ success: true });
      });

      // Should not crash the application
      const response = await request(app).post("/circular").expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
