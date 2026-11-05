import { describe, expect, it } from "vitest";
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
