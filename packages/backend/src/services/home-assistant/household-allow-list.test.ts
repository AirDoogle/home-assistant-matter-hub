import { describe, expect, it } from "vitest";
import { isAllowedAction, isAllowedDomain } from "./household-allow-list.js";

describe("isAllowedDomain", () => {
  it.each([
    "light.kitchen",
    "switch.lamp",
    "input_boolean.guest_mode",
    "script.movie_mode",
    "scene.evening",
    "automation.goodnight",
    "button.restart",
    "input_button.doorbell",
  ])("should allow %s", (entityId) => {
    expect(isAllowedDomain(entityId)).toBe(true);
  });

  it.each([
    "lock.front_door",
    "cover.garage",
    "climate.living_room",
    "media_player.tv",
    "vacuum.robot",
    "alarm_control_panel.home",
    "shell_command.anything",
    "light",
    "",
  ])("should refuse %s", (entityId) => {
    expect(isAllowedDomain(entityId)).toBe(false);
  });
});

describe("isAllowedAction", () => {
  it.each([
    ["light.turn_on", "light.kitchen"],
    ["light.turn_off", "light.kitchen"],
    ["homeassistant.turn_on", "switch.lamp"],
    ["homeassistant.turn_off", "switch.lamp"],
    ["homeassistant.turn_on", "input_boolean.guest_mode"],
    ["homeassistant.turn_off", "input_boolean.guest_mode"],
    ["script.turn_on", "script.movie_mode"],
    ["script.turn_off", "script.movie_mode"],
    ["scene.turn_on", "scene.evening"],
    ["automation.trigger", "automation.goodnight"],
    ["button.press", "button.restart"],
    ["input_button.press", "input_button.doorbell"],
  ])("should allow %s on %s", (action, entityId) => {
    expect(isAllowedAction(action, { entity_id: entityId })).toBe(true);
    expect(isAllowedAction(action, { entity_id: [entityId] })).toBe(true);
  });

  it.each([
    // actions that are not on the list at all
    ["lock.unlock", "lock.front_door"],
    ["cover.open_cover", "cover.garage"],
    ["shell_command.run", "shell_command.run"],
    ["homeassistant.restart", "switch.lamp"],
    ["script.reload", "script.movie_mode"],
    ["light.toggle", "light.kitchen"],
    // allowed actions aimed at an entity of another domain
    ["homeassistant.turn_on", "lock.front_door"],
    ["homeassistant.turn_off", "light.kitchen"],
    ["light.turn_on", "switch.lamp"],
    ["script.turn_on", "automation.goodnight"],
    ["automation.trigger", "script.movie_mode"],
  ])("should refuse %s on %s", (action, entityId) => {
    expect(isAllowedAction(action, { entity_id: entityId })).toBe(false);
  });

  it("should refuse when any one of several entities is not allowed", () => {
    expect(
      isAllowedAction("homeassistant.turn_on", {
        entity_id: ["switch.lamp", "lock.front_door"],
      }),
    ).toBe(false);
  });

  it("should refuse a target without entities", () => {
    expect(isAllowedAction("light.turn_on", {})).toBe(false);
    expect(isAllowedAction("light.turn_on", { entity_id: [] })).toBe(false);
  });

  it("should refuse targets that are not entities", () => {
    expect(isAllowedAction("light.turn_on", { area_id: "kitchen" })).toBe(
      false,
    );
    expect(
      isAllowedAction("light.turn_on", {
        entity_id: "light.kitchen",
        device_id: "abc",
      }),
    ).toBe(false);
    expect(
      isAllowedAction("light.turn_on", {
        entity_id: "light.kitchen",
        label_id: ["all_lights"],
      }),
    ).toBe(false);
  });
});
