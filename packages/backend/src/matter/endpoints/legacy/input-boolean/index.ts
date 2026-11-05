import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { OnOffServer } from "../../../behaviors/on-off-server.js";

const InputBooleanOnOffServer = OnOffServer({
  turnOn: () => ({
    action: "input_boolean.turn_on",
  }),
  turnOff: () => ({
    action: "input_boolean.turn_off",
  }),
}).with("Lighting");

const InputBooleanEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  InputBooleanOnOffServer,
);

export function InputBooleanDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return InputBooleanEndpointType.set({ homeAssistantEntity });
}
