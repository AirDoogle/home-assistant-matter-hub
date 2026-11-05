import type { BridgeData } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { Environment } from "@matter/main";
import { type Endpoint, ServerNode } from "@matter/main/node";
import { SessionManager } from "@matter/main/protocol";
import { closeActiveSessions } from "../../services/bridges/close-replaced-sessions.js";
import { createBridgeServerConfig } from "../../utils/json/create-bridge-server-config.js";

const logger = Logger.get("BridgeServerNode");

export class BridgeServerNode extends ServerNode {
  constructor(env: Environment, bridgeData: BridgeData, aggregator: Endpoint) {
    const config = createBridgeServerConfig(bridgeData);
    super({
      ...config,
      environment: env,
      parts: [...(config.parts ?? []), aggregator],
    });
  }

  /**
   * On shutdown (an add-on restart included) matter.js force-closes every
   * session here, which tells no controller. Close them gracefully first,
   * so an Echo drops its session at once; sessions already closing are
   * skipped, and the wait is capped.
   */
  override async prepareRuntimeShutdown() {
    await closeActiveSessions(this.env.get(SessionManager), logger);
    await super.prepareRuntimeShutdown();
  }

  async factoryReset() {
    await this.cancel();
    await this.erase();
  }
}
