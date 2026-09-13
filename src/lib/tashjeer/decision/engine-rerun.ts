// إعادة تشغيل المحرك مع الحفاظ على القرارات البشرية — FR-EN-05 / P-06
// مشروع التشجير - نظام القراءات العشر

import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { compareProfiles, type CompareInput, type CompareReport, DEFAULT_COMPARE_INPUTS } from './profile-compare';
import { dryRunRule, type DryRunReport } from './dry-run';

export type RerunScope = 'ayah' | 'surah' | 'mushaf';

export interface RerunReport {
  scope: RerunScope;
  dryRun: DryRunReport;
  compare: CompareReport;
  /** القرارات اليدوية لا تُلغى — تُصنَّف الفروق فقط. */
  preservedManual: true;
}

export function rerunEngine(
  before: EngineConfig,
  after: EngineConfig,
  scope: RerunScope = 'mushaf',
  inputs: CompareInput[] = DEFAULT_COMPARE_INPUTS
): RerunReport {
  return {
    scope,
    dryRun: dryRunRule(after, undefined, { inputs }),
    compare: compareProfiles(before, after, inputs),
    preservedManual: true,
  };
}
