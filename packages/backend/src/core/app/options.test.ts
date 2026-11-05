import { describe, expect, it, vi } from "vitest";
import { Options, type OptionsProps } from "./options.js";

function options(props: Partial<OptionsProps>) {
  return new Options({ httpPort: 8482, ...props } as OptionsProps);
}

describe("Options.webApi.host", () => {
  it("should bind to loopback when no host is given", () => {
    expect(options({}).webApi.host).toEqual("127.0.0.1");
  });

  it("should bind to loopback when the host is empty", () => {
    expect(options({ httpHost: "  " }).webApi.host).toEqual("127.0.0.1");
  });

  it("should bind to the given host", () => {
    expect(options({ httpHost: "172.30.32.1" }).webApi.host).toEqual(
      "172.30.32.1",
    );
  });
});

describe("Options.bridgeService.basicInformation", () => {
  it("should report fixed hardware and software versions", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    const info = options({}).bridgeService.basicInformation;
    vi.useRealTimers();
    expect(info.hardwareVersion).toEqual(2026);
    expect(info.softwareVersion).toEqual(2026);
  });
});
