import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { Public } from '../../common/decorators';

/**
 * AI engine – intentionally NOT enabled in the launch build.
 *
 * Why: a legal/HR assistant must answer only from vetted sources and cite them.
 * Required before enabling (see docs/HRonE-Technical-Report.pdf §3.6):
 *   1. RegulatoryItem store curated by a human editor (official URL, version, effective date, status);
 *   2. retrieval over those items only; every answer cites the article + official link;
 *   3. refuse when retrieval support is weak; never present output as legal advice;
 *   4. strip personal data before any model call; log inputs/outputs;
 *   5. evaluation set of golden questions reviewed by a qualified lawyer.
 */
export interface AiAnswer {
  answer: string;
  citations: { title: string; officialUrl: string }[];
}

@Injectable()
export class AiEngineService {
  readonly enabled = false;

  async answer(_question: string): Promise<AiAnswer | null> {
    return null; // wired in a later phase
  }
}

@Controller('ai')
class AiEngineController {
  constructor(private readonly ai: AiEngineService) {}

  @Public()
  @Get('status')
  status() {
    return { enabled: this.ai.enabled, reason: 'Pending vetted regulatory knowledge base and legal review' };
  }
}

@Module({ controllers: [AiEngineController], providers: [AiEngineService], exports: [AiEngineService] })
export class AiEngineModule {}
