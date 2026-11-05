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
    "light.",
    ".kitchen",
    "light.kitchen.extra",
    "Light.Kitchen",
    "",
  ])("should refuse %s", (entityId) => {
    expect(isAllowedDomain(entityId)).toBe(false);
  });
});

describe("isAllowedAction", () => {
  it.each([
    ["light.turn_on", "light.kitchen"],
    ["light.turn_off", "light.kitchen"],
    ["switch.turn_on", "switch.lamp"],
    ["switch.turn_off", "switch.lamp"],
    ["input_boolean.turn_on", "input_boolean.guest_mode"],
    ["input_boolean.turn_off", "input_boolean.guest_mode"],
    ["script.turn_on", "script.movie_mode"],
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
    ["homeassistant.turn_on", "switch.lamp"],
    ["homeassistant.turn_off", "input_boolean.guest_mode"],
    ["script.reload", "script.movie_mode"],
    ["script.turn_off", "script.movie_mode"],
    ["light.toggle", "light.kitchen"],
    // allowed actions aimed at an entity of another domain
    ["switch.turn_on", "input_boolean.guest_mode"],
    ["input_boolean.turn_off", "switch.lamp"],
    ["light.turn_on", "switch.lamp"],
    ["script.turn_on", "automation.goodnight"],
    ["automation.trigger", "script.movie_mode"],
    // malformed entity ids
    ["light.turn_on", "light"],
    ["light.turn_on", "light.kitchen,lock.front_door"],
  ])("should refuse %s on %s", (action, entityId) => {
    expect(isAllowedAction(action, { entity_id: entityId })).toBe(false);
  });

  it("should refuse when any one of several entities is not allowed", () => {
    expect(
      isAllowedAction("switch.turn_on", {
        entity_id: ["switch.lamp", "switch.lock_power"],
      }),
    ).toBe(true);
    expect(
      isAllowedAction("switch.turn_on", {
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

  it("should allow only the light data keys the light behaviours send", () => {
    const target = { entity_id: "light.kitchen" };
    expect(isAllowedAction("light.turn_on", target, {})).toBe(true);
    expect(
      isAllowedAction("light.turn_on", target, {
        brightness: 128,
        color_temp_kelvin: 2700,
        hs_color: [30, 60],
      }),
    ).toBe(true);
    expect(isAllowedAction("light.turn_on", target, { flash: "long" })).toBe(
      false,
    );
    expect(isAllowedAction("light.turn_off", target, { transition: 9 })).toBe(
      false,
    );
  });

  it("should refuse data on actions that take none", () => {
    expect(
      isAllowedAction(
        "script.turn_on",
        { entity_id: "script.movie_mode" },
        { variables: { x: 1 } },
      ),
    ).toBe(false);
    expect(
      isAllowedAction("switch.turn_on", { entity_id: "switch.lamp" }, {}),
    ).toBe(true);
  });
});
