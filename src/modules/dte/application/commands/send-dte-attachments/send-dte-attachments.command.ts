export class SendDteAttachmentsCommand {
  constructor(
    public readonly year?: number,
    public readonly month?: number,
    public readonly subject?: string,
    public readonly message?: string,
  ) {}
}
