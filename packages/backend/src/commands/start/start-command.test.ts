import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArgumentsCamelCase } from "yargs";
import startCommand from "./start-command.js";
import { startHandler } from "./start-handler.js";
import type { StartOptions } from "./start-options.js";

vi.mock("./start-handler.js", () => ({
  startHandler: vi.fn(async () => {}),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("start command", () => {
  it("should exit with code 1 when start-up fails", async () => {
    vi.mocked(startHandler).mockRejectedValueOnce(new Error("EADDRINUSE"));
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as typeof process.exit);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const args = {} as ArgumentsCamelCase<StartOptions>;
    await startCommand().handler(args);

    expect(error).toHaveBeenCalledWith("Failed to start:", expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
