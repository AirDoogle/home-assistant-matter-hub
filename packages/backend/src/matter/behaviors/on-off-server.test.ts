import { describe, expect, it, vi } from "vitest";
import { OnOffServer } from "./on-off-server.js";

describe("OnOffServer.off", () => {
  it("should schedule nothing for a device without an OFF action", () => {
    const behavior = OnOffServer({ turnOff: null });
    const callback = vi.fn();
    const self = {
      state: { config: { turnOff: null } },
      callback,
    } as unknown as InstanceType<typeof behavior>;
    vi.useFakeTimers();
    behavior.prototype.off.call(self);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toEqual(0);
    vi.useRealTimers();
  });
});
