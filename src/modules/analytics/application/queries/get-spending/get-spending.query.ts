export class GetSpendingQuery {
  constructor(
    public readonly nrc: string,
    public readonly year: number,
    public readonly month?: number,
    public readonly type: 'purchase' | 'sale' | 'all' = 'all',
  ) {}

}
