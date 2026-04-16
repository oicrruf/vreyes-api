import { Injectable } from '@nestjs/common';
import { LlmClassifierPort } from '../../domain/ports/llm-classifier.port';

interface GroqChatResponse {
  choices: Array<{ message: { content: string } }>;
}

@Injectable()
export class GroqAdapter implements LlmClassifierPort {
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    this.apiKey = apiKey;
  }

  async classifyItems(descriptions: string[]): Promise<string[]> {
    if (descriptions.length === 0) return [];

    const prompt = `You are a procurement classifier. Given a list of purchase item descriptions in Spanish, classify each one with a short Spanish category label (e.g. "gasolina", "seguros", "hardware", "fontanería", "alimentación", "servicios profesionales", "papelería", "transporte", "electricidad", "telecomunicaciones").

Return ONLY a JSON object with a single key "categories" containing an array of category strings, one per input item, in the same order.

Items:
${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq API error ${response.status}: ${text}`);
    }

    const data = await response.json() as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned empty content');

    let parsed: { categories: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Groq returned non-JSON content: ${content.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed.categories)) {
      throw new Error('Groq response missing "categories" array');
    }

    const result = (parsed.categories as string[]).slice(0, descriptions.length);
    while (result.length < descriptions.length) {
      result.push('sin categoría');
    }
    return result;
  }
}
