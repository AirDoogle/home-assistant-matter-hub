import type { Logger } from "@matter/general";
import type { NodeSession, SessionManager } from "@matter/main/protocol";

/** How often a replaced session is checked again. */
export const REPLACED_SESSION_CHECK_MS = 60_000;
/** How long a replaced session must be silent before it is closed. */
export const REPLACED_SESSION_QUIET_MS = 5 * 60_000;

/**
 * matter.js 0.16 does not close a peer's older CASE sessions when the peer
 * establishes a new one, so sessions a controller has abandoned pile up for
 * as long as the bridge runs; with Alexa this shows as devices "not
 * responding" after some hours.
 *
 * When a peer opens a session, every other session of that peer on the same
 * fabric is checked every minute. It is closed only once it holds no
 * subscription and has been silent for five minutes, so a session that is
 * still priming its first subscription, or still in use, is never cut
 * short. The old session usually still holds its subscription when the new
 * one opens; matter.js cancels it moments later, when the controller
 * subscribes on the new session, so the check has to keep watching.
 *
 * Ported from RiDDiX: commit c899c918 (issue #105), as refined by v2.0.59
 * (services/bridges/session-supervisor.ts:415-449 and 626-676,
 * session-rotation.ts:28-57 and 74-110). Returns a function that stops it.
 */
export function closeReplacedSessions(
  sessionManager: SessionManager,
  log: Logger,
): () => void {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const schedule = (id: number) => {
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => check(id), REPLACED_SESSION_CHECK_MS),
    );
  };

  const check = (id: number) => {
    timers.delete(id);
    const session = [...sessionManager.sessions].find((s) => s.id === id);
    if (!session || session.isClosing) {
      return;
    }
    const quietMs = Date.now() - session.timestamp;
    if (
      session.subscriptions.size > 0 ||
      session.isPeerActive ||
      quietMs < REPLACED_SESSION_QUIET_MS
    ) {
      schedule(id);
      return;
    }
    log.info(
      `Closing replaced session ${id} (peer ${session.peerNodeId}, no subscriptions, silent for ${Math.round(quietMs / 1000)}s)`,
    );
    void closeSession(session, log);
  };

  const onAdded = (added: NodeSession) => {
    for (const session of sessionManager.sessions) {
      if (
        session !== added &&
        !session.isClosing &&
        session.peerNodeId === added.peerNodeId &&
        session.fabric?.fabricIndex === added.fabric?.fabricIndex
      ) {
        log.info(
          `Session ${session.id} (peer ${session.peerNodeId}) was replaced by session ${added.id}; closing it once it has no subscription and goes silent`,
        );
        schedule(session.id);
      }
    }
  };

  const onDeleted = (deleted: NodeSession) => {
    clearTimeout(timers.get(deleted.id));
    timers.delete(deleted.id);
  };

  sessionManager.sessions.added.on(onAdded);
  sessionManager.sessions.deleted.on(onDeleted);

  return () => {
    sessionManager.sessions.added.off(onAdded);
    sessionManager.sessions.deleted.off(onDeleted);
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  };
}

/** How long shutdown waits for sessions to close before giving up. */
export const SHUTDOWN_SESSION_CLOSE_TIMEOUT_MS = 2_500;

/**
 * Close every active session before the node stops, so each controller is
 * told to drop its CASE session at once instead of holding a stale one,
 * which leaves an Echo showing the bridge as not responding after an
 * add-on restart. Subscriptions are closed (flushed) first, a failure is
 * logged, and the wait is capped.
 *
 * Ported from RiDDiX v2.0.59 services/bridges/session-supervisor.ts:72-87
 * (closeGracefully) and 735-763 (closeActiveSessions), called before the
 * server is cancelled as in services/bridges/bridge.ts:347. RiDDiX's forced
 * fallback is left out: see closeSession.
 */
export async function closeActiveSessions(
  sessionManager: SessionManager,
  log: Logger,
): Promise<void> {
  const closes: Promise<void>[] = [];
  for (const session of [...sessionManager.sessions]) {
    if (session.isClosing) {
      continue;
    }
    closes.push(closeSession(session, log));
  }
  if (closes.length === 0) {
    return;
  }
  log.info(`Closing ${closes.length} active session(s) on shutdown`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SHUTDOWN_SESSION_CLOSE_TIMEOUT_MS);
  });
  try {
    await Promise.race([Promise.allSettled(closes), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Close a session gracefully, flushing and closing its subscriptions first,
 * and log a failure instead of throwing it. There is no forced fallback: on
 * matter.js 0.16 the closing flag is set before the shutdown logic runs, so
 * a second close (initiateForceClose included) returns at once
 * (Session.ts:247-256, 275-276). matter.js removes a half-closed session
 * when its exchanges end, or at node shutdown.
 */
async function closeSession(session: NodeSession, log: Logger) {
  try {
    await session.initiateClose(async () => {
      await session.closeSubscriptions(true);
    });
  } catch (e) {
    log.warn(`Closing session ${session.id} failed:`, e);
  }
}
