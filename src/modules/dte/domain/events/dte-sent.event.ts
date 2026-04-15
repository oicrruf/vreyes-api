export class DteSentEvent {
  constructor(
    public readonly year: number,
    public readonly month: number,
    public readonly recipients: string[],
    public readonly sentFilesCount: number,
  ) {}
}
