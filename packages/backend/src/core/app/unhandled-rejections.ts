import { Logger } from "@matter/general";

type ErrorLog = Pick<Logger, "error">;

/**
 * home-assistant-js-websocket leaves some promises without a handler: the
 * unsubscribe when a collection is torn down, the resubscribe after a
 * reconnect, and the initial subscribe of an update subscription. Node 22
 * ends the process on any unhandled rejection, which takes every bridge
 * down, and these start inside the library, where no call site can catch
 * them. Log each at error level, with its reason, and keep running.
 *
 * Only rejections: a service that cannot start still exits (Service), and
 * uncaught exceptions are not caught here.
 */
export function unhandledRejectionLogger(log: ErrorLog) {
  return (reason: unknown) => {
    log.error("Unhandled promise rejection (process kept running):", reason);
  };
}

export function logUnhandledRejections(
  log: ErrorLog = Logger.get("Process"),
): () => void {
  const listener = unhandledRejectionLogger(log);
  process.on("unhandledRejection", listener);
  return () => {
    process.off("unhandledRejection", listener);
  };
}
