export abstract class Service {
  readonly construction: Promise<void> = new Promise((resolve) => {
    setImmediate(() => {
      const init = this.initialize?.bind(this) ?? (async () => {});
      // A service that cannot start (for example, Home Assistant refusing
      // the token) would otherwise be an unhandled rejection. Fail loudly
      // and exit so the Supervisor's watchdog can restart the add-on.
      init().then(resolve, (error: unknown) => {
        console.error(`Failed to initialize ${this.serviceName}:`, error);
        process.exit(1);
      });
    });
  });

  constructor(readonly serviceName: string) {}

  protected initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
