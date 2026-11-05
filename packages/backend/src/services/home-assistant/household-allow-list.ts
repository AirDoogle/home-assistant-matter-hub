import type { HassServiceTarget } from "home-assistant-js-websocket/dist/types.js";

/**
 * This fork serves one household, which exposes only these domains to
 * Matter. See FORK.md.
 */
export const allowedDomains: ReadonlySet<string> = new Set([
  "light",
  "switch",
  "input_boolean",
  "script",
  "scene",
  "automation",
  "button",
  "input_button",
]);

/**
 * Every Home Assistant action the endpoints of the allowed domains call,
 * each with the entity domains it may target. Derived from the callers in
 * matter/endpoints/legacy/{light,switch,script,scene,automation,button,
 * input-button} and matter/behaviors/on-off-server.ts.
 */
const allowedActions: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  // light: on/off, level and colour all call light.turn_*
  ["light.turn_on", new Set(["light"])],
  ["light.turn_off", new Set(["light"])],
  // switch and input_boolean use the OnOffServer default actions
  ["homeassistant.turn_on", new Set(["switch", "input_boolean"])],
  ["homeassistant.turn_off", new Set(["switch", "input_boolean"])],
  ["script.turn_on", new Set(["script"])],
  ["script.turn_off", new Set(["script"])],
  ["scene.turn_on", new Set(["scene"])],
  ["automation.trigger", new Set(["automation"])],
  ["button.press", new Set(["button"])],
  ["input_button.press", new Set(["input_button"])],
]);

export function domainOf(entityId: string): string {
  return entityId.split(".")[0];
}

export function isAllowedDomain(entityId: string): boolean {
  return allowedDomains.has(domainOf(entityId));
}

/**
 * True only if `action` (as "domain.service") is on the list and the target
 * names one or more entities, all of a domain that action may target, and
 * nothing else (no devices, areas, floors or labels).
 */
export function isAllowedAction(
  action: string,
  target: HassServiceTarget,
): boolean {
  const domains = allowedActions.get(action);
  if (!domains) {
    return false;
  }
  const { entity_id, ...others } = target;
  if (Object.values(others).some((value) => value != null)) {
    return false;
  }
  const entityIds = entity_id == null ? [] : [entity_id].flat();
  return (
    entityIds.length > 0 &&
    entityIds.every((entityId) => domains.has(domainOf(entityId)))
  );
}
