export class GetDteFilesQuery {
  constructor(
    public readonly year: string,
    public readonly month: string,
    public readonly type: 'compras' | 'ventas',
  ) {}
}
