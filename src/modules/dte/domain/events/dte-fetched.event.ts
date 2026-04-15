export class DteFetchedEvent {
  constructor(
    public readonly year: number,
    public readonly month: number,
    public readonly filesCount: number,
  ) {}
}
