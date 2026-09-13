// اختبارات حزمة الحوكمة للتصدير والاستيراد — Governance Bundle (FR-ES-07.6، FR-ES-08.3)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: حتمية الحزمة (DM-13) وهي تحمل الإعداد + سلاسل الإصدارات + سجل
// التدقيق + ملخّص الاختبارات، والجولة الكاملة تصدير ← استيراد ← تصدير،
// والفحص الذي يرفض الحزمة الفاسدة بلا تطبيق صامت.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import type { EngineConfig, EngineRule, EngineRuleVersion, StudioAuditEntry } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_MERGE_MATRIX,
  DEFAULT_PRIORITY_GROUPS,
  DEFAULT_SYSTEM_PROFILE,
} from '@/lib/tashjeer/decision/policy';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-a',
    name: 'قاعدة أ',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [] },
    actions: [{ type: 'MERGE' }],
    priority: 80,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function config(rules: EngineRule[] = [rule()]): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: DEFAULT_PRIORITY_GROUPS,
    rules,
    conflictPolicy: DEFAULT_CONFLICT_POLICY,
    executionOrder: ['MERGE'],
    mergeMatrix: DEFAULT_MERGE_MATRIX,
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

function version(overrides: Partial<EngineRuleVersion> = {}): EngineRuleVersion {
  return {
    id: 'erv-1',
    ruleId: 'er-a',
    version: 1,
    at: '2026-01-01T00:00:00.000Z',
    by: 'local-editor',
    source: 'CREATE',
    reason: 'إنشاء',
    rule: rule(),
    ...overrides,
  };
}

function audit(overrides: Partial<StudioAuditEntry> = {}): StudioAuditEntry {
  return {
    id: 'aud-1',
    at: '2026-01-02T00:00:00.000Z',
    actor: 'local-editor',
    action: 'RULE_UPDATED',
    ruleId: 'er-a',
    ruleName: 'قاعدة أ',
    summary: 'تعديل قاعدة «قاعدة أ»',
    ...overrides,
  };
}

describe('بناء الحزمة', () => {
  it('تجمع الإعداد والإصدارات والتدقيق وملخّص الاختبارات', async () => {
    const { buildGovernanceBundle, buildTestReport } = await import('@/lib/tashjeer/engine-governance');
    const bundle = buildGovernanceBundle(DEFAULT_SYSTEM_PROFILE, {
      ruleVersions: [version()],
      auditTrail: [audit()],
      exportedAt: '2026-05-01T00:00:00.000Z',
    });
    expect(bundle.format).toBe('tashjeer-engine-governance');
    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.config.rules.length).toBeGreaterThan(0);
    expect(bundle.ruleVersions).toHaveLength(1);
    expect(bundle.auditTrail).toHaveLength(1);
    // ملخّص الاختبارات يُشتق من الملف نفسه (FR-ES-08.3).
    expect(bundle.testReport?.failed).toBe(0);
    expect(bundle.testReport?.total).toBe(buildTestReport(DEFAULT_SYSTEM_PROFILE).total);
  });

  it('ملخّص الاختبارات يُسمّي القواعد المنحدرة', async () => {
    const { buildTestReport } = await import('@/lib/tashjeer/engine-governance');
    const edited = rule({
      id: 'er-a',
      actions: [{ type: 'MERGE' }],
      testCases: [{ name: 'مرجعية', input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'SEPARATE' }],
    });
    const report = buildTestReport(config([edited]));
    expect(report.total).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.failingRuleIds).toEqual(['er-a']);
  });
});

describe('الحتمية (DM-13)', () => {
  it('نفس الحزمة تعطي نفس النص ولو اختلف ترتيب الأجزاء', async () => {
    const { buildGovernanceBundle, serializeGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');
    const options = { exportedAt: '2026-05-01T00:00:00.000Z' };
    const first = serializeGovernanceBundle(
      buildGovernanceBundle(config(), { ruleVersions: [version(), version({ id: 'erv-2', ruleId: 'er-b', version: 1 })], auditTrail: [audit(), audit({ id: 'aud-2', at: '2026-01-03T00:00:00.000Z' })], ...options })
    );
    const second = serializeGovernanceBundle(
      buildGovernanceBundle(config(), { ruleVersions: [version({ id: 'erv-2', ruleId: 'er-b', version: 1 }), version()], auditTrail: [audit({ id: 'aud-2', at: '2026-01-03T00:00:00.000Z' }), audit()], ...options })
    );
    expect(second).toBe(first);
  });

  it('الإصدارات مرتبة بالمعرّف ثم الرقم، والتدقيق بالوقت', async () => {
    const { toCanonicalGovernanceBundle, buildGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');
    const canonical = toCanonicalGovernanceBundle(
      buildGovernanceBundle(config(), {
        ruleVersions: [version({ id: 'erv-9', ruleId: 'er-b', version: 2 }), version({ id: 'erv-1', ruleId: 'er-b', version: 1 })],
        auditTrail: [audit({ id: 'aud-2', at: '2026-01-05T00:00:00.000Z' }), audit({ id: 'aud-1', at: '2026-01-01T00:00:00.000Z' })],
        exportedAt: '2026-05-01T00:00:00.000Z',
      })
    ) as { ruleVersions: Array<{ ruleId: string; version: number }>; auditTrail: Array<{ id: string }> };
    expect(canonical.ruleVersions.map((item) => item.version)).toEqual([1, 2]);
    expect(canonical.auditTrail.map((item) => item.id)).toEqual(['aud-1', 'aud-2']);
    expect(Object.keys(canonical)).toEqual([
      'format',
      'bundleVersion',
      'exportedAt',
      'config',
      'ruleVersions',
      'auditTrail',
      'testReport',
    ]);
  });
});

describe('الجولة الكاملة والفحص', () => {
  it('تصدير ← استيراد ← تصدير مطابق', async () => {
    const { buildGovernanceBundle, serializeGovernanceBundle, parseGovernanceBundle } = await import(
      '@/lib/tashjeer/engine-governance'
    );
    const bundle = buildGovernanceBundle(config(), {
      ruleVersions: [version()],
      auditTrail: [audit()],
      exportedAt: '2026-05-01T00:00:00.000Z',
    });
    const text = serializeGovernanceBundle(bundle);
    const parsed = parseGovernanceBundle(text);
    expect(parsed.validation.valid).toBe(true);
    expect(parsed.bundle).not.toBeNull();
    expect(serializeGovernanceBundle(parsed.bundle!)).toBe(text);
  });

  it('يميّز الحزمة من ملف الإعداد المجرد (لا يُكسر ملف قديم)', async () => {
    const { detectStudioImport, isGovernanceBundleText } = await import('@/lib/tashjeer/engine-governance');
    const { serializeEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const { buildGovernanceBundle, serializeGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');

    const plain = serializeEngineConfig(config());
    const bundle = serializeGovernanceBundle(buildGovernanceBundle(config(), { exportedAt: '2026-05-01T00:00:00.000Z' }));

    expect(detectStudioImport(plain)).toBe('CONFIG');
    expect(detectStudioImport(bundle)).toBe('GOVERNANCE');
    expect(detectStudioImport('ليس JSON')).toBe('UNKNOWN');
    expect(isGovernanceBundleText(plain)).toBe(false);
  });

  it('يرفض الحزمة الفاسدة ويعلّل', async () => {
    const { parseGovernanceBundle, validateGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');
    expect(parseGovernanceBundle('{').bundle).toBeNull();

    const badFormat = validateGovernanceBundle({ format: 'آخر', bundleVersion: 1, config: config() });
    expect(badFormat.valid).toBe(false);
    expect(badFormat.errors.some((error) => error.includes('صيغة غير معروفة'))).toBe(true);

    const badVersionEntry = validateGovernanceBundle({
      format: 'tashjeer-engine-governance',
      bundleVersion: 1,
      config: config(),
      ruleVersions: [{ ruleId: 'er-a' }],
    });
    expect(badVersionEntry.valid).toBe(false);
    expect(badVersionEntry.errors.some((error) => error.includes('إصدار بلا رقم'))).toBe(true);

    const badAuditEntry = validateGovernanceBundle({
      format: 'tashjeer-engine-governance',
      bundleVersion: 1,
      config: config(),
      auditTrail: [{ id: 'aud-1' }],
    });
    expect(badAuditEntry.valid).toBe(false);
  });

  it('ينبّه على فجوة في سلسلة الإصدارات وعلى السجل الفارغ (لا يمنع)', async () => {
    const { validateGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');
    const validation = validateGovernanceBundle({
      format: 'tashjeer-engine-governance',
      bundleVersion: 1,
      config: config(),
      ruleVersions: [version({ version: 1 }), version({ id: 'erv-3', version: 3 })],
      auditTrail: [],
    });
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('فجوة'))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('بلا قيود تدقيق'))).toBe(true);
  });

  it('يستورد الحزمة ويرتّب أجزائها ترتيبًا ثابتًا', async () => {
    const { buildGovernanceBundle, parseGovernanceBundle, serializeGovernanceBundle, summarizeBundle } = await import(
      '@/lib/tashjeer/engine-governance'
    );
    const text = serializeGovernanceBundle(
      buildGovernanceBundle(config([rule(), rule({ id: 'er-b' })]), {
        ruleVersions: [version({ id: 'erv-2', ruleId: 'er-a', version: 2 }), version()],
        auditTrail: [audit({ id: 'aud-2', at: '2026-02-01T00:00:00.000Z' }), audit()],
        exportedAt: '2026-05-01T00:00:00.000Z',
      })
    );
    const parsed = parseGovernanceBundle(text);
    expect(parsed.bundle!.auditTrail[0]!.id).toBe('aud-2'); // الأحدث أولًا
    expect(parsed.bundle!.ruleVersions.map((item) => item.version)).toEqual([1, 2]);
    expect(summarizeBundle(parsed.bundle!)).toEqual({
      rules: 2,
      versions: 2,
      auditEntries: 2,
      rulesWithVersions: 1,
      tests: expect.any(String),
    });
  });
});
