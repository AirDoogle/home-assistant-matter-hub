import type {
  HomeAssistantEntityInformation,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import type { Agent, EndpointType } from "@matter/main";
import { describe, expect, it } from "vitest";
import type { OnOffConfig } from "../../behaviors/on-off-server.js";
import { AutomationDevice } from "./automation/index.js";
import { ButtonDevice } from "./button/index.js";
import { InputButtonDevice } from "./input-button/index.js";
import { SceneDevice } from "./scene/index.js";
import { ScriptDevice } from "./script/index.js";

const agent = {} as Agent;

function state(entityId: string, value: string): HomeAssistantEntityState {
  return {
    entity_id: entityId,
    state: value,
    context: { id: "context" },
    last_changed: "any-change",
    last_updated: "any-update",
    attributes: {},
  };
}

function onOffConfig(
  device: (e: { entity: HomeAssistantEntityInformation }) => EndpointType,
  entityId: string,
): OnOffConfig {
  const type = device({
    entity: { entity_id: entityId, state: state(entityId, "off") },
  });
  const onOff = type.behaviors.onOff as unknown as {
    defaults: { config: OnOffConfig };
  };
  return onOff.defaults.config;
}

describe.each([
  [ScriptDevice, "script.movie_mode", "script.turn_on", ["on", "off"]],
  [SceneDevice, "scene.evening", "scene.turn_on", ["scening", "unknown"]],
  [
    AutomationDevice,
    "automation.goodnight",
    "automation.trigger",
    ["on", "off"],
  ],
  [
    ButtonDevice,
    "button.restart",
    "button.press",
    ["2026-11-05T21:00:00+00:00", "unknown"],
  ],
  [
    InputButtonDevice,
    "input_button.doorbell",
    "input_button.press",
    ["2026-11-05T21:00:00+00:00", "unknown"],
  ],
] as const)("%o %s", (device, entityId, action, states) => {
  const config = onOffConfig(device, entityId);

  it(`should call ${action} on ON`, () => {
    expect(config.turnOn?.(undefined, agent)).toEqual({ action });
  });

  it("should call nothing on OFF", () => {
    expect(config.turnOff).toBeNull();
  });

  it("should always report OFF, whatever the entity's state", () => {
    for (const value of states) {
      expect(config.isOn?.(state(entityId, value), agent)).toBe(false);
    }
  });
});
