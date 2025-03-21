declare module "poplib" {
  class POP3Client {
    constructor(
      port: number,
      host: string,
      options?: {
        enabletls?: boolean;
        ignoretlserrs?: boolean;
        debug?: boolean;
        tls?: {
          rejectUnauthorized?: boolean;
        };
      }
    );

    on(event: string, callback: Function): void;
    once(event: string, callback: Function): void;
    connect(): void;
    login(username: string, password: string): void;
    quit(): void;
    retr(
      messageNumber: number,
      callback: (err: Error | null, data: string[]) => void
    ): void;
    list(callback: (err: Error | null, data: any[]) => void): void;
    dele(messageNumber: number): void;
    stat(): void;
    noop(): void;
    rset(): void;
  }

  export = POP3Client;
}
