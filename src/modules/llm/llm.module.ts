import { Module } from '@nestjs/common';
import { GroqAdapter } from './infrastructure/adapters/groq.adapter';
import { LLM_CLASSIFIER } from './domain/ports/llm-classifier.port';
import { GroqVisionAdapter } from './infrastructure/adapters/groq-vision.adapter';
import { LLM_DTE_EXTRACTOR } from './domain/ports/llm-dte-extractor.port';

@Module({
  providers: [
    { provide: LLM_CLASSIFIER, useClass: GroqAdapter },
    { provide: LLM_DTE_EXTRACTOR, useClass: GroqVisionAdapter },
  ],
  exports: [LLM_CLASSIFIER, LLM_DTE_EXTRACTOR],
})
export class LlmModule {}
