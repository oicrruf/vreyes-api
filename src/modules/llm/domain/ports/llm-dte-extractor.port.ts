export const LLM_DTE_EXTRACTOR = 'LLM_DTE_EXTRACTOR';

export interface LlmDteExtractorPort {
  /**
   * Recibe imagen en base64 (PNG) y retorna el JSON extraído del CCF.
   * Lanza error si Groq no puede procesar la imagen o retorna JSON inválido.
   */
  extractFromImage(imageBase64: string): Promise<unknown>;
}
