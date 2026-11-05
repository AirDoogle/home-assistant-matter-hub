import { getStates } from "home-assistant-js-websocket";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeAssistantClient } from "./home-assistant-client.js";
import { HomeAssistantRegistry } from "./home-assistant-registry.js";

vi.mock("home-assistant-js-websocket", () => ({
  getStates: vi.fn(async () => []),
}));
vi.mock("./api/get-registry.js", () => ({
  getRegistry: vi.fn(async () => []),
  getDeviceRegistry: vi.fn(async () => []),
}));

const client = { connection: {} } as unknown as HomeAssistantClient;
let registry: HomeAssistantRegistry;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  registry = new HomeAssistantRegistry(client, {
    url: "http://supervisor/core",
    accessToken: "unused",
    refreshInterval: 30,
  });
  await registry.construction;
});

afterEach(() => {
  registry.disableAutoRefresh();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("HomeAssistantRegistry.enableAutoRefresh", () => {
  it("should survive a failed reload and refresh next tick", async () => {
    const onRefresh = vi.fn(async () => {});
    vi.mocked(getStates).mockRejectedValueOnce({ code: 3 });
    registry.enableAutoRefresh(onRefresh);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(onRefresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("should survive a refresh that throws", async () => {
    const onRefresh = vi.fn(async () => {
      throw new Error("endpoint creation failed");
    });
    registry.enableAutoRefresh(onRefresh);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("should not start a tick while the previous one is running", async () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    registry.enableAutoRefresh(onRefresh);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
