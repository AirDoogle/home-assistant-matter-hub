import { describe, expect, it, vi } from "vitest";
import { BridgeRegistry } from "../../services/bridges/bridge-registry.js";
import { HomeAssistantActions } from "../../services/home-assistant/home-assistant-actions.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";

function callActionAs(entityId: string, exposed: boolean) {
  const actions = { call: vi.fn() };
  const registry = { entity: vi.fn(() => (exposed ? {} : undefined)) };
  const services = new Map<unknown, unknown>([
    [BridgeRegistry, registry],
    [HomeAssistantActions, actions],
  ]);
  const env = { get: (type: unknown) => services.get(type) };
  const self = { entityId, env };
  HomeAssistantEntityBehavior.prototype.callAction.call(
    self as unknown as HomeAssistantEntityBehavior,
    { action: "switch.turn_on" },
  );
  return { actions, registry };
}

describe("HomeAssistantEntityBehavior.callAction", () => {
  it("should pass on an action for an entity the bridge exposes", () => {
    const { actions, registry } = callActionAs("switch.lamp", true);
    expect(registry.entity).toHaveBeenCalledWith("switch.lamp");
    expect(actions.call).toHaveBeenCalledWith(
      { action: "switch.turn_on" },
      "switch.lamp",
    );
  });

  it("should refuse an action for an entity no longer exposed", () => {
    const { actions } = callActionAs("switch.lamp", false);
    expect(actions.call).not.toHaveBeenCalled();
  });
});
