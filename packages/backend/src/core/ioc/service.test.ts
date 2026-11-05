import { afterEach, describe, expect, it, vi } from "vitest";
import { Service } from "./service.js";

class FailingService extends Service {
  constructor() {
    super("FailingService");
  }
  protected override async initialize(): Promise<void> {
    throw new Error("Authentication failed");
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Service", () => {
  it("should log and exit when initialization fails", async () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as typeof process.exit);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    new FailingService();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      "Failed to initialize FailingService:",
      expect.any(Error),
    );
  });
});
