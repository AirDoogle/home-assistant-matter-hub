import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { OnOffServer } from "../../../behaviors/on-off-server.js";

// Momentary, like scene and automation: ON runs the script and the plug
// never reports ON, so an Echo never sees the on/off report pair that can
// wedge it (RiDDiX #423). OFF does nothing.
const ScriptOnOffServer = OnOffServer({
  isOn: () => false,
  turnOn: () => ({
    action: "script.turn_on",
  }),
  turnOff: null,
}).with("Lighting");

const ScriptDeviceType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  ScriptOnOffServer,
);

export function ScriptDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return ScriptDeviceType.set({ homeAssistantEntity });
}
