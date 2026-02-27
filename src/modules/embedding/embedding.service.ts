import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';

/**
 * Embedding service using Google Gemini API.
 * Generates text embeddings via the Gemini embedding endpoint.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get('GEMINI_API_KEY', '');
    this.model = this.config.get(
      'GEMINI_EMBEDDING_MODEL',
      'text-embedding-004',
    );
  }

  get modelName(): string {
    return this.model;
  }

  get modelVersion(): string {
    return `gemini-${this.model}-v1`;
  }

  /**
   * Generate embedding for a single text.
   * Truncates to ~8000 chars to stay within token limits.
   */
  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — returning empty embedding');
      return [];
    }

    const truncated = text.slice(0, 8000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;

    const res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text: truncated }] },
      }),
    });

    if (res.statusCode !== 200) {
      const errBody = await res.body.text();
      this.logger.error(
        `Gemini embed failed (${res.statusCode}): ${errBody.slice(0, 300)}`,
      );
      throw new Error(`Embedding API error: ${res.statusCode}`);
    }

    const body = (await res.body.json()) as any;
    const values: number[] = body.embedding?.values || [];

    if (values.length === 0) {
      this.logger.warn('Gemini returned empty embedding');
    }

    return values;
  }

  /**
   * Batch embed multiple texts (sequential to respect rate limits).
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const emb = await this.embed(text);
      results.push(emb);
      // Small delay to respect API rate limits
      await new Promise((r) => setTimeout(r, 100));
    }
    return results;
  }
}
