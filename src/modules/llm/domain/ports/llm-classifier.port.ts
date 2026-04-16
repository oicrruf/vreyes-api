export const LLM_CLASSIFIER = 'LLM_CLASSIFIER';

export interface LlmClassifierPort {
  /**
   * Classifies an array of item descriptions.
   * Returns a string[] parallel to the input — one category per item.
   * Categories are open Spanish labels: "gasolina", "hardware", "seguros", etc.
   */
  classifyItems(descriptions: string[]): Promise<string[]>;
}
