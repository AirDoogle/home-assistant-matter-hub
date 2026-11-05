import { describe, expect, it, vi } from "vitest";
import {
  logUnhandledRejections,
  unhandledRejectionLogger,
} from "./unhandled-rejections.js";

describe("unhandled rejections", () => {
  it("should log the reason at error level", () => {
    const log = { error: vi.fn() };
    const reason = { code: 3, message: "Connection lost" };
    unhandledRejectionLogger(log)(reason);
    expect(log.error).toHaveBeenCalledWith(
      "Unhandled promise rejection (process kept running):",
      reason,
    );
  });

  it("should install and remove a process listener", () => {
    const before = process.listenerCount("unhandledRejection");
    const remove = logUnhandledRejections({ error: vi.fn() });
    expect(process.listenerCount("unhandledRejection")).toEqual(before + 1);
    remove();
    expect(process.listenerCount("unhandledRejection")).toEqual(before);
  });
});
