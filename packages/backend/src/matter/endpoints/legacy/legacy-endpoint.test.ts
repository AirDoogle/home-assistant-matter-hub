import type {
  HomeAssistantEntityRegistry,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import { describe, expect, it, vi } from "vitest";
import type { BridgeRegistry } from "../../../services/bridges/bridge-registry.js";
import { LegacyEndpoint } from "./legacy-endpoint.js";

function registryFor(entityId: string, state: string) {
  const entity: HomeAssistantEntityRegistry = {
    id: entityId,
    device_id: `${entityId}_device`,
    entity_id: entityId,
    categories: {},
    has_entity_name: false,
    original_name: entityId,
    platform: "test",
    unique_id: entityId,
  };
  const initialState: HomeAssistantEntityState = {
    entity_id: entityId,
    state,
    context: { id: "context" },
    last_changed: "any-change",
    last_updated: "any-update",
    attributes: {},
  };
  return {
    deviceOf: vi.fn(() => undefined),
    initialState: vi.fn(() => initialState),
    entity: vi.fn(() => entity),
  };
}

describe("LegacyEndpoint.create", () => {
  it.each([
    ["light.kitchen", "on"],
    ["switch.lamp", "off"],
    ["input_boolean.guest_mode", "off"],
    ["script.movie_mode", "off"],
    ["scene.evening", "scening"],
    ["automation.goodnight", "on"],
    ["button.restart", "unknown"],
    ["input_button.doorbell", "unknown"],
  ])("should create an endpoint for %s", async (entityId, state) => {
    const registry = registryFor(entityId, state);
    const endpoint = await LegacyEndpoint.create(
      registry as unknown as BridgeRegistry,
      entityId,
    );
    expect(endpoint).toBeInstanceOf(LegacyEndpoint);
    expect(endpoint?.entityId).toEqual(entityId);
  });

  it.each([
    ["lock.front_door", "locked"],
    ["cover.garage", "closed"],
    ["climate.living_room", "heat"],
    ["fan.bedroom", "off"],
    ["media_player.tv", "off"],
    ["vacuum.robot", "docked"],
    ["humidifier.bedroom", "off"],
    ["sensor.temperature", "21"],
    ["binary_sensor.door", "off"],
  ])("should never create an endpoint for %s", async (entityId, state) => {
    const registry = registryFor(entityId, state);
    const endpoint = await LegacyEndpoint.create(
      registry as unknown as BridgeRegistry,
      entityId,
    );
    expect(endpoint).toBeUndefined();
    expect(registry.initialState).not.toHaveBeenCalled();
  });
});
