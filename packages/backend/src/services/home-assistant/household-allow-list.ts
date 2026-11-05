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
 * each with the service data keys it may carry. Derived from the callers in
 * matter/endpoints/legacy/{light,switch,input-boolean,script,scene,
 * automation,button,input-button}. An action may only target entities of
 * its own domain.
 */
const allowedActions: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  // light-level-control-server sends brightness, light-color-control-server
  // color_temp_kelvin or hs_color; light-on-off-server sends no data.
  ["light.turn_on", new Set(["brightness", "color_temp_kelvin", "hs_color"])],
  ["light.turn_off", new Set<string>()],
  ["switch.turn_on", new Set<string>()],
  ["switch.turn_off", new Set<string>()],
  ["input_boolean.turn_on", new Set<string>()],
  ["input_boolean.turn_off", new Set<string>()],
  ["script.turn_on", new Set<string>()],
  ["scene.turn_on", new Set<string>()],
  ["automation.trigger", new Set<string>()],
  ["button.press", new Set<string>()],
  ["input_button.press", new Set<string>()],
]);

/**
 * The domain of a well-formed entity id ("light.kitchen" -> "light"), or
 * undefined for anything that is not one.
 */
export function domainOf(entityId: string): string | undefined {
  return /^([a-z0-9_]+)\.[a-z0-9_]+$/.exec(entityId)?.[1];
}

export function isAllowedDomain(entityId: string): boolean {
  const domain = domainOf(entityId);
  return domain !== undefined && allowedDomains.has(domain);
}

/**
 * True only if `action` (as "domain.service") is on the list, its data
 * carries only the keys allowed for it, and the target names one or more
 * entities, all of the action's own domain, and nothing else (no devices,
 * areas, floors or labels).
 */
export function isAllowedAction(
  action: string,
  target: HassServiceTarget,
  data?: object,
): boolean {
  const dataKeys = allowedActions.get(action);
  if (!dataKeys || Object.keys(data ?? {}).some((k) => !dataKeys.has(k))) {
    return false;
  }
  const actionDomain = action.split(".")[0];
  const { entity_id, ...others } = target;
  if (Object.values(others).some((value) => value != null)) {
    return false;
  }
  const entityIds = entity_id == null ? [] : [entity_id].flat();
  return (
    entityIds.length > 0 &&
    entityIds.every((entityId) => domainOf(entityId) === actionDomain)
  );
}
