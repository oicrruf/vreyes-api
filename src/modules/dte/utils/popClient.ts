import * as fs from "fs";
import POP3Client from "poplib";

export class PopClient {
  private client: any;
  private user: string;
  private pass: string;

  constructor(user: string, pass: string) {
    this.user = user;
    this.pass = pass;
    this.client = new POP3Client(995, "pop.gmail.com", {
      enabletls: true,
      ignoretlserrs: false,
      debug: false,
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on("connect", () => {
        resolve();
      });

      this.client.on("error", (err: any) => {
        reject(err);
      });

      this.client.connect(this.user, this.pass);
    });
  }

  public disconnect(): void {
    this.client.quit();
  }
}
