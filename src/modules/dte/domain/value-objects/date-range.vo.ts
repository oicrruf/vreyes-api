export class DateRange {
  constructor(
    public readonly after: Date,
    public readonly before: Date,
  ) {}

  static forMonth(year?: number, month?: number): DateRange {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month ? month - 1 : now.getMonth(); // 0-indexed

    const after = new Date(targetYear, targetMonth, 1);
    const before = new Date(targetYear, targetMonth + 1, 0);

    return new DateRange(after, before);
  }
}
