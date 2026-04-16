export class GetDteFilesQuery {
  constructor(
    public readonly year: number,
    public readonly month: number,
    public readonly type: 'purchase' | 'sale',
  ) {}
}
