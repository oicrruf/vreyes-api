import { Module } from '@nestjs/common';
import { GroqAdapter } from './infrastructure/adapters/groq.adapter';
import { LLM_CLASSIFIER } from './domain/ports/llm-classifier.port';

@Module({
  providers: [
    { provide: LLM_CLASSIFIER, useClass: GroqAdapter },
  ],
  exports: [LLM_CLASSIFIER],
})
export class LlmModule {}
