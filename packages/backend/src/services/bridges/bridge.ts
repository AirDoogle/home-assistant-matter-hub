import {
  BridgeStatus,
  type UpdateBridgeRequest,
} from "@home-assistant-matter-hub/common";
import type { Environment, Logger } from "@matter/general";
import { SessionManager } from "@matter/main/protocol";
import type { LoggerService } from "../../core/app/logger.js";
import { BridgeServerNode } from "../../matter/endpoints/bridge-server-node.js";
import type {
  BridgeDataProvider,
  BridgeServerStatus,
} from "./bridge-data-provider.js";
import type { BridgeEndpointManager } from "./bridge-endpoint-manager.js";
import {
  closeActiveSessions,
  closeReplacedSessions,
} from "./close-replaced-sessions.js";

export class Bridge {
  private readonly log: Logger;
  readonly server: BridgeServerNode;
  private stopClosingReplacedSessions?: () => void;
  // Captured when the node starts: looking it up at stop could create a new
  // SessionManager on a node that is already shutting down.
  private sessionManager?: SessionManager;

  private status: BridgeServerStatus = {
    code: BridgeStatus.Stopped,
    reason: undefined,
  };

  get id() {
    return this.dataProvider.id;
  }

  get data() {
    return this.dataProvider.withMetadata(
      this.status,
      this.server,
      this.aggregator.parts.size,
    );
  }

  get aggregator() {
    return this.endpointManager.root;
  }

  constructor(
    env: Environment,
    logger: LoggerService,
    private readonly dataProvider: BridgeDataProvider,
    private readonly endpointManager: BridgeEndpointManager,
  ) {
    this.log = logger.get(`Bridge / ${dataProvider.id}`);
    this.server = new BridgeServerNode(
      env,
      this.dataProvider,
      this.endpointManager.root,
    );
  }

  async initialize(): Promise<void> {
    await this.server.construction.ready.then();
    await this.refreshDevices();
  }
  async dispose(): Promise<void> {
    await this.stop();
  }

  async refreshDevices() {
    await this.endpointManager.refreshDevices();
  }

  async start() {
    if (this.status.code === BridgeStatus.Running) {
      return;
    }
    try {
      this.status = {
        code: BridgeStatus.Starting,
        reason: "The bridge is starting... Please wait.",
      };
      await this.refreshDevices();
      this.endpointManager.startObserving();
      await this.server.start();
      this.stopClosingReplacedSessions?.();
      this.sessionManager = this.server.env.get(SessionManager);
      this.stopClosingReplacedSessions = closeReplacedSessions(
        this.sessionManager,
        this.log,
      );
      this.status = { code: BridgeStatus.Running };
    } catch (e) {
      const reason = "Failed to start bridge due to error:";
      this.log.error(reason, e);
      await this.stop(BridgeStatus.Failed, `${reason}\n${e?.toString()}`);
    }
  }

  async stop(
    code: BridgeStatus = BridgeStatus.Stopped,
    reason = "Manually stopped",
  ) {
    this.stopClosingReplacedSessions?.();
    this.stopClosingReplacedSessions = undefined;
    const sessionManager = this.sessionManager;
    this.sessionManager = undefined;
    if (sessionManager && this.server.lifecycle.isOnline) {
      try {
        await closeActiveSessions(sessionManager, this.log);
      } catch (e) {
        this.log.warn("Failed to close sessions before stopping:", e);
      }
    }
    this.endpointManager.stopObserving();
    await this.server.cancel();
    this.status = { code, reason };
  }

  async update(update: UpdateBridgeRequest) {
    try {
      this.dataProvider.update(update);
      await this.refreshDevices();
    } catch (e) {
      const reason = "Failed to update bridge due to error:";
      this.log.error(reason, e);
      await this.stop(BridgeStatus.Failed, `${reason}\n${e?.toString()}`);
    }
  }

  async factoryReset() {
    if (this.status.code !== BridgeStatus.Running) {
      return;
    }
    await this.server.factoryReset();
    this.status = { code: BridgeStatus.Stopped };
    await this.start();
  }

  async delete() {
    await this.server.delete();
  }
}
