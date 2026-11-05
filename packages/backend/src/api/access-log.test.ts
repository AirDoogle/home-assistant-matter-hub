import { EventEmitter } from "node:events";
import type { Logger } from "@matter/general";
import type express from "express";
import { describe, expect, it, vi } from "vitest";
import { accessLogger, safeDecodeURI } from "./access-log.js";

describe("safeDecodeURI", () => {
  it("should decode a valid URI", () => {
    expect(safeDecodeURI("/a%20b")).toEqual("/a b");
  });

  it("should return a malformed URI unchanged instead of throwing", () => {
    expect(safeDecodeURI("/%ff")).toEqual("/%ff");
    expect(safeDecodeURI("/%E0%A4%A")).toEqual("/%E0%A4%A");
  });
});

describe("accessLogger", () => {
  it("should not throw when a response for a malformed URL finishes", () => {
    const logger = { debug: vi.fn() } as unknown as Logger;
    const req = {
      method: "GET",
      originalUrl: "/%ff",
      socket: { remoteAddress: "192.0.2.1" },
    } as unknown as express.Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 404,
      statusMessage: "Not Found",
    }) as unknown as express.Response;
    const next = vi.fn();

    accessLogger(logger)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(() => res.emit("finish")).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(
      "GET /%ff 404 Not Found from 192.0.2.1",
    );
  });
});
