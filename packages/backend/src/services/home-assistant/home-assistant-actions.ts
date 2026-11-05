import type { Logger } from "@matter/general";
import { callService } from "home-assistant-js-websocket";
import type { HassServiceTarget } from "home-assistant-js-websocket/dist/types.js";
import type { LoggerService } from "../../core/app/logger.js";
import { Service } from "../../core/ioc/service.js";
import { DebounceContext } from "../../utils/debounce-context.js";
import type { HomeAssistantClient } from "./home-assistant-client.js";
import { isAllowedAction } from "./household-allow-list.js";

export interface HomeAssistantAction {
  action: string;
  data?: object | undefined;
}

interface HomeAssistantActionCall extends HomeAssistantAction {
  entityId: string;
}

export class HomeAssistantActions extends Service {
  private readonly log: Logger;
  private readonly debounceContext = new DebounceContext(
    this.processAction.bind(this),
  );

  constructor(
    logger: LoggerService,
    private readonly client: HomeAssistantClient,
  ) {
    super("HomeAssistantActions");
    this.log = logger.get(this);
  }

  private async processAction(_key: string, calls: HomeAssistantActionCall[]) {
    const entity_id = calls[0].entityId;
    const action = calls[0].action;
    const data = Object.assign({}, ...calls.map((c) => c.data));
    const parts = action.split(".");
    if (parts.length !== 2) {
      // "light.turn_on.x" would otherwise be checked as light.turn_on.
      this.log.warn(`Refused malformed action '${action}' for ${entity_id}`);
      return;
    }
    const [domain, actionName] = parts;
    // Nothing awaits this call, so a rejection here (Home Assistant refusing
    // the action, or a lost connection) would be unhandled and end the
    // process. Log it instead.
    try {
      await this.callAction(domain, actionName, data, { entity_id }, false);
    } catch (error) {
      this.log.error(
        `Action '${action}' for ${entity_id} failed: ${(error as { message?: string })?.message ?? JSON.stringify(error)}`,
      );
    }
  }

  call(action: HomeAssistantAction, entityId: string) {
    const key = `${entityId}-${action.action}`;
    this.debounceContext.get(key, 100)({ ...action, entityId });
  }

  async callAction<T = void>(
    domain: string,
    action: string,
    data: object | undefined,
    target: HassServiceTarget,
    returnResponse?: boolean,
  ): Promise<T | undefined> {
    if (!isAllowedAction(`${domain}.${action}`, target, data)) {
      this.log.warn(
        `Refused action '${domain}.${action}' for target ${JSON.stringify(target)}: not on this fork's allow-list`,
      );
      return undefined;
    }
    this.log.debug(
      `Calling action '${domain}.${action}' for target ${JSON.stringify(target)} with data ${JSON.stringify(data ?? {})}`,
    );
    const result = await callService(
      this.client.connection,
      domain,
      action,
      data,
      target,
      returnResponse,
    );
    return result as T;
  }

  override async dispose(): Promise<void> {
    this.debounceContext.unregisterAll();
  }
}
