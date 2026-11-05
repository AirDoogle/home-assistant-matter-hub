import fs from "node:fs";
import type * as http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("should send nosniff and no X-Powered-By on every response", async () => {
    const { url } = await startWebApi();
    for (const target of ["/api/matter/", "/not-found"]) {
      const res = await fetch(`${url}${target}`);
      expect(res.headers.get("x-content-type-options")).toEqual("nosniff");
      expect(res.headers.get("x-powered-by")).toBeNull();
    }
  });

  it("should refuse JSON bodies over 64 KB", async () => {
    const create = vi.fn();
    const { url } = await startWebApi({ create } as Partial<BridgeService>);
    const res = await fetch(`${url}/api/matter/bridges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(70 * 1024) }),
    });
    expect(res.status).toEqual(413);
    expect(create).not.toHaveBeenCalled();
  });

  it("should escape the ingress path in the page's base href", async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "hamh-web-ui-"));
    fs.writeFileSync(
      path.join(dist, "index.html"),
      "<head><!-- BASE --><!-- /BASE --></head>",
    );
    const { url } = await startWebApi({}, { webUiDist: dist });
    const res = await fetch(`${url}/`, {
      headers: { "X-Ingress-Path": "/api/hassio_ingress/x'><script>$'" },
    });
    expect(await res.text()).toEqual(
      "<head><base href='/api/hassio_ingress/x&#39;&gt;&lt;script&gt;$&#39;/' /></head>",
    );
    fs.rmSync(dist, { recursive: true, force: true });
  });

  describe("factory reset", () => {
    function fakeBridgeService() {
      const bridge = {
        id: "b1",
        data: { id: "b1" },
        factoryReset: vi.fn(async () => {}),
        start: vi.fn(async () => {}),
      };
      return { bridge, bridgeService: { bridges: [bridge] } };
    }
    const path = "/api/matter/bridges/b1/actions/factory-reset";

    it("should not reset a bridge on GET", async () => {
      const { bridge, bridgeService } = fakeBridgeService();
      const { url } = await startWebApi(
        bridgeService as unknown as Partial<BridgeService>,
      );
      const res = await fetch(`${url}${path}`);
      expect(res.status).toEqual(404);
      expect(bridge.factoryReset).not.toHaveBeenCalled();
    });

    it("should reset a bridge on POST", async () => {
      const { bridge, bridgeService } = fakeBridgeService();
      const { url } = await startWebApi(
        bridgeService as unknown as Partial<BridgeService>,
      );
      const res = await fetch(`${url}${path}`, { method: "POST" });
      expect(res.status).toEqual(200);
      expect(await res.json()).toEqual({ id: "b1" });
      expect(bridge.factoryReset).toHaveBeenCalledOnce();
      expect(bridge.start).toHaveBeenCalledOnce();
    });
  });
});
