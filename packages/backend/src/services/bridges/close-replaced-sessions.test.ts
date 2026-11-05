import { BasicSet, type Logger } from "@matter/general";
import type { SessionManager } from "@matter/main/protocol";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  closeReplacedSessions,
  REPLACED_SESSION_CHECK_MS,
  REPLACED_SESSION_QUIET_MS,
} from "./close-replaced-sessions.js";

interface FakeSession {
  id: number;
  peerNodeId: bigint;
  fabric: { fabricIndex: number };
  isClosing: boolean;
  isPeerActive: boolean;
  timestamp: number;
  subscriptions: { size: number };
  initiateClose: Mock<() => Promise<void>>;
  initiateForceClose: Mock<() => Promise<void>>;
}

const log = { info: vi.fn() } as unknown as Logger;
let sessions: BasicSet<FakeSession>;
let stop: () => void;

function session(id: number, peer = 1n, fabricIndex = 1): FakeSession {
  return {
    id,
    peerNodeId: peer,
    fabric: { fabricIndex },
    isClosing: false,
    isPeerActive: false,
    timestamp: Date.now(),
    subscriptions: { size: 0 },
    initiateClose: vi.fn(async () => {}),
    initiateForceClose: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  sessions = new BasicSet<FakeSession>();
  stop = closeReplacedSessions({ sessions } as unknown as SessionManager, log);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("closeReplacedSessions", () => {
  it("should close a replaced session once it has been silent", async () => {
    const old = session(1);
    sessions.add(old);
    const replacement = session(2);
    sessions.add(replacement);

    await vi.advanceTimersByTimeAsync(
      REPLACED_SESSION_QUIET_MS - REPLACED_SESSION_CHECK_MS,
    );
    expect(old.initiateClose).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_CHECK_MS);
    expect(old.initiateClose).toHaveBeenCalledOnce();
    expect(replacement.initiateClose).not.toHaveBeenCalled();
  });

  it("should keep a replaced session while it still has traffic", async () => {
    const old = session(1);
    sessions.add(old);
    sessions.add(session(2));

    await vi.advanceTimersByTimeAsync(
      REPLACED_SESSION_QUIET_MS - REPLACED_SESSION_CHECK_MS,
    );
    old.timestamp = Date.now();
    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS / 2);
    expect(old.initiateClose).not.toHaveBeenCalled();
  });

  it("should keep a replaced session that gains a subscription", async () => {
    const old = session(1);
    sessions.add(old);
    sessions.add(session(2));
    old.subscriptions.size = 1;

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS * 2);
    expect(old.initiateClose).not.toHaveBeenCalled();
  });

  it("should leave sessions with subscriptions alone", async () => {
    const old = session(1);
    old.subscriptions.size = 1;
    sessions.add(old);
    sessions.add(session(2));

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS * 2);
    expect(old.initiateClose).not.toHaveBeenCalled();
  });

  it("should leave other peers and other fabrics alone", async () => {
    const otherPeer = session(1, 7n);
    const otherFabric = session(2, 1n, 2);
    sessions.add(otherPeer);
    sessions.add(otherFabric);
    sessions.add(session(3));

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS * 2);
    expect(otherPeer.initiateClose).not.toHaveBeenCalled();
    expect(otherFabric.initiateClose).not.toHaveBeenCalled();
  });

  it("should force the close when a graceful close fails", async () => {
    const old = session(1);
    old.initiateClose.mockRejectedValueOnce(new Error("peer unreachable"));
    sessions.add(old);
    sessions.add(session(2));

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS);
    await vi.advanceTimersByTimeAsync(1);
    expect(old.initiateClose).toHaveBeenCalledOnce();
    expect(old.initiateForceClose).toHaveBeenCalledOnce();
  });

  it("should do nothing once stopped", async () => {
    const old = session(1);
    sessions.add(old);
    sessions.add(session(2));
    stop();

    await vi.advanceTimersByTimeAsync(REPLACED_SESSION_QUIET_MS * 2);
    expect(old.initiateClose).not.toHaveBeenCalled();
  });
});
