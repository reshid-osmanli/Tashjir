// مكتبة القواعد القرائية — Recitation Rule Catalog Panel
// Spec §§7-8, 27-32: واجهة إدارة مجموعات وأنواع وخيارات القواعد القرائية
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listFamilies,
  listTypes,
  listOptions,
  getFamily,
  getRuleType,
  saveFamily,
  saveRuleType,
  saveRuleOption,
  deleteFamily,
  deleteRuleType,
  deleteRuleOption,
  createFamilyId,
  createRuleTypeId,
  createRuleOptionId,
  validateOption,
  loadRecitationCatalog,
  resetCatalog,
  type RecitationRuleFamily,
  type RecitationRuleType,
  type RecitationRuleOption,
  type EditorMode,
  type DetectionMode,
  type RecitationRuleStatus,
} from '@/lib/tashjeer/recitation-rule-catalog';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_RecitationRuleCatalogPanel_0 = {
  "DRAFT": "A1823",
  "TEST": "A1824",
  "PREVIEW": "A1825",
  "APPROVED": "A1826",
  "ACTIVE": "A1827",
  "DISABLED": "A1828",
  "DEPRECATED": "A1829",
  "EXPERIMENTAL": "A1830"
} as const;

const UI_FamilyEditor_1 = {
  "DRAFT": "A1842",
  "TEST": "A1843",
  "PREVIEW": "A1844",
  "APPROVED": "A1845",
  "ACTIVE": "A1846",
  "DISABLED": "A1847",
  "DEPRECATED": "A1848",
  "EXPERIMENTAL": "A1849"
} as const;

const UI_FamilyEditor_2 = {
  "MANUAL_TEXT": "A1851",
  "RULE_DRIVEN": "A1852",
  "HYBRID": "A1853"
} as const;

const UI_TypeEditor_3 = {
  "MANUAL": "A1861",
  "PATTERN": "A1862",
  "STRUCTURAL": "A1863",
  "HYBRID": "A1864"
} as const;

const UI_TypeEditor_4 = {
  "DRAFT": "A1866",
  "TEST": "A1867",
  "PREVIEW": "A1868",
  "APPROVED": "A1869",
  "ACTIVE": "A1870",
  "DISABLED": "A1871",
  "DEPRECATED": "A1872",
  "EXPERIMENTAL": "A1873"
} as const;

const UI_OptionRow_5 = {
  "DRAFT": "A1886",
  "TEST": "A1887",
  "PREVIEW": "A1888",
  "APPROVED": "A1889",
  "ACTIVE": "A1890",
  "DISABLED": "A1891",
  "DEPRECATED": "A1892",
  "EXPERIMENTAL": "A1893"
} as const;



const STATUS_OPTIONS: Array<{ value: RecitationRuleStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'TEST', label: 'اختبار' },
  { value: 'PREVIEW', label: 'معاينة' },
  { value: 'APPROVED', label: 'معتمدة' },
  { value: 'ACTIVE', label: 'نشطة' },
  { value: 'DISABLED', label: 'معطلة' },
  { value: 'DEPRECATED', label: 'متقادمة' },
  { value: 'EXPERIMENTAL', label: 'تجريبية' },
];

const EDITOR_MODES: Array<{ value: EditorMode; label: string }> = [
  { value: 'MANUAL_TEXT', label: 'نص يدوي (فرش)' },
  { value: 'RULE_DRIVEN', label: 'مدفوع بالقواعد (مدود)' },
  { value: 'HYBRID', label: 'هجين' },
];

const DETECTION_MODES: Array<{ value: DetectionMode; label: string }> = [
  { value: 'MANUAL', label: 'يدوي' },
  { value: 'PATTERN', label: 'نمطي' },
  { value: 'STRUCTURAL', label: 'بنيوي' },
  { value: 'HYBRID', label: 'هجين' },
];

export function RecitationRuleCatalogPanel() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecitationRuleStatus | 'ALL'>('ALL');

  const catalog = useMemo(() => loadRecitationCatalog(), [refreshToken]);
  const families = useMemo(() => listFamilies(), [refreshToken]);
  const types = useMemo(
    () => (selectedFamilyId ? listTypes(selectedFamilyId) : []),
    [selectedFamilyId, refreshToken]
  );
  const options = useMemo(
    () => (selectedTypeId ? listOptions(selectedTypeId) : []),
    [selectedTypeId, refreshToken]
  );

  const filteredFamilies = useMemo(() => {
    return families.filter((f) => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (search && !f.name.includes(search) && !f.code.includes(search)) return false;
      return true;
    });
  }, [families, search, statusFilter]);

  const selectedFamily = selectedFamilyId ? getFamily(selectedFamilyId) : null;
  const selectedType = selectedTypeId ? getRuleType(selectedTypeId) : null;

  const handleCreateFamily = () => {
    const newFamily: RecitationRuleFamily = {
      id: createFamilyId(),
      code: `FAMILY_${Date.now().toString(36).toUpperCase()}`,
      name: 'مجموعة جديدة',
      description: '',
      order: families.length + 1,
      status: 'DRAFT',
      editorMode: 'MANUAL_TEXT',
      renderCategory: 'FARSH',
    };
    saveFamily(newFamily);
    setSelectedFamilyId(newFamily.id);
    setRefreshToken((t) => t + 1);
  };

  const handleCreateType = () => {
    if (!selectedFamilyId) return;
    const newType: RecitationRuleType = {
      id: createRuleTypeId(),
      familyId: selectedFamilyId,
      code: `TYPE_${Date.now().toString(36).toUpperCase()}`,
      name: 'نوع جديد',
      description: '',
      detectionMode: 'MANUAL',
      optionMode: 'SINGLE',
      status: 'DRAFT',
      order: types.length + 1,
    };
    saveRuleType(newType);
    setSelectedTypeId(newType.id);
    setRefreshToken((t) => t + 1);
  };

  const handleCreateOption = () => {
    if (!selectedTypeId) return;
    const newOpt: RecitationRuleOption = {
      id: createRuleOptionId(),
      ruleTypeId: selectedTypeId,
      label: 'وجه جديد',
      numericValue: 2,
      unit: 'HARAKAT',
      order: options.length + 1,
      status: 'DRAFT',
    };
    try {
      saveRuleOption(newOpt);
      setRefreshToken((t) => t + 1);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div data-ui-id="A157" className="space-y-6">
      {/* شريط أدوات */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">مكتبة القواعد القرائية</h2>
          <p className="text-xs text-gray-500">إدارة المجموعات والأنواع والخيارات — المعرفات الدلالية مستقرة</p>
        </div>
        <div className="flex items-center gap-2">
          <input data-ui-id="A1820"
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select data-ui-id="A1821"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option data-ui-id="A1822" value="ALL">كل الحالات</option>
            {STATUS_OPTIONS.map((o) => (
              <option data-ui-id={UI_RecitationRuleCatalogPanel_0[o.value as keyof typeof UI_RecitationRuleCatalogPanel_0]} key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button data-ui-id="A1831"
            type="button"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'إعادة الكتالوج إلى الافتراضي؟',
                message: 'سيتم حذف كل التعديلات وإرجاع المدود الافتراضية.',
                impacts: [{ label: 'عائلات', count: families.length }],
                undoable: false,
              });
              if (ok) {
                resetCatalog();
                setSelectedFamilyId(null);
                setSelectedTypeId(null);
                setRefreshToken((t) => t + 1);
              }
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            إعادة الضبط
          </button>
        </div>
      </div>

      {/* شبكة العرض */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* قائمة العائلات */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">المجموعات ({toArabicDigits(filteredFamilies.length)})</h3>
            <button data-ui-id="A1832"
              type="button"
              onClick={handleCreateFamily}
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
            >
              + مجموعة
            </button>
          </div>
          <ul data-ui-id="A1833" className="space-y-2">
            {filteredFamilies.map((fam) => (
              <li data-ui-instance={String(fam.id)} data-ui-id="A1834" key={fam.id}>
                <button data-ui-instance={String(fam.id)} data-ui-id="A1835"
                  type="button"
                  onClick={() => {
                    setSelectedFamilyId(fam.id);
                    setSelectedTypeId(null);
                  }}
                  className={`w-full rounded-lg border p-3 text-right transition-colors ${
                    selectedFamilyId === fam.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">{fam.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{fam.code}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>{fam.editorMode}</span>
                    <span>·</span>
                    <span>{STATUS_OPTIONS.find((s) => s.value === fam.status)?.label}</span>
                    <span>·</span>
                    <span>{listTypes(fam.id).length} أنواع</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    الاستخدام: {catalog.types.filter((t) => t.familyId === fam.id).reduce((sum, t) => sum + listOptions(t.id).length, 0)} خيارات
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* تفاصيل المجموعة والأنواع */}
        <div className="space-y-4">
          {selectedFamily ? (
            <>
              <FamilyEditor
                family={selectedFamily}
                onSave={(fam) => {
                  saveFamily(fam);
                  setRefreshToken((t) => t + 1);
                }}
                onDelete={async () => {
                  const ok = await confirmAction({
                    title: `حذف مجموعة ${selectedFamily.name}؟`,
                    message: 'سيتم حذف كل الأنواع والخيارات التابعة.',
                    impacts: [{ label: 'أنواع', count: listTypes(selectedFamily.id).length }],
                    undoable: false,
                    tone: 'danger',
                  });
                  if (ok) {
                    deleteFamily(selectedFamily.id);
                    setSelectedFamilyId(null);
                    setRefreshToken((t) => t + 1);
                  }
                }}
              />

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">أنواع القاعدة ({toArabicDigits(types.length)})</h3>
                  <button data-ui-id="A1836"
                    type="button"
                    onClick={handleCreateType}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    + نوع
                  </button>
                </div>
                {types.length === 0 ? (
                  <p className="text-xs text-gray-400">لا أنواع بعد.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {types.map((tp) => (
                      <button data-ui-instance={String(tp.id)} data-ui-id="A1837"
                        key={tp.id}
                        type="button"
                        onClick={() => setSelectedTypeId(tp.id)}
                        className={`rounded-lg border p-3 text-right ${
                          selectedTypeId === tp.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{tp.name}</span>
                          <span className="text-[10px] text-gray-500">{tp.code}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {tp.detectionMode} · {STATUS_OPTIONS.find((s) => s.value === tp.status)?.label} · {listOptions(tp.id).length} خيارات
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedType && (
                <TypeEditor
                  type={selectedType}
                  onSave={(tp) => {
                    saveRuleType(tp);
                    setRefreshToken((t) => t + 1);
                  }}
                  onDelete={async () => {
                    const ok = await confirmAction({
                      title: `حذف نوع ${selectedType.name}؟`,
                      message: 'سيتم حذف كل الخيارات التابعة.',
                      impacts: [{ label: 'خيارات', count: listOptions(selectedType.id).length }],
                      undoable: false,
                      tone: 'danger',
                    });
                    if (ok) {
                      deleteRuleType(selectedType.id);
                      setSelectedTypeId(null);
                      setRefreshToken((t) => t + 1);
                    }
                  }}
                  options={options}
                  onCreateOption={handleCreateOption}
                  onSaveOption={(opt) => {
                    saveRuleOption(opt);
                    setRefreshToken((t) => t + 1);
                  }}
                  onDeleteOption={async (optId) => {
                    const ok = await confirmAction({
                      title: 'حذف الخيار؟',
                      message: 'سيتم حذف هذا الوجه/القيمة.',
                      undoable: false,
                    });
                    if (ok) {
                      deleteRuleOption(optId);
                      setRefreshToken((t) => t + 1);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              اختر مجموعة من القائمة لعرض أنواعها.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FamilyEditor({
  family,
  onSave,
  onDelete,
}: {
  family: RecitationRuleFamily;
  onSave: (fam: RecitationRuleFamily) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(family);
  useEffect(() => setDraft(family), [family]);

  return (
    <div data-ui-id="A1838" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-gray-900">معلومات المجموعة</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">الاسم</span>
          <input data-ui-id="A1839"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">المعرف الدلالي (code)</span>
          <input data-ui-id="A1840"
            type="text"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">الحالة</span>
          <select data-ui-id="A1841"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option data-ui-id={UI_FamilyEditor_1[o.value as keyof typeof UI_FamilyEditor_1]} key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">طريقة الإدخال</span>
          <select data-ui-id="A1850"
            value={draft.editorMode}
            onChange={(e) => setDraft({ ...draft, editorMode: e.target.value as any })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {EDITOR_MODES.map((o) => (
              <option data-ui-id={UI_FamilyEditor_2[o.value as keyof typeof UI_FamilyEditor_2]} key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs md:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">الوصف</span>
          <textarea data-ui-id="A1854"
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button data-ui-id="A1855"
          type="button"
          onClick={() => onSave(draft)}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700"
        >
          حفظ المجموعة
        </button>
        <button data-ui-id="A1856"
          type="button"
          onClick={onDelete}
          className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        >
          حذف
        </button>
        <span className="text-[11px] text-gray-400">id: {draft.id}</span>
      </div>
    </div>
  );
}

function TypeEditor({
  type,
  onSave,
  onDelete,
  options,
  onCreateOption,
  onSaveOption,
  onDeleteOption,
}: {
  type: RecitationRuleType;
  onSave: (tp: RecitationRuleType) => void;
  onDelete: () => void;
  options: RecitationRuleOption[];
  onCreateOption: () => void;
  onSaveOption: (opt: RecitationRuleOption) => void;
  onDeleteOption: (optId: string) => void;
}) {
  const [draft, setDraft] = useState(type);
  useEffect(() => setDraft(type), [type]);

  return (
    <div data-ui-id="A1857" className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-violet-900">نوع القاعدة: {type.name}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">الاسم</span>
          <input data-ui-id="A1858"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">المعرف (code)</span>
          <input data-ui-id="A1859"
            type="text"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">طريقة الاكتشاف</span>
          <select data-ui-id="A1860"
            value={draft.detectionMode}
            onChange={(e) => setDraft({ ...draft, detectionMode: e.target.value as any })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {DETECTION_MODES.map((o) => (
              <option data-ui-id={UI_TypeEditor_3[o.value as keyof typeof UI_TypeEditor_3]} key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">الحالة</span>
          <select data-ui-id="A1865"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option data-ui-id={UI_TypeEditor_4[o.value as keyof typeof UI_TypeEditor_4]} key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs md:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">الوصف</span>
          <textarea data-ui-id="A1874"
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button data-ui-id="A1875"
          type="button"
          onClick={() => onSave(draft)}
          className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700"
        >
          حفظ النوع
        </button>
        <button data-ui-id="A1876"
          type="button"
          onClick={onDelete}
          className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        >
          حذف النوع
        </button>
        <span className="text-[11px] text-gray-400">id: {draft.id}</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-900">خيارات القاعدة / أوجه المد ({toArabicDigits(options.length)})</h4>
          <button data-ui-id="A1877"
            type="button"
            onClick={onCreateOption}
            className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
          >
            + إضافة وجه/قيمة
          </button>
        </div>
        {options.length === 0 ? (
          <p className="text-[11px] text-gray-400">لا خيارات بعد. أضف وجهًا مثل 2 حركات، 4 حركات...</p>
        ) : (
          <ul data-ui-id="A1878" className="space-y-2">
            {options.map((opt) => (
              <OptionRow key={opt.id} option={opt} onSave={onSaveOption} onDelete={() => onDeleteOption(opt.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OptionRow({
  option,
  onSave,
  onDelete,
}: {
  option: RecitationRuleOption;
  onSave: (opt: RecitationRuleOption) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(option);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(option), [option]);

  const handleSave = () => {
    try {
      validateOption(draft);
      setError(null);
      onSave(draft);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <li data-ui-id="A1879" className="rounded border border-gray-200 p-2">
      <div className="grid gap-2 md:grid-cols-[1fr_100px_100px_80px_auto]">
        <input data-ui-id="A1880"
          type="text"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="مثال: 4 حركات"
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <input data-ui-id="A1881"
          type="number"
          min={1}
          step={1}
          value={draft.numericValue}
          onChange={(e) => setDraft({ ...draft, numericValue: Number(e.target.value) })}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="القيمة"
        />
        <select data-ui-id="A1882"
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option data-ui-id="A1883" value="HARAKAT">حركات</option>
          <option data-ui-id="A1884" value="OTHER">أخرى</option>
        </select>
        <select data-ui-id="A1885"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((o) => (
            <option data-ui-id={UI_OptionRow_5[o.value as keyof typeof UI_OptionRow_5]} key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button data-ui-id="A1894"
            type="button"
            onClick={handleSave}
            className="rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100"
          >
            حفظ
          </button>
          <button data-ui-id="A1895"
            type="button"
            onClick={onDelete}
            className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
          >
            حذف
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
        <span className="font-mono">id: {draft.id}</span>
        <span>· ترتيب: {draft.order}</span>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </li>
  );
}
