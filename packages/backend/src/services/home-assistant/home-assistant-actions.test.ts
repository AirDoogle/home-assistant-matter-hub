import { callService } from "home-assistant-js-websocket";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoggerService } from "../../core/app/logger.js";
import { HomeAssistantActions } from "./home-assistant-actions.js";
import type { HomeAssistantClient } from "./home-assistant-client.js";

vi.mock("home-assistant-js-websocket", () => ({
  callService: vi.fn(async () => undefined),
}));

const log = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
const loggerService = { get: () => log } as unknown as LoggerService;
const connection = {};
const client = { connection } as unknown as HomeAssistantClient;

function createActions() {
  return new HomeAssistantActions(loggerService, client);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomeAssistantActions.callAction", () => {
  it("should call an allowed action", async () => {
    await createActions().callAction(
      "light",
      "turn_on",
      { brightness: 128 },
      { entity_id: "light.kitchen" },
    );
    expect(callService).toHaveBeenCalledWith(
      connection,
      "light",
      "turn_on",
      { brightness: 128 },
      { entity_id: "light.kitchen" },
      undefined,
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("should refuse an unlisted action without throwing", async () => {
    const actions = createActions();
    const result = await actions.callAction("lock", "unlock", undefined, {
      entity_id: "lock.front_door",
    });
    expect(result).toBeUndefined();
    expect(callService).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it("should refuse an allowed action aimed at another domain", async () => {
    await createActions().callAction("homeassistant", "turn_on", undefined, {
      entity_id: "lock.front_door",
    });
    expect(callService).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
  });
});

describe("HomeAssistantActions.call", () => {
  it("should refuse a disallowed action from a Matter command", async () => {
    createActions().call({ action: "cover.open_cover" }, "cover.garage");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callService).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it("should pass an allowed action from a Matter command", async () => {
    createActions().call({ action: "scene.turn_on" }, "scene.evening");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callService).toHaveBeenCalledWith(
      connection,
      "scene",
      "turn_on",
      {},
      { entity_id: "scene.evening" },
      false,
    );
  });
});
