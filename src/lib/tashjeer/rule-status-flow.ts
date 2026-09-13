// دورة حالة القاعدة والانتقالات المحكومة — Rule Status Lifecycle (FR-ES-07.2)
// مشروع التشجير - نظام القراءات العشر
//
// لكل قاعدة حالة: Draft / Active / Disabled / Deprecated / Conflicted /
// Experimental. الانتقالات **محكومة**: لا يُسمح بأي قفزة، والتفعيل يمرّ
// باعتماد صريح، والإيقاف (Deprecated) موثّق ولا يحذف تاريخًا. وحالة
// `CONFLICTED` تُوسم **تلقائيًا** عند اكتشاف تعارض قواعد غير محسوم بسلم
// السياسة، وتُرفع تلقائيًا حين يُحسم.
//
// الطبقة نقيّة: لا تخزين ولا DOM. الكشف عن التعارض يمرّ عبر Decision
// Resolver الموجود (profile-audit + resolveConflictPolicy) فلا منطق مكرر (P-07).

import type { EngineConfig, EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';
import { auditProfile, extractDifferenceType, typesOverlap } from './decision/profile-audit';
import { resolveConflictPolicy, UNRESOLVED_POLICY_REASON } from './decision/resolver';

/** كل الحالات بترتيب عرض ثابت. */
export const RULE_STATUSES: RuleStatus[] = [
  'DRAFT',
  'ACTIVE',
  'DISABLED',
  'DEPRECATED',
  'CONFLICTED',
  'EXPERIMENTAL',
];

/** الحالات التي تسري في المحرك فعلًا (تُحتسب في عداد الاستخدام والتحذير). */
export const LIVE_STATUSES: RuleStatus[] = ['ACTIVE', 'EXPERIMENTAL', 'CONFLICTED'];

/** انتقال مسموح بين حالتين مع شروطه. */
export interface StatusTransition {
  from: RuleStatus;
  to: RuleStatus;
  /** تسمية عربية للفعل («اعتماد وتفعيل»). */
  label: string;
  /** يحتاج خطوة اعتماد صريحة (تأكيد) قبل التنفيذ. */
  requiresApproval: boolean;
  /** يحتاج سببًا نصيًا إلزاميًا (موثّقًا في الإصدار والتدقيق). */
  requiresReason: boolean;
  /** هل يغيّر سلوك المحرك الجاري (فيُعرض تحذير مع عداد الاستخدام)؟ */
  affectsEngine: boolean;
  hint: string;
}

/**
 * جدول الانتقالات المحكوم. ما ليس في الجدول ممنوع (لا قفزات عشوائية)،
 * ولا انتقال يحذف تاريخًا: `DEPRECATED` إيقاف موثّق لا حذف.
 */
export const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: 'DRAFT',
    to: 'ACTIVE',
    label: 'اعتماد وتفعيل',
    requiresApproval: true,
    requiresReason: false,
    affectsEngine: true,
    hint: 'المسودة تصبح نافذة في المحرك؛ تُشغَّل اختباراتها قبل الاعتماد.',
  },
  {
    from: 'DRAFT',
    to: 'EXPERIMENTAL',
    label: 'تفعيل تجريبي',
    requiresApproval: true,
    requiresReason: false,
    affectsEngine: true,
    hint: 'تُجرَّب القاعدة على البيانات بلا اعتماد نهائي.',
  },
  {
    from: 'DRAFT',
    to: 'DISABLED',
    label: 'تعطيل المسودة',
    requiresApproval: false,
    requiresReason: false,
    affectsEngine: false,
    hint: 'تُترك المسودة جانبًا بلا تأثير.',
  },
  {
    from: 'EXPERIMENTAL',
    to: 'ACTIVE',
    label: 'اعتماد بعد التجربة',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: true,
    hint: 'التجريب صار سياسة نافذة؛ السبب يُحفظ في الإصدار والتدقيق.',
  },
  {
    from: 'EXPERIMENTAL',
    to: 'DRAFT',
    label: 'إعادة إلى المسودة',
    requiresApproval: false,
    requiresReason: false,
    affectsEngine: true,
    hint: 'تُوقف التجربة ويعاد تحرير القاعدة.',
  },
  {
    from: 'EXPERIMENTAL',
    to: 'DISABLED',
    label: 'إيقاف التجربة',
    requiresApproval: false,
    requiresReason: false,
    affectsEngine: true,
    hint: 'تُعطَّل القاعدة التجريبية بلا حذف.',
  },
  {
    from: 'ACTIVE',
    to: 'DISABLED',
    label: 'تعطيل',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: true,
    hint: 'تتوقف القاعدة عن التأثير؛ القرارات التي كانت تحسمها تعود للمصفوفة والسلم.',
  },
  {
    from: 'ACTIVE',
    to: 'DEPRECATED',
    label: 'إيقاف موثّق (إحالة للتقاعد)',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: true,
    hint: 'القاعدة متقادمة: لا تُحذف ولا يضيع تاريخها، وتبقى في المستكشف بوسمها.',
  },
  {
    from: 'ACTIVE',
    to: 'CONFLICTED',
    label: 'وسم تعارض',
    requiresApproval: false,
    requiresReason: true,
    affectsEngine: false,
    hint: 'تُوسم القاعدة يدويًا حين يُشتبه بتعارضها مع أخرى (والوسم التلقائي كذلك).',
  },
  {
    from: 'DISABLED',
    to: 'ACTIVE',
    label: 'إعادة التفعيل',
    requiresApproval: true,
    requiresReason: false,
    affectsEngine: true,
    hint: 'تعود القاعدة نافذة؛ تُشغَّل اختباراتها أولًا.',
  },
  {
    from: 'DISABLED',
    to: 'DEPRECATED',
    label: 'إحالة للتقاعد',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: false,
    hint: 'تُختم حياة القاعدة بإيقاف موثّق.',
  },
  {
    from: 'DEPRECATED',
    to: 'DISABLED',
    label: 'إعادة إلى المعطّلة',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: false,
    hint: 'لا رجوع مباشرًا للتفعيل: تمرّ القاعدة بالتعطيل ثم إعادة التفعيل الموثّقة.',
  },
  {
    from: 'CONFLICTED',
    to: 'ACTIVE',
    label: 'حسم التعارض والتفعيل',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: true,
    hint: 'يُرفع الوسم بعد حسم التعارض بالأولوية أو الخصوصية أو تعديل القاعدة الأخرى.',
  },
  {
    from: 'CONFLICTED',
    to: 'DISABLED',
    label: 'تعطيل القاعدة المتعارضة',
    requiresApproval: true,
    requiresReason: true,
    affectsEngine: true,
    hint: 'أحد طرفي التعارض يُعطَّل حتى يُراجع.',
  },
  {
    from: 'CONFLICTED',
    to: 'DRAFT',
    label: 'إعادة للتحرير',
    requiresApproval: false,
    requiresReason: true,
    affectsEngine: false,
    hint: 'تُعاد القاعدة مسودةً لتحرير شروطها بما يرفع التعارض.',
  },
];

/** الانتقالات المسموحة من حالة بعينها (بترتيب الجدول). */
export function allowedTransitions(from: RuleStatus): StatusTransition[] {
  return STATUS_TRANSITIONS.filter((transition) => transition.from === from);
}

/** يجد انتقالًا بين حالتين، أو `null` إن كان ممنوعًا. */
export function findTransition(from: RuleStatus, to: RuleStatus): StatusTransition | null {
  return STATUS_TRANSITIONS.find((transition) => transition.from === from && transition.to === to) ?? null;
}

/** هل الانتقال مسموح؟ */
export function canTransition(from: RuleStatus, to: RuleStatus): boolean {
  return findTransition(from, to) !== null;
}

/** نتيجة فحص انتقال قبل تنفيذه. */
export interface TransitionCheck {
  allowed: boolean;
  transition: StatusTransition | null;
  /** أسباب المنع أو ما يلزم للتنفيذ (تُعرض في الحوار). */
  blockers: string[];
  /** هل يلزم سبب نصي؟ */
  requiresReason: boolean;
  /** هل يلزم تأكيد صريح؟ */
  requiresApproval: boolean;
}

/**
 * يفحص انتقالًا مقترحًا مع سياق التنفيذ: السبب المتوفر، وهل القاعدة محمية،
 * وكم موضعًا تستخدم القاعدة فيه (عداد الاستخدام يظهر قبل التأكيد —
 * FR-ES-07.2.3).
 */
export function checkTransition(
  from: RuleStatus,
  to: RuleStatus,
  context: { reason?: string; protected?: boolean; usageCount?: number } = {}
): TransitionCheck {
  const transition = findTransition(from, to);
  const blockers: string[] = [];
  if (!transition) {
    blockers.push(
      from === to
        ? 'القاعدة في هذه الحالة أصلًا.'
        : `الانتقال من «${from}» إلى «${to}» غير مسموح في دورة الحالة المحكومة.`
    );
  }
  if (transition?.requiresReason && !context.reason?.trim()) {
    blockers.push('سبب التغيير إلزامي لهذا الانتقال (يُحفظ في الإصدار وسجل التدقيق).');
  }
  if (transition?.requiresApproval && context.protected) {
    blockers.push('القاعدة محمية: تحتاج تأكيدًا إضافيًا صريحًا بسبب مكتوب.');
  }
  return {
    allowed: blockers.length === 0,
    transition,
    blockers,
    requiresReason: Boolean(transition?.requiresReason) || Boolean(context.protected),
    requiresApproval: Boolean(transition?.requiresApproval) || Boolean(context.protected),
  };
}

// ==================== كشف التعارض غير المحسوم (CONFLICTED تلقائيًا) ====================

/** نوع التعارض المكتشف. */
export type ConflictKind = 'MERGE_ACTIONS' | 'DECLARED' | 'PRIORITY_TIE';

/** تعارض غير محسوم بين قاعدتين. */
export interface UnresolvedConflict {
  kind: ConflictKind;
  /** طرفا التعارض (مرتّبان بالمعرّف — حتمية). */
  ruleIds: [string, string];
  ruleNames: [string, string];
  /** لماذا يُعدّ غير محسوم (نص سلم السياسة أو سبب الإعلان). */
  reason: string;
  /** نوع الاختلاف المعني إن كان التعارض في أفعال الدمج. */
  differenceType?: string;
}

/** هل القاعدة نافذة في المحرك (تُحتسب في كشف التعارض)؟ */
export function isLive(rule: EngineRule): boolean {
  return LIVE_STATUSES.includes(rule.status);
}

/** زوجان من قاعدتين متعارضتين إعلانًا (conflictsWith) وكلتاهما نافذة. */
function declaredPairs(rules: EngineRule[]): Array<[EngineRule, EngineRule]> {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const pairs: Array<[EngineRule, EngineRule]> = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!isLive(rule)) continue;
    for (const otherId of rule.conflictsWith ?? []) {
      const other = byId.get(otherId);
      if (!other || !isLive(other)) continue;
      const key = [rule.id, otherId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([rule, other]);
    }
  }
  return pairs;
}

/**
 * يكشف التعارضات **غير المحسومة** في ملف المحرك: يمرّ على أزواج القواعد
 * المتناقضة (أفعال دمج متضادة على نفس النوع، أو إعلان conflictsWith) ويسأل
 * سلم حل التعارض الموجود أن يحسم. إن أجاب السلم «لم يحسم السلم — المرجّح
 * الأول» فالتعارض غير محسوم بالسياسة، وهذا ما يستحق وسم CONFLICTED.
 */
export function findUnresolvedConflicts(profile: EngineConfig): UnresolvedConflict[] {
  const conflicts: UnresolvedConflict[] = [];
  // القواعد الموسومة CONFLICTED ما تزال نافذة، وكاشف التعارض القائم يفحص
  // المفعّلة فقط. فنُجريه على نسخة تُعاد فيها الموسومة إلى ACTIVE مؤقتًا،
  // وإلا لانقلب الوسم على نفسه: وسم ← اختفاء من الكشف ← رفع الوسم ← وسم...
  // (النسخة للكشف وحده؛ لا يُحفظ شيء منها.)
  const detectionProfile: EngineConfig = {
    ...profile,
    rules: profile.rules.map((rule) => (rule.status === 'CONFLICTED' ? { ...rule, status: 'ACTIVE' } : rule)),
  };
  const audit = auditProfile(detectionProfile);
  // إلغاء تكرار بالزوج لا بالنوع: زوج القواعد نفسه قد يظهر كتعارض أفعال دمج
  // وكتعادل أولوية، وهو للمستخدم تعارض واحد (يُذكر بأول نوع يُكتشف به).
  const seen = new Set<string>();

  const push = (kind: ConflictKind, a: EngineRule, b: EngineRule, reason: string, differenceType?: string) => {
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    const ordered: [EngineRule, EngineRule] = a.id <= b.id ? [a, b] : [b, a];
    conflicts.push({
      kind,
      ruleIds: [ordered[0].id, ordered[1].id],
      ruleNames: [ordered[0].name, ordered[1].name],
      reason,
      ...(differenceType ? { differenceType } : {}),
    });
  };

  // 1) أفعال دمج متناقضة (قاعدة تدمج وأخرى تمنع على نفس النوع).
  for (const conflict of audit.mergeConflicts) {
    const { winner, reason } = resolveConflictPolicy(profile.conflictPolicy, [
      conflict.allowRule,
      conflict.preventRule,
    ]);
    if (!winner || reason === UNRESOLVED_POLICY_REASON) {
      push(
        'MERGE_ACTIONS',
        conflict.allowRule,
        conflict.preventRule,
        `تعارض أفعال دمج على ${conflict.differenceType}: قاعدة تسمح وأخرى تمنع، ولم يحسم سلم السياسة`,
        conflict.differenceType
      );
    }
  }

  // 2) تعارض مُعلن صراحةً (conflictsWith) بين قاعدتين نافذتين.
  for (const [a, b] of declaredPairs(profile.rules)) {
    const { winner, reason } = resolveConflictPolicy(profile.conflictPolicy, [a, b]);
    if (!winner || reason === UNRESOLVED_POLICY_REASON) {
      push('DECLARED', a, b, 'تعارض مُعلن بين قاعدتين نافذتين لم يحسمه سلم السياسة');
    }
  }

  // 3) تعادل أولوية داخل المجموعة بين قاعدتين بأفعال متناقضة.
  for (const collision of audit.priorityCollisions) {
    const rules = collision.rules.filter(isLive);
    for (let i = 0; i < rules.length; i += 1) {
      for (let j = i + 1; j < rules.length; j += 1) {
        const a = rules[i]!;
        const b = rules[j]!;
        const contradicts =
          (a.actions.some((x) => x.type === 'MERGE') && b.actions.some((x) => x.type === 'PREVENT_MERGE')) ||
          (a.actions.some((x) => x.type === 'PREVENT_MERGE') && b.actions.some((x) => x.type === 'MERGE')) ||
          (a.actions.some((x) => x.type === 'OVERRIDE_RESULT') && b.actions.some((x) => x.type === 'BLOCK_RESULT'));
        if (!contradicts) continue;
        // التعادل لا يؤذي إلا إن أمكن للقاعدتين أن تطابقا **نفس السياق**:
        // قيدان متنافيان على نوع الاختلاف يعنيان أن إحداهما فقط تعمل في أي
        // حالة، فلا تصادم فعليًا في المحرك (نفس الحكم الذي يستعمله الفحص).
        const dtA = extractDifferenceType(a);
        const dtB = extractDifferenceType(b);
        if (!typesOverlap(dtA, dtB)) continue;
        // تعادل الأولوية وحده ليس تعارضًا غير محسوم: يُسأل السلم أولًا، فإن
        // حسم (بالصلابة أو بالخصوصية أو بالإعلان) فلا وسم.
        const { winner, reason } = resolveConflictPolicy(profile.conflictPolicy, [a, b]);
        if (winner && reason !== UNRESOLVED_POLICY_REASON) continue;
        push(
          'PRIORITY_TIE',
          a,
          b,
          `تعادل أولوية (${collision.priority}) داخل المجموعة «${collision.groupId}» مع أفعال متناقضة، ولم يحسم سلم السياسة`,
          dtA === 'ANY' ? dtB : dtA
        );
      }
    }
  }

  return conflicts.sort((x, y) => x.ruleIds.join('|').localeCompare(y.ruleIds.join('|')));
}

/** معرّف القاعدة ← أسباب وسمها متعارضة (للعرض في المستكشف). */
export function conflictedRuleReasons(profile: EngineConfig): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const conflict of findUnresolvedConflicts(profile)) {
    for (let index = 0; index < conflict.ruleIds.length; index += 1) {
      const id = conflict.ruleIds[index];
      const other = conflict.ruleNames[index === 0 ? 1 : 0];
      const list = map.get(id) ?? [];
      list.push(`${conflict.reason} — مع «${other}»`);
      map.set(id, list);
    }
  }
  return map;
}

/** تغيير حالة واحد ناتج عن الوسم التلقائي. */
export interface ConflictTagChange {
  ruleId: string;
  ruleName: string;
  from: RuleStatus;
  to: RuleStatus;
  reason: string;
}

/** نتيجة تطبيق/رفع الوسم التلقائي على ملف المحرك. */
export interface ConflictTagResult {
  config: EngineConfig;
  /** وُسمت: قواعد انتقلت إلى CONFLICTED. */
  tagged: ConflictTagChange[];
  /** رُفع عنها: قواعد كانت CONFLICTED وصار تعارضها محسومًا. */
  cleared: ConflictTagChange[];
  conflicts: UnresolvedConflict[];
}

/**
 * يطبّق الوسم التلقائي (FR-ES-07.2.2): يسم القواعد المعنية بتعارض غير محسوم
 * بـ `CONFLICTED`، ويرفع الوسم عمن حُسم تعارضها (تعود `ACTIVE`). لا يمسّ
 * الحالات الأخرى ولا يحذف شيئًا، وكل تغيير يُعاد في `tagged`/`cleared` حتى
 * يُسجَّل في الإصدارات وسجل التدقيق.
 */
export function syncConflictTags(
  profile: EngineConfig,
  options: { now?: string } = {}
): ConflictTagResult {
  const now = options.now ?? new Date().toISOString();
  const conflicts = findUnresolvedConflicts(profile);
  const reasons = conflictedRuleReasons(profile);
  const tagged: ConflictTagChange[] = [];
  const cleared: ConflictTagChange[] = [];

  const rules = profile.rules.map((rule) => {
    const isConflicted = reasons.has(rule.id);
    if (isConflicted && rule.status !== 'CONFLICTED' && isLive(rule)) {
      tagged.push({
        ruleId: rule.id,
        ruleName: rule.name,
        from: rule.status,
        to: 'CONFLICTED',
        reason: (reasons.get(rule.id) ?? []).join(' ؛ '),
      });
      return { ...rule, status: 'CONFLICTED' as RuleStatus, updatedAt: now, version: rule.version + 1 };
    }
    if (!isConflicted && rule.status === 'CONFLICTED') {
      cleared.push({
        ruleId: rule.id,
        ruleName: rule.name,
        from: 'CONFLICTED',
        to: 'ACTIVE',
        reason: 'حُسم التعارض: لا تعارض غير محسوم مع هذه القاعدة الآن',
      });
      return { ...rule, status: 'ACTIVE' as RuleStatus, updatedAt: now, version: rule.version + 1 };
    }
    return rule;
  });

  return { config: { ...profile, rules }, tagged, cleared, conflicts };
}

// ==================== تحذيرات التعديل (FR-ES-07.2.3) ====================

/** ما يلزم عرضه قبل تعديل قاعدة نافذة/محمية. */
export interface EditGuard {
  /** هل القاعدة نافذة في المحرك (فيُعرض تحذير)؟ */
  isLive: boolean;
  /** هل هي محمية (فيُطلب تأكيد إضافي بسبب إلزامي)؟ */
  isProtected: boolean;
  /** كم قاعدة أخرى تعتمد عليها/تتجاوزها (عداد الاستخدام الخام). */
  dependentCount: number;
  /** عدد حالات الاختبار المرفقة (تُشغَّل قبل الحفظ). */
  testCaseCount: number;
  /** هل يلزم سبب نصي إلزامي؟ */
  requiresReason: boolean;
  /** تحذيرات عربية تُعرض في الحوار. */
  warnings: string[];
}

/**
 * يبني حارس التعديل لقاعدة: التحذيرات وعدادات الاستخدام التي تظهر قبل
 * التأكيد. العدادات تُشتق من ملف المحرك (من يعتمد على القاعدة، من يتجاوزها،
 * من يعلن تعارضه معها) — لا تقدير ولا تخزين إضافي.
 */
export function buildEditGuard(profile: EngineConfig, rule: EngineRule): EditGuard {
  const dependents = profile.rules.filter(
    (other) =>
      other.id !== rule.id &&
      (other.dependsOn?.includes(rule.id) ||
        other.overrides?.includes(rule.id) ||
        other.conflictsWith?.includes(rule.id))
  );
  const isProtected = Boolean(rule.protected);
  const live = isLive(rule);
  const warnings: string[] = [];
  if (live) {
    warnings.push(
      `القاعدة «${rule.name}» نافذة في المحرك: تعديلها يغيّر القرارات الجارية فور النشر.`
    );
  }
  if (dependents.length > 0) {
    warnings.push(`${dependents.length} قاعدة أخرى تشير إليها (اعتماد/تجاوز/تعارض).`);
  }
  if (isProtected) {
    warnings.push('قاعدة محمية: التغيير والحذف يحتاجان تأكيدًا إضافيًا صريحًا بسبب مكتوب.');
  }
  if (rule.status === 'DEPRECATED') {
    warnings.push('القاعدة متقادمة (موقوفة موثّقًا): تعديلها لا يعيد تفعيلها.');
  }
  return {
    isLive: live,
    isProtected,
    dependentCount: dependents.length,
    testCaseCount: rule.testCases?.length ?? 0,
    requiresReason: isProtected || live,
    warnings,
  };
}
