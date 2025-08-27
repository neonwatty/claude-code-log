import { IApiResponse } from "../../../shared/src";

describe("Backend Type Safety", () => {
  describe("IApiResponse interface", () => {
    it("should accept successful response structure", () => {
      const response: IApiResponse = {
        success: true,
        data: { message: "test" },
        timestamp: new Date().toISOString(),
      };

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ message: "test" });
      expect(typeof response.timestamp).toBe("string");
    });

    it("should accept error response structure", () => {
      const response: IApiResponse = {
        success: false,
        error: "Test error",
        timestamp: new Date().toISOString(),
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Test error");
    });
  });
});
