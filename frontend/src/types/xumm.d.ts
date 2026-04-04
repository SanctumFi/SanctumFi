declare module "xumm" {
  export class Xumm {
    constructor(apiKey: string);

    user: {
      account: Promise<string | undefined>;
      picture: Promise<string | undefined>;
      name: Promise<string | undefined>;
      networkType: Promise<string | undefined>;
      networkEndpoint: Promise<string | undefined>;
      token: Promise<string | undefined>;
    };

    environment: {
      ready: Promise<void>;
    };

    runtime?: {
      xapp?: boolean;
    };

    payload?: {
      create(payload: {
        txjson: Record<string, unknown>;
        options?: Record<string, unknown>;
        custom_meta?: Record<string, unknown>;
      }): Promise<{ uuid: string } | undefined>;
      subscribe(uuid: string): Promise<unknown>;
    };

    authorize(): Promise<unknown>;
    logout(): Promise<void>;

    on(event: "ready" | "success" | "logout" | "error" | "payload", callback: (...args: unknown[]) => void): void;

    xapp?: {
      openSignRequest(payload: unknown): void;
    };
  }
}
