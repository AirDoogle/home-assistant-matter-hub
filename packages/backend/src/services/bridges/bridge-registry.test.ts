import {
  type HomeAssistantEntityRegistry,
  type HomeAssistantFilter,
  HomeAssistantMatcherType,
} from "@home-assistant-matter-hub/common";
import { describe, expect, it } from "vitest";
import type { HomeAssistantRegistry } from "../home-assistant/home-assistant-registry.js";
import type { BridgeDataProvider } from "./bridge-data-provider.js";
import { BridgeRegistry } from "./bridge-registry.js";

function entity(entity_id: string, labels: string[] = []) {
  const registry: HomeAssistantEntityRegistry = {
    entity_id,
    device_id: `${entity_id}_device`,
    labels,
  };
  return registry;
}

function bridgeRegistry(filter: HomeAssistantFilter) {
  const entities = [
    entity("light.kitchen", ["alexa"]),
    entity("switch.lamp", ["alexa"]),
    entity("lock.front_door", ["alexa"]),
    entity("cover.garage", ["alexa"]),
    entity("light.hallway"),
  ];
  const registry = {
    entities: Object.fromEntries(entities.map((e) => [e.entity_id, e])),
    devices: {},
    states: {},
  } as unknown as HomeAssistantRegistry;
  const dataProvider = {
    filter,
    featureFlags: {},
  } as unknown as BridgeDataProvider;
  return new BridgeRegistry(registry, dataProvider);
}

const label = { type: HomeAssistantMatcherType.Label, value: "alexa" };

describe("BridgeRegistry", () => {
  it("should expose nothing when the include list is empty", () => {
    expect(bridgeRegistry({ include: [], exclude: [] }).entityIds).toEqual([]);
  });

  it("should expose only matching entities of the household's domains", () => {
    const registry = bridgeRegistry({ include: [label], exclude: [] });
    expect(registry.entityIds.sort()).toEqual(["light.kitchen", "switch.lamp"]);
  });

  it("should never expose other domains, even when included by domain", () => {
    const registry = bridgeRegistry({
      include: [
        { type: HomeAssistantMatcherType.Domain, value: "lock" },
        { type: HomeAssistantMatcherType.Pattern, value: "*" },
      ],
      exclude: [],
    });
    expect(registry.entityIds.sort()).toEqual([
      "light.hallway",
      "light.kitchen",
      "switch.lamp",
    ]);
  });

  it("should still apply the exclude list", () => {
    const registry = bridgeRegistry({
      include: [label],
      exclude: [{ type: HomeAssistantMatcherType.Domain, value: "switch" }],
    });
    expect(registry.entityIds).toEqual(["light.kitchen"]);
  });
});
