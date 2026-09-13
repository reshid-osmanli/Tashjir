// مستكشف القواعد — Rule Explorer (FR-ES-07.1)
// مشروع التشجير - نظام القراءات العشر
//
// كل القواعد مصنّفة في دلاء (Global / Surah / Ayah / Local / Reader / Narrator /
// Path / Merge / Difference / Ordering / Exceptions) متكاملة مع الفئات الأربع
// عشرة، مع **بحث** عربي مطبّع و**تصفية** (الحالة/الفئة/الدلو/المجموعة/الصلابة/
// الخصوصية/المصدر + مفاتيح سريعة) و**ترتيب** (الأولوية/الاسم/الحالة/آخر تعديل/
// الاستخدام/الإصدار).
//
// القائمة طويلة-جاهزة: رأس ثابت، شريط تمرير ظاهر، ونافذة عرض (useWindowedList
// من الحزمة ٠٣) فلا تبطئ مئات القواعد. ومن كل قاعدة: فتح المحرر على المواضع
// المتأثرة (رابط عميق FR-ES-15)، و«لماذا؟» لأي قرار استخدمها، وسلسلة إصداراتها،
// واختباراتها.
//
// كل المنطق (تصنيف/تصفية/ترتيب) في `rule-explorer-model` النقيّة المختبرة،
// وهذا المكوّن عرض فقط (P-07).

'use client';



export type ExplorerView = 'buckets' | 'flat';

interface RuleExplorerProps {
  rules: EngineRule[];
  /** ملف المحرك (للمجموعات والتعارضات وعدادات الاستخدام). */
  config?: EngineConfig;
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  /** «لماذا؟» لأي قرار استخدم هذه القاعدة (FR-ES-09/10). */
  onWhy?: (ruleId: string) => void;
  /** فتح سلسلة إصدارات القاعدة (FR-ES-07.3). */
  onVersions?: (ruleId: string) => void;
  /** فتح اختبارات القاعدة (FR-ES-08). */
  onTests?: (ruleId: string) => void;
  /** رسم الاعتمادات مركّزًا على القاعدة (FR-ES-07.7). */
  onGraph?: (ruleId: string) => void;
  /** أسباب التعارض غير المحسوم (تُعرض بلون تحذيري). */
  conflicts?: Map<string, string[]>;
  /** عدد إصدارات كل قاعدة (شارة «v٣»). */
  versionCounts?: Record<string, number>;
}


    });
  const toggleBucket = (bucket: ExplorerBucket) =>
    setQuery((current) => {
      const active = current.buckets === 'ALL' ? [...EXPLORER_BUCKETS] : [...current.buckets];
      const next = active.includes(bucket) ? active.filter((item) => item !== bucket) : [...active, bucket];
      return { ...current, buckets: next.length === 0 || next.length === EXPLORER_BUCKETS.length ? 'ALL' : next };
    });
  const toggleCategory = (category: string) =>
    setQuery((current) => {
      const all = Array.from(new Set(rules.map((rule) => rule.category)));
      const active = current.categories === 'ALL' ? [...all] : [...current.categories];
      const next = active.includes(category) ? active.filter((item) => item !== category) : [...active, category];
      return { ...current, categories: next.length === 0 || next.length === all.length ? 'ALL' : next };
    });

  const activeFilterCount =
    (query.statuses === 'ALL' ? 0 : 1) +
    (query.categories === 'ALL' ? 0 : 1) +
    (query.buckets === 'ALL' ? 0 : 1) +
    (query.groupId === 'ALL' ? 0 : 1) +
    (query.hardness === 'ALL' ? 0 : 1) +
    (query.specificity === 'ALL' ? 0 : 1) +
    (query.source === 'ALL' ? 0 : 1) +
    (query.protectedOnly ? 1 : 0) +
    (query.withTestsOnly ? 1 : 0) +
    (query.liveOnly ? 1 : 0) +
    (query.conflictedOnly ? 1 : 0) +
    (query.editedOnly ? 1 : 0);

  const categories = useMemo(
    () => Array.from(new Set(rules.map((rule) => rule.category))).sort((a, b) => a.localeCompare(b)),
    [rules]
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ==================== رأس ثابت: بحث وتصفية وترتيب ==================== */}
      <div className="sticky top-0 z-10 space-y-3 border-b border-gray-100 bg-white/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900">
              كل القواعد <span className="text-gray-400">({toArabicDigits(visible.length)}/{toArabicDigits(rules.length)})</span>
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              نافذة: {toArabicDigits(facets.live)} · محمية: {toArabicDigits(facets.protected)} · متعارضة:{' '}
              <span className={facets.conflicted > 0 ? 'font-semibold text-red-600' : ''}>
                {toArabicDigits(facets.conflicted)}
              </span>{' '}
              · باختبارات: {toArabicDigits(facets.withTests)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            قاعدة جديدة
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder="بحث بالاسم، الوصف، المعرّف، الفئة، أو قيم الشروط…"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="بحث في القواعد"
          />
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
              showFilters || activeFilterCount > 0
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            aria-expanded={showFilters}
          >
            تصفية{activeFilterCount > 0 ? ` (${toArabicDigits(activeFilterCount)})` : ''}
          </button>
        </div>

        {/* شريط الحالة السريع (الأكثر استعمالًا) */}
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => {
            const active = query.statuses === 'ALL' || query.statuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  active ? STATUS_BADGE_CLASSES[status] : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                title={`${STATUS_LABELS[status]}: ${toArabicDigits(facets.byStatus[status])} قاعدة`}
              >
                {STATUS_LABELS[status]} <span className="opacity-70">{toArabicDigits(facets.byStatus[status])}</span>
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <FilterSelect
                label="الترتيب"
                value={query.sort.key}
                onChange={(value) => patch({ sort: { ...query.sort, key: value as ExplorerSortKey } })}
                options={SORT_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
              />
              <FilterSelect
                label="الاتجاه"
                value={query.sort.direction}
                onChange={(value) => patch({ sort: { ...query.sort, direction: value as 'asc' | 'desc' } })}
                options={[
                  { value: 'desc', label: 'تنازلي' },
                  { value: 'asc', label: 'تصاعدي' },
                ]}
              />
              <FilterSelect
                label="مجموعة الأولوية"
                value={query.groupId}
                onChange={(value) => patch({ groupId: value })}
                options={[
                  { value: 'ALL', label: 'كل المجموعات' },
                  ...(config?.priorityGroups ?? [])
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((group) => ({ value: group.id, label: group.label })),
                ]}
              />
              <FilterSelect
                label="الصلابة"
                value={query.hardness}
                onChange={(value) => patch({ hardness: value as RuleHardness | 'ALL' })}
                options={[
                  { value: 'ALL', label: 'الكل' },
                  { value: 'HARD', label: HARDNESS_LABELS.HARD },
                  { value: 'SOFT', label: HARDNESS_LABELS.SOFT },
                ]}
              />
              <FilterSelect
                label="الخصوصية"
                value={query.specificity}
                onChange={(value) => patch({ specificity: value as SpecificityLevel | 'ALL' })}
                options={[
                  { value: 'ALL', label: 'الكل' },
                  ...SPECIFICITIES.map((level) => ({ value: level, label: SPECIFICITY_LABELS[level] })),
                ]}
              />
              <FilterSelect
                label="المصدر"
                value={query.source}
                onChange={(value) => patch({ source: value as RuleSource | 'ALL' })}
                options={[
                  { value: 'ALL', label: 'كل المصادر' },
                  ...RULE_SOURCES.map((source) => ({
                    value: source,
                    label: `${SOURCE_LABELS[source]} (${toArabicDigits(facets.bySource[source])})`,
                  })),
                ]}
              />
              <FilterSelect
                label="العرض"
                value={view}
                onChange={(value) => setView(value as ExplorerView)}
                options={[
                  { value: 'buckets', label: 'شجرة الدلاء' },
                  { value: 'flat', label: 'قائمة مسطّحة' },
                ]}
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">الدلاء (تصنيف المستكشف)</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPLORER_BUCKETS.map((bucket) => {
                  const count = facets.byBucket[bucket];
                  const active = query.buckets === 'ALL' || query.buckets.includes(bucket);
                  return (
                    <button
                      key={bucket}
                      type="button"
                      onClick={() => toggleBucket(bucket)}
                      title={BUCKET_HINTS[bucket]}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        active && count > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      {BUCKET_LABELS[bucket]} <span className="opacity-70">{toArabicDigits(count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">الفئات (١٤ فئة)</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const active = query.categories === 'ALL' || query.categories.includes(category);
                  const count = facets.byCategory.find((item) => item.category === category)?.count ?? 0;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        active ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}{' '}
                      <span className="opacity-70">{toArabicDigits(count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-2">
              <QuickToggle label="المحمية فقط" checked={query.protectedOnly} onChange={(value) => patch({ protectedOnly: value })} />
              <QuickToggle label="بها اختبارات" checked={query.withTestsOnly} onChange={(value) => patch({ withTestsOnly: value })} />
              <QuickToggle label="النافذة فقط" checked={query.liveOnly} onChange={(value) => patch({ liveOnly: value })} />
              <QuickToggle
                label="المتعارضة فقط"
                checked={query.conflictedOnly}
                onChange={(value) => patch({ conflictedOnly: value })}
                danger
              />
              <QuickToggle label="المعدّلة فقط" checked={query.editedOnly} onChange={(value) => patch({ editedOnly: value })} />
              <button
                type="button"
                onClick={() => {
                  setQuery(EMPTY_EXPLORER_QUERY);
                  setCollapsed(new Set());
                }}
                className="mr-auto text-xs text-gray-500 underline hover:text-gray-700"
              >
                مسح كل المرشّحات
              </button>
            </div>
          </div>
        )}
      </div>



// ==================== صف القاعدة ====================

interface RuleRowProps {
  rule: EngineRule;
  selected: boolean;
  conflictReasons?: string[];
  usage: number;
  versionCount: number;
  rowRef?: React.RefObject<HTMLLIElement | null>;
  onMeasure?: (element: HTMLLIElement | null) => void;
  onSelect: () => void;
  onWhy?: (ruleId: string) => void;
  onVersions?: (ruleId: string) => void;
  onTests?: (ruleId: string) => void;
  onGraph?: (ruleId: string) => void;
}

function RuleRow({
  rule,
  selected,
  conflictReasons,
  usage,
  versionCount,
  rowRef,
  onMeasure,
  onSelect,
  onWhy,
  onVersions,
  onTests,
  onGraph,
}: RuleRowProps) {
  const conflicted = rule.status === 'CONFLICTED' || Boolean(conflictReasons?.length);
  const testCount = rule.testCases?.length ?? 0;

  return (
    <li
      ref={(element) => {
        onMeasure?.(element);
        if (rowRef) rowRef.current = element;
      }}
      className={conflicted ? 'bg-red-50/40' : undefined}
    >
      <div
        className={`flex w-full items-start gap-3 px-4 py-3 transition-colors hover:bg-emerald-50 ${
          selected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''
        }`}
      >
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-right" aria-current={selected}>
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-gray-900">
            <span className="truncate">{rule.name}</span>
            {rule.protected && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="قاعدة محمية">
                🔒 محمية
              </span>
            )}
            {conflicted && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title={conflictReasons?.join(' ؛ ')}>
                ⚠ تعارض
              </span>
            )}
          </p>
          {rule.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{rule.description}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
            <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_BADGE_CLASSES[rule.status]}`}>
              {STATUS_LABELS[rule.status]}
            </span>
            <span>{CATEGORY_LABELS[rule.category] ?? rule.category}</span>
            <span>·</span>
            <span>{SCOPE_LABELS[rule.scope]}</span>
            <span>·</span>
            <span>{HARDNESS_LABELS[rule.hardness]}</span>
            <span>·</span>
            <span title="الخصوصية">خصوصية {SPECIFICITY_LABELS[rule.specificity]}</span>
            <span>·</span>
            <span dir="ltr" className="font-mono">
              {rule.id}
            </span>
          </p>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <Badge label="أولوية" value={toArabicDigits(rule.priority)} tone="gray" />
            <Badge label="إصدار" value={`v${toArabicDigits(versionCount)}`} tone="blue" title={`${toArabicDigits(versionCount)} إصدار في السلسلة`} />
            {testCount > 0 && (
              <Badge label="اختبارات" value={toArabicDigits(testCount)} tone="emerald" title={`${toArabicDigits(testCount)} حالة اختبار`} />
            )}
            {usage > 0 && (
              <Badge label="استخدام" value={toArabicDigits(usage)} tone="purple" title={`${toArabicDigits(usage)} قاعدة تشير إليها`} />
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* فتح المحرر على المواضع المتأثرة: رابط عميق يُبرز القاعدة في
                أثر القرار (FR-ES-15) — لا نسخ للمنطق في الاستوديو. */}
            <a
              href={`/editor?rule=${encodeURIComponent(rule.id)}&why=1`}
              onClick={(event) => event.stopPropagation()}
              title="فتح المحرر وإبراز القاعدة في أثر القرار"
              className={ROW_ACTION_CLASSES}
            >
              المحرر ↗
            </a>
            {onWhy && (
              <RowAction label="لماذا؟" title="أثر أي قرار استخدم هذه القاعدة" onClick={() => onWhy(rule.id)} />
            )}
            {onVersions && (
              <RowAction label="الإصدارات" title="سلسلة الإصدارات والرجوع الموثّق" onClick={() => onVersions(rule.id)} />
            )}
            {onTests && (
              <RowAction label="الاختبارات" title="حالات اختبار القاعدة" onClick={() => onTests(rule.id)} />
            )}
            {onGraph && (
              <RowAction label="الاعتمادات" title="رسم الاعتمادات حول القاعدة" onClick={() => onGraph(rule.id)} />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** شكل موحّد لإجراءات الصف (زر أو رابط). */
const ROW_ACTION_CLASSES =
  'rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700';

/** إجراء صغير في الصف. */
function RowAction({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={label} className={ROW_ACTION_CLASSES}>
      {label}
    </button>
  );
}

function Badge({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone: 'gray' | 'blue' | 'emerald' | 'purple';
  title?: string;
}) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    purple: 'bg-purple-100 text-purple-800',
  }[tone];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tones}`} title={title ?? `${label}: ${value}`}>
      {label} {value}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuickToggle({
  label,
  checked,
  onChange,
  danger,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={`h-3.5 w-3.5 rounded border-gray-300 ${danger ? 'text-red-600' : 'text-emerald-600'} focus:ring-emerald-500`}
      />
      {label}
    </label>
  );
}

/** ترتيب الخصوصية معروضًا (يُستعمل في الشارة) — يُعاد تصديره لراحة المستهلك. */
export { SPECIFICITY_RANK };
