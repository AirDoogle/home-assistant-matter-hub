import type * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { LoggerService } from "../core/app/logger.js";
import type { BridgeService } from "../services/bridges/bridge-service.js";
import { WebApi, type WebApiProps } from "./web-api.js";

const logger = new LoggerService({ level: "error", disableColors: true });
const running: WebApi[] = [];

async function startWebApi(
  bridgeService: Partial<BridgeService> = {},
  props: Partial<WebApiProps> = {},
) {
  const webApi = new WebApi(logger, bridgeService as BridgeService, {
    port: 0,
    host: "127.0.0.1",
    whitelist: undefined,
    ...props,
  });
  running.push(webApi);
  await webApi.construction;
  await webApi.start();
  const server = (webApi as unknown as { server: http.Server }).server;
  const address = server.address() as AddressInfo;
  return { address, url: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(running.splice(0).map((webApi) => webApi.dispose()));
});

describe("WebApi", () => {
  it("should listen on the configured host only", async () => {
    const { address } = await startWebApi();
    expect(address.address).toEqual("127.0.0.1");
  });

  it("should keep serving after a request with a malformed URL", async () => {
    const { url } = await startWebApi();
    const malformed = await fetch(`${url}/%ff`);
    expect(malformed.status).toEqual(404);
    const next = await fetch(`${url}/api/matter/`);
    expect(next.status).toEqual(200);
  });
});
