import fs from "node:fs";
import path from "node:path";
import express from "express";

export function webUi(dist?: string) {
  const router = express.Router();
  if (dist) {
    const index = replaceBase(dist);
    router.get("/", index);
    router.get("/index.html", index);
    router.use(express.static(dist));
    router.get(/.*/, index);
  }
  return router;
}

function replaceBase(
  dist: string,
): (req: express.Request, res: express.Response) => void {
  return (req, res) => {
    let baseUrl = req.baseUrl;
    if (!baseUrl.endsWith("/")) {
      baseUrl += "/";
    }
    const content = fs
      .readFileSync(path.join(dist, "index.html"), "utf8")
      .replace(
        /<!-- BASE -->[\s\S]*<!-- \/BASE -->/,
        () => `<base href='${escapeHtml(baseUrl)}' />`,
      );
    res.status(200).contentType("text/html").send(content);
  };
}

/**
 * The base URL comes from the X-Ingress-Path request header. Escape it so it
 * cannot leave the attribute; the replacer function above keeps "$" patterns
 * in it from being expanded by String.replace.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
