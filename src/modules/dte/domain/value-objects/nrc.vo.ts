export class Nrc {
  constructor(private readonly value: string) {
    if (!value || value.trim() === '') {
      throw new Error('NRC cannot be empty');
    }
  }

  /** Checks if a parsed DTE JSON has a matching receptor.nrc */
  matchesDteJson(jsonData: any): boolean {
    if (!jsonData) return false;
    return jsonData?.receptor?.nrc === this.value;
  }

  toString(): string {
    return this.value;
  }
}
