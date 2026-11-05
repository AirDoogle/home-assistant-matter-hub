import "@matter/nodejs";
import type { CommandModule } from "yargs";
import { startHandler } from "./start-handler.js";
import type { StartOptions } from "./start-options.js";
import { startOptionsBuilder } from "./start-options-builder.js";

export default function startCommand(
  webDist?: string,
): CommandModule<{}, StartOptions> {
  return {
    command: "start",
    describe: "start the application",
    builder: startOptionsBuilder,
    // Start-up failures end the process (the add-on watchdog restarts it).
    // Said explicitly, since unhandled rejections are only logged (cli.ts).
    handler: (args) =>
      startHandler(args, webDist).catch((error: unknown) => {
        console.error("Failed to start:", error);
        process.exit(1);
      }),
  };
}
