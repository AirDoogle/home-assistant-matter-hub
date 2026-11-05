import {
  ClusterId,
  type HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import { Behavior, EventEmitter } from "@matter/main";
import { BridgeRegistry } from "../../services/bridges/bridge-registry.js";
import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../services/home-assistant/home-assistant-actions.js";
import { AsyncObservable } from "../../utils/async-observable.js";

const logger = Logger.get("HomeAssistantEntityBehavior");

export class HomeAssistantEntityBehavior extends Behavior {
  static override readonly id = ClusterId.homeAssistantEntity;
  declare state: HomeAssistantEntityBehavior.State;
  declare events: HomeAssistantEntityBehavior.Events;

  get entityId(): string {
    return this.entity.entity_id;
  }

  get entity(): HomeAssistantEntityInformation {
    return this.state.entity;
  }

  get onChange(): HomeAssistantEntityBehavior.Events["entity$Changed"] {
    return this.events.entity$Changed;
  }

  get isAvailable(): boolean {
    return (
      this.entity.state.state !== "unavailable" &&
      this.entity.state.state !== "unknown"
    );
  }

  callAction(action: HomeAssistantAction) {
    // Only for an entity this bridge exposes right now; the action itself is
    // checked again against the allow-list in HomeAssistantActions.
    if (!this.env.get(BridgeRegistry).entity(this.entityId)) {
      logger.warn(
        `Refused action '${action.action}' for ${this.entityId}: not exposed by this bridge`,
      );
      return;
    }
    const actions = this.env.get(HomeAssistantActions);
    actions.call(action, this.entityId);
  }
}

export namespace HomeAssistantEntityBehavior {
  export class State {
    entity!: HomeAssistantEntityInformation;
  }

  export class Events extends EventEmitter {
    entity$Changed = AsyncObservable<HomeAssistantEntityInformation>();
  }
}
