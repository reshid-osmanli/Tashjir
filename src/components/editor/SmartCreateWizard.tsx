'use client';

// المعالج الذكي الموحد - Smart Create Wizard
// FR-ED-08: الإنشاء الذكي الموحد
// FR-ED-09: تحديد عدة كلمات معًا
//
// معالج واحد من 7 خطوات يوحّد كل عمليات الإنشاء:
//   1. التحديد البصري
//   2. مكونات المجموعة
//   3. الأهداف
//   4. النطاق البشري
//   5. العلاقات
//   6. النطاق الجغرافي
//   7. السياق + المراجعة

import { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import type { VariantCategory } from '@/types';
import {
  createInitialWizardState,
  canGoNext,
  canGoBack,
  goNext,
  goBack,
  addComponent,
  removeComponent,
  toggleTarget,
  addRelation,
  removeRelation,
  executeWizard,
  buildWizardSummary,
  type WizardState,
  type WizardComponent,
  type WizardStep,
  type WizardGeneralizationScope,
  type WizardRelation,
} from '@/lib/tashjeer/smart-create';
import type { RelationType } from '@/lib/tashjeer/model/v8';

interface SmartCreateWizardProps {
  onClose: () => void;
  initialPositions?: number[];
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'التحديد',
  2: 'المكونات',
  3: 'الأهداف',
  4: 'النطاق البشري',
  5: 'العلاقات',
  6: 'التعميم',
  7: 'المراجعة',
};

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  1: 'اختر الكلمات أو الحروف في الآية',
  2: 'عرّف الاختلافات والأوجه المطلوبة',
  3: 'حدد الأوجه التي ستُنشأ فيها الاختلافات',
  4: 'حدد نطاق القراء (أئمة/رواة/طرق)',
  5: 'أنشئ العلاقات بين المكونات',
  6: 'حدد نطاق التعميم (موضع/آية/سورة/مصحف)',
  7: 'راجع الملخص وأنشئ الكيانات',
};

export function SmartCreateWizard({ onClose, initialPositions = [] }: SmartCreateWizardProps) {
  const { document, addVariant, addVariantGroup, addLink, markedPositions, selectVariant } =
    useEditorStore();
  const catalog = useTransmissionCatalog();

  const [confirmCreate, setConfirmCreate] = useState(false);
  const [state, setState] = useState<WizardState>(() => {
    const initial = createInitialWizardState();
    if (initialPositions.length > 0) {
      return { ...initial, selection: { positions: initialPositions } };
    }
    if (markedPositions.length > 0) {
      return { ...initial, selection: { positions: markedPositions } };
    }
    return initial;
  });

  const words = useMemo(() => documentWindowWords(document), [document]);

  // ==================== التنقل ====================

  const handleNext = useCallback(() => {
    setState((prev) => goNext(prev));
  }, []);

  const handleBack = useCallback(() => {
    setState((prev) => goBack(prev));
  }, []);

  // ==================== الخطوة 1: التحديد ====================

  const togglePosition = useCallback((position: number) => {
    setState((prev) => {
      const positions = prev.selection.positions.includes(position)
        ? prev.selection.positions.filter((p) => p !== position)
        : [...prev.selection.positions, position].sort((a, b) => a - b);
      return { ...prev, selection: { ...prev.selection, positions } };
    });
  }, []);

  const setRange = useCallback((start: number, end: number) => {
    setState((prev) => ({
      ...prev,
      selection: {
        ...prev.selection,
        range: { start: Math.min(start, end), end: Math.max(start, end) },
      },
    }));
  }, []);

  // ==================== الخطوة 2: المكونات ====================

  const handleAddComponent = useCallback(
    (category: VariantCategory, title: string) => {
      setState((prev) =>
        addComponent(prev, {
          category,
          title,
          rank: prev.components.length + 1,
          variants: [
            {
              id: `variant-${Date.now()}`,
              label: 'وجه 1',
              text: title,
              rank: 1,
            },
          ],
        })
      );
    },
    []
  );

  const handleRemoveComponent = useCallback((componentId: string) => {
    setState((prev) => removeComponent(prev, componentId));
  }, []);

  // ==================== الخطوة 5: العلاقات ====================

  const handleAddRelation = useCallback(
    (fromComponentId: string, toComponentId: string, type: RelationType) => {
      setState((prev) => addRelation(prev, { fromComponentId, toComponentId, type }));
    },
    []
  );

  // ==================== الخطوة 7: التنفيذ ====================

  const handleExecute = useCallback(() => {
    const result = executeWizard(state);

    if (result.variants.length === 1) {
      addVariant(result.variants[0]);
      selectVariant(result.variants[0].id);
    } else {
      addVariantGroup(result.variants);
      if (result.variants.length > 0) {
        selectVariant(result.variants[0].id);
      }
    }

    // إنشاء العلاقات.
    for (const rel of result.relations) {
      addLink({
        kind: 'FACE_TO_FACE',
        relation: rel.type === 'MERGE' ? 'MERGE' : 'REFERENCE',
        from: { type: 'FACE', id: rel.fromId },
        to: { type: 'FACE', id: rel.toId },
      });
    }

    onClose();
  }, [state, addVariant, addVariantGroup, addLink, selectVariant, onClose]);

  // ==================== الملخص ====================

  const summary = useMemo(() => buildWizardSummary(state), [state]);

  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">المعالج الذكي لإنشاء الاختلافات</h2>
            <p className="text-sm text-gray-500">
              الخطوة {toArabicDigits(state.currentStep)} من ٧: {STEP_LABELS[state.currentStep]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Step Progress */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5, 6, 7] as WizardStep[]).map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step === state.currentStep
                      ? 'bg-emerald-600 text-white'
                      : step < state.currentStep
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < state.currentStep ? '✓' : toArabicDigits(step)}
                </div>
                {step < 7 && (
                  <div
                    className={`mx-1 h-0.5 w-6 ${
                      step < state.currentStep ? 'bg-emerald-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">{STEP_DESCRIPTIONS[state.currentStep]}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {state.currentStep === 1 && (
            <Step1Selection
              words={words}
              selectedPositions={state.selection.positions}
              onTogglePosition={togglePosition}
              onSetRange={setRange}
            />
          )}

          {state.currentStep === 2 && (
            <Step2Components
              components={state.components}
              onAddComponent={handleAddComponent}
              onRemoveComponent={handleRemoveComponent}
            />
          )}

          {state.currentStep === 3 && (
            <Step3Targets
              targets={state.targets}
              components={state.components}
              onToggleTarget={(id) => setState((prev) => toggleTarget(prev, id))}
            />
          )}

          {state.currentStep === 4 && (
            <Step4Scope
              scope={state.scope}
              catalog={catalog}
              onChange={(scope) => setState((prev) => ({ ...prev, scope }))}
            />
          )}

          {state.currentStep === 5 && (
            <Step5Relations
              components={state.components}
              relations={state.relations}
              onAddRelation={handleAddRelation}
              onRemoveRelation={(index) => setState((prev) => removeRelation(prev, index))}
            />
          )}

          {state.currentStep === 6 && (
            <Step6Generalization
              scope={state.generalizationScope}
              onChange={(scope) => setState((prev) => ({ ...prev, generalizationScope: scope }))}
            />
          )}

          {state.currentStep === 7 && <Step7Review summary={summary} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack(state)}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            ← السابق
          </button>

          {state.currentStep < 7 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext(state)}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              التالي →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCreate(true)}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              ✓ مراجعة الإنشاء ({toArabicDigits(summary.totalEntitiesToCreate)} كيانات)
            </button>
          )}
        </div>
      </div>

      {confirmCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="تأكيد إنشاء الاختلافات">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">تأكيد الإنشاء</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              سيُنشأ {toArabicDigits(summary.totalEntitiesToCreate)} اختلافات مستقلة
              {summary.relationsCount > 0 ? ` و${toArabicDigits(summary.relationsCount)} علاقات` : ''}.
              ستُوسم العناصر كدفعة واحدة ويمكن التراجع عنها من سجل المحرر.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={handleExecute} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">تأكيد الإنشاء</button>
              <button type="button" onClick={() => setConfirmCreate(false)} className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== الخطوات الفرعية ====================

function Step1Selection({
  words,
  selectedPositions,
  onTogglePosition,
  onSetRange,
}: {
  words: Array<{ id: number; position: number; text: string }>;
  selectedPositions: number[];
  onTogglePosition: (position: number) => void;
  onSetRange: (start: number, end: number) => void;
}) {
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  const handleWordClick = (position: number) => {
    if (rangeMode) {
      if (rangeStart === null) {
        setRangeStart(position);
      } else {
        onSetRange(rangeStart, position);
        setRangeStart(null);
        setRangeMode(false);
      }
    } else {
      onTogglePosition(position);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setRangeMode(!rangeMode);
            setRangeStart(null);
          }}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            rangeMode
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {rangeMode ? '🔗 وضع المدى (فعّال)' : '🔗 تحديد مدى كلمة→كلمة'}
        </button>
        {selectedPositions.length > 0 && (
          <span className="text-sm text-gray-600">
            {toArabicDigits(selectedPositions.length)} كلمات محددة
          </span>
        )}
      </div>

      {rangeMode && rangeStart !== null && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          بداية المدى: الكلمة {toArabicDigits(rangeStart)} — انقر على كلمة النهاية
        </div>
      )}

      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center"
        dir="rtl"
        style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
      >
        <div className="flex flex-wrap justify-center gap-2 text-2xl leading-loose">
          {words.map((word) => {
            const isSelected = selectedPositions.includes(word.position);
            return (
              <button
                key={word.id}
                type="button"
                onClick={() => handleWordClick(word.position)}
                className={`rounded px-2 py-1 transition-all ${
                  isSelected
                    ? 'bg-emerald-200 text-emerald-900 ring-2 ring-emerald-400'
                    : rangeStart === word.position
                      ? 'bg-blue-200 text-blue-900 ring-2 ring-blue-400'
                      : 'hover:bg-gray-200'
                }`}
              >
                {word.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Step2Components({
  components,
  onAddComponent,
  onRemoveComponent,
}: {
  components: WizardComponent[];
  onAddComponent: (category: VariantCategory, title: string) => void;
  onRemoveComponent: (id: string) => void;
}) {
  const [newCategory, setNewCategory] = useState<VariantCategory>('FARSH');
  const [newTitle, setNewTitle] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 font-medium text-gray-900">إضافة مكون جديد</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setNewCategory(cat)}
              className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                newCategory === cat
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
              }`}
              style={
                newCategory === cat
                  ? {
                      backgroundColor: getCategoryColor(cat),
                      borderColor: getCategoryColor(cat),
                    }
                  : undefined
              }
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان الاختلاف (مثال: مد طبيعي)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              if (newTitle.trim()) {
                onAddComponent(newCategory, newTitle.trim());
                setNewTitle('');
              }
            }}
            disabled={!newTitle.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            + إضافة
          </button>
        </div>
      </div>

      {components.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">
            المكونات ({toArabicDigits(components.length)})
          </h3>
          {components.map((comp, index) => (
            <div
              key={comp.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {toArabicDigits(index + 1)}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{comp.title}</p>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: getCategorySoftColor(comp.category),
                      color: getCategoryColor(comp.category),
                    }}
                  >
                    {CATEGORY_LABELS[comp.category]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveComponent(comp.id)}
                className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step3Targets({
  targets,
  components,
  onToggleTarget,
}: {
  targets: Array<{ componentId: string; selected: boolean }>;
  components: WizardComponent[];
  onToggleTarget: (componentId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        حدد المكونات التي تريد إنشاء الاختلافات فيها. كل مكون محدد سيُنشأ ككيان مستقل.
      </p>
      <div className="space-y-2">
        {components.map((comp) => {
          const target = targets.find((t) => t.componentId === comp.id);
          return (
            <label
              key={comp.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                target?.selected
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={target?.selected ?? false}
                onChange={() => onToggleTarget(comp.id)}
                className="h-5 w-5 accent-emerald-600"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{comp.title}</p>
                <p className="text-xs text-gray-500">{CATEGORY_LABELS[comp.category]}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Step4Scope({
  scope,
  catalog,
  onChange,
}: {
  scope: WizardState['scope'];
  catalog: ReturnType<typeof useTransmissionCatalog>;
  onChange: (scope: WizardState['scope']) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scopeKind"
            checked={scope.kind === 'ALL'}
            onChange={() => onChange({ kind: 'ALL' })}
            className="accent-emerald-600"
          />
          <span className="text-sm font-medium">كل الرواة (ALL)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scopeKind"
            checked={scope.kind === 'ALL_EXCEPT'}
            onChange={() => onChange({ kind: 'ALL_EXCEPT', narratorIds: [] })}
            className="accent-emerald-600"
          />
          <span className="text-sm font-medium">كل الرواة عدا (ALL_EXCEPT)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scopeKind"
            checked={scope.kind === 'NARRATORS'}
            onChange={() => onChange({ kind: 'NARRATORS', narratorIds: [] })}
            className="accent-emerald-600"
          />
          <span className="text-sm font-medium">رواة محددون (NARRATORS)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scopeKind"
            checked={scope.kind === 'IMAMS'}
            onChange={() => onChange({ kind: 'IMAMS', imamIds: [] })}
            className="accent-emerald-600"
          />
          <span className="text-sm font-medium">أئمة محددون (IMAMS)</span>
        </label>
      </div>

      {scope.kind === 'NARRATORS' && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="mb-2 text-sm font-medium">اختر الرواة</h4>
          <div className="flex flex-wrap gap-2">
            {catalog.narrators.map((narrator) => {
              const isSelected = scope.narratorIds?.includes(narrator.id) ?? false;
              return (
                <button
                  key={narrator.id}
                  type="button"
                  onClick={() => {
                    const ids = scope.narratorIds ?? [];
                    onChange({
                      ...scope,
                      narratorIds: isSelected
                        ? ids.filter((id) => id !== narrator.id)
                        : [...ids, narrator.id],
                    });
                  }}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {narrator.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {scope.kind === 'IMAMS' && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="mb-2 text-sm font-medium">اختر الأئمة</h4>
          <div className="flex flex-wrap gap-2">
            {catalog.imams.map((imam) => {
              const isSelected = scope.imamIds?.includes(imam.id) ?? false;
              return (
                <button
                  key={imam.id}
                  type="button"
                  onClick={() => {
                    const ids = scope.imamIds ?? [];
                    onChange({
                      ...scope,
                      imamIds: isSelected
                        ? ids.filter((id) => id !== imam.id)
                        : [...ids, imam.id],
                    });
                  }}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {imam.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Step5Relations({
  components,
  relations,
  onAddRelation,
  onRemoveRelation,
}: {
  components: WizardComponent[];
  relations: WizardRelation[];
  onAddRelation: (from: string, to: string, type: RelationType) => void;
  onRemoveRelation: (index: number) => void;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [relType, setRelType] = useState<RelationType>('RELATED');

  if (components.length < 2) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        تحتاج إلى مكونين على الأقل لإنشاء علاقات. عد إلى الخطوة السابقة لإضافة المزيد.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 font-medium text-gray-900">إضافة علاقة</h3>
        <div className="grid grid-cols-4 gap-2">
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">من...</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            value={relType}
            onChange={(e) => setRelType(e.target.value as RelationType)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="RELATED">مرتبط</option>
            <option value="MERGE">دمج</option>
            <option value="COMPOSITE">مركب</option>
            <option value="PART_OF">جزء من</option>
            <option value="MUTUALLY_EXCLUSIVE">متنافٍ</option>
          </select>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">إلى...</option>
            {components
              .filter((c) => c.id !== fromId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (fromId && toId) {
                onAddRelation(fromId, toId, relType);
                setFromId('');
                setToId('');
              }
            }}
            disabled={!fromId || !toId}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            + إضافة
          </button>
        </div>
      </div>

      {relations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">
            العلاقات ({toArabicDigits(relations.length)})
          </h3>
          {relations.map((rel, index) => {
            const from = components.find((c) => c.id === rel.fromComponentId);
            const to = components.find((c) => c.id === rel.toComponentId);
            return (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{from?.title}</span>
                  <span className="text-gray-500">← {rel.type} →</span>
                  <span className="font-medium">{to?.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveRelation(index)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step6Generalization({
  scope,
  onChange,
}: {
  scope: WizardGeneralizationScope;
  onChange: (scope: WizardGeneralizationScope) => void;
}) {
  const options: Array<{ value: WizardGeneralizationScope; label: string; description: string }> = [
    { value: 'LOCUS_ONLY', label: 'هذا الموضع فقط', description: 'لا تعميم — الاختلاف في هذا الموضع فقط' },
    { value: 'AYAH', label: 'الآية كاملة', description: 'تطبيق على كل المواضع المشابهة في الآية' },
    { value: 'SURAH', label: 'السورة كاملة', description: 'تطبيق على كل المواضع المشابهة في السورة' },
    { value: 'MUSHAF', label: 'المصحف كله (قاعدة عامة)', description: 'إنشاء قاعدة عامة تُطبق على كل المصحف' },
  ];

  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            scope === opt.value
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="generalization"
            checked={scope === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-emerald-600"
          />
          <div>
            <p className="font-medium text-gray-900">{opt.label}</p>
            <p className="text-sm text-gray-600">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function Step7Review({ summary }: { summary: ReturnType<typeof buildWizardSummary> }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">ملخص ما سيُنشأ</h3>
      <div className="grid grid-cols-2 gap-3">
        <ReviewCard label="التحديد" value={summary.selectionDescription} />
        <ReviewCard label="المكونات" value={toArabicDigits(summary.componentsCount)} />
        <ReviewCard label="الأهداف المحددة" value={toArabicDigits(summary.selectedTargetsCount)} />
        <ReviewCard label="العلاقات" value={toArabicDigits(summary.relationsCount)} />
        <ReviewCard label="النطاق البشري" value={summary.scopeDescription} />
        <ReviewCard label="التعميم" value={summary.generalizationDescription} />
        <ReviewCard label="السياق" value={summary.contextDescription} />
        <ReviewCard
          label="إجمالي الكيانات"
          value={toArabicDigits(summary.totalEntitiesToCreate)}
          highlight
        />
      </div>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-900">
          ✓ العملية قابلة للتراجع بالكامل (Undo) بعد التنفيذ.
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          كل كيان يُنشأ بمعرف مستقل ويمكن تعديله أو حذفه منفردًا دون التأثير على الآخرين.
        </p>
      </div>
    </div>
  );
}

function ReviewCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 font-bold ${highlight ? 'text-emerald-800' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
