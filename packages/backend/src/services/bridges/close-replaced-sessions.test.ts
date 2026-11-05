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
  closeActiveSessions,
  closeReplacedSessions,
  REPLACED_SESSION_CHECK_MS,
  REPLACED_SESSION_QUIET_MS,
  SHUTDOWN_SESSION_CLOSE_TIMEOUT_MS,
} from "./close-replaced-sessions.js";

interface FakeSession {
  id: number;
  peerNodeId: bigint;
  fabric: { fabricIndex: number };
  isClosing: boolean;
  isPeerActive: boolean;
  timestamp: number;
  subscriptions: { size: number };
  initiateClose: Mock<(shutdownLogic?: () => Promise<void>) => Promise<void>>;
  initiateForceClose: Mock<() => Promise<void>>;
  closeSubscriptions: Mock<(flush?: boolean) => Promise<number>>;
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
    initiateClose: vi.fn(async (shutdownLogic?: () => Promise<void>) => {
      await shutdownLogic?.();
    }),
    initiateForceClose: vi.fn(async () => {}),
    closeSubscriptions: vi.fn(async () => 0),
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

describe("closeActiveSessions", () => {
  const manager = () => ({ sessions }) as unknown as SessionManager;

  it("should close every open session, subscriptions first", async () => {
    const a = session(1);
    const b = session(2, 7n);
    const closing = session(3);
    closing.isClosing = true;
    for (const s of [a, b, closing]) {
      sessions.add(s);
    }

    await closeActiveSessions(manager(), log);
    for (const s of [a, b]) {
      expect(s.initiateClose).toHaveBeenCalledOnce();
      expect(s.closeSubscriptions).toHaveBeenCalledWith(true);
    }
    expect(closing.initiateClose).not.toHaveBeenCalled();
  });

  it("should force a session whose graceful close fails", async () => {
    const a = session(1);
    a.initiateClose.mockRejectedValueOnce(new Error("peer unreachable"));
    sessions.add(a);

    await closeActiveSessions(manager(), log);
    expect(a.initiateForceClose).toHaveBeenCalledOnce();
  });

  it("should stop waiting after the timeout", async () => {
    const a = session(1);
    a.initiateClose.mockImplementationOnce(() => new Promise<void>(() => {}));
    sessions.add(a);

    const done = vi.fn();
    const closing = closeActiveSessions(manager(), log).then(done);
    await vi.advanceTimersByTimeAsync(SHUTDOWN_SESSION_CLOSE_TIMEOUT_MS - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await closing;
    expect(done).toHaveBeenCalledOnce();
  });
});
