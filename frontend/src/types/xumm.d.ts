declare module "xumm" {
  export class Xumm {
    constructor(apiKey: string);

    environment: {
      ready: Promise<void>;
      ott?: Promise<{ account?: string } | undefined>;
    };

    runtime?: {
      xapp?: boolean;
      jwt?: { sub?: string };
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

    on(event: string, callback: (data: unknown) => void): void;

    xapp?: {
      openSignRequest(payload: unknown): void;
    };
  }
}
