import * as fs from "fs";
import * as path from "path";
import * as POP3Client from "poplib";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);

export class PopClient {
  private client: any;
  private user: string;
  private pass: string;

  constructor(user: string, pass: string) {
    this.user = user;
    this.pass = pass;
    this.client = new POP3Client("pop.gmail.com", 995, {
      tlserrs: false,
      enabletls: true,
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

  private async downloadAttachments(attachments: any[]): Promise<void> {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    const dir = path.join(__dirname, "..", "..", `${year}/${month}`);
    await this.createDirectory(dir);

    for (const attachment of attachments) {
      if (attachment.contentType === "application/pdf") {
        const filePath = path.join(dir, attachment.filename);
        await promisify(fs.writeFile)(filePath, attachment.content);
      }
    }
  }

  private async createDirectory(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err;
      }
    }
  }

  public disconnect(): void {
    this.client.quit();
  }
}
