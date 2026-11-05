import type { Logger } from "@matter/general";
import type express from "express";

export function accessLogger(
  logger: Logger,
): (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => void {
  return (req, res, next) => {
    res.on("finish", () => {
      logger.debug(
        `${req.method} ${safeDecodeURI(req.originalUrl)} ${res.statusCode} ${res.statusMessage} from ${req.socket.remoteAddress}`,
      );
    });
    next();
  };
}

/**
 * decodeURI throws on malformed input such as "/%ff". This runs in a
 * "finish" listener, where a throw is an uncaught exception that ends the
 * process, so fall back to the raw URL instead.
 */
export function safeDecodeURI(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}
