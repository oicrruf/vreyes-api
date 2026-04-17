export class UploadSaleDteCommand {
  constructor(
    public readonly jsonBuffer: Buffer,
    public readonly pdfBuffer?: Buffer,
  ) {}
}
