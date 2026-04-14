declare module 'imap' {
  export interface Fetch {
    on(event: string, cb: Function): void;
    once(event: string, cb: Function): void;
  }
  export default class Imap {
    constructor(opts: any);
    connect(): void;
    end(): void;
    openBox(box: string, ro: boolean, cb: Function): void;
    search(criteria: any[], cb: Function): void;
    fetch(results: any, opts: any): Fetch;
    once(event: string, cb: Function): void;
    on(event: string, cb: Function): void;
    static parseHeader(buffer: string): any;
  }
}
