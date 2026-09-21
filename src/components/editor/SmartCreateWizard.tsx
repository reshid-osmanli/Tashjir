// معالج الإنشاء الذكي الموحّد — Smart Create Wizard (FR-ED-08 · FR-ED-09)
// مشروع التشجير - نظام القراءات العشر
//
// معالج واحد من ٧ خطوات يجمع ميزات الإنشاء المتفرقة السابقة في مكان واحد —
// باب الإنشاء الواحد (T3)، لا قوائم إنشاء منفصلة متكررة:
//  ١ التحديد البصري (كلمة/حروف/مدى/أهداف متفرقة) ← ٢ الأنواع والأوجه ←
//  ٣ الأوجه (نص + درجة قوة) ← ٤ نطاق القراء ← ٥ العلاقات (باقتراح Resolver) ←
//  ٦ النطاق الجغرافي/التعميم (معاينة Dry-run غير حاجبة) ← ٧ السياق والمراجعة
//
// لا يكتب المستخدم أي كود؛ المعالج يُنتج كيانات النموذج الموحّد عبر
// `buildSmartCreateBatch` (أو `buildSmartCreateMultiTargetBatch` لتكرار البنية
// لكل كلمة) ثم يطبّقها على المستند في معاملة واحدة. التعميم على المصحف يُنشئ
// قاعدة عامة حتمية لكل نوع ذريًا (كله أو لا شيء) بلا نسخ آلاف المستندات.

'use client';

import { DEFAULT_TYPE_RANK, ORDERED_VARIANT_CATEGORIES } from '@/lib/tashjeer/type-ranks';

import { useMemo, useRef, useState } from 'react';
import type { VariantCategory } from '@/types';
import type {
  CharacterAnchor,
  CharacterMatchScope,
  CharacterRange,
  GlobalCharacterPattern,
  GlobalCharacterSet,
  GlobalRulePattern,
  HarakaMatchMode,
  ReadingScope,
} from '@/types/tashjeer';
import type { GlobalRuleApplyRange } from '@/lib/storage/global-rules-store';
import type { RecitationContext } from '@/lib/tashjeer/model/v8';
import {
  buildSmartCreateBatch,
  buildSmartCreateMultiTargetBatch,
  mergeSelectionTargets,
  nextRangeClick,
  toggleWordTarget,
  type RangeClickState,
  type SmartCreateInput,
  type SmartSelectionLocus,
  type SmartVariantSpec,
} from '@/lib/tashjeer/smart-create';
import {
  deleteWizardTemplate,
  listWizardTemplates,
  readWizardPrefs,
  saveWizardPrefs,
  saveWizardTemplate,
  touchWizardTemplate,
  type WizardApplicationScope,
  type WizardContextMode,
  type WizardRelationMode,
  type WizardSavedTemplate,
  type WizardTemplateConfig,
} from '@/lib/tashjeer/wizard-templates';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { clusterCharacterAnchors, describeLoci, normalizeLocus } from '@/lib/tashjeer/loci';
import { occurrenceIndexOf, sortLocusDifferences } from '@/lib/tashjeer/difference-occurrences';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useEditorStore } from '@/stores/editor-store';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import {
  buildCharacterPattern,
  buildCharacterPatternForWords,
  countGlobalRuleMatchesInSurah,
  findGlobalRuleMatchesInAyah,
  GLOBAL_CHARACTER_SET_LABELS,
  mushafSurahIndex,
} from '@/lib/quran-logic/global-rule-engine';
import {
  characterCount,
  rangeFromCharacterAnchors,
  splitQuranCharacters,
  textForCharacterRange,
} from '@/lib/quran-logic/characters';
import {
  createGlobalRuleId,
  saveGlobalRuleBatch,
} from '@/lib/storage/global-rules-store';
import { decideMutualExclusion } from '@/lib/tashjeer/decision/resolver';
import { resolveScope } from '@/lib/tashjeer/scope';
import { ScopePicker } from './VariantEditor';
import type { GlobalRuleSeed } from './GlobalRuleBuilder';

interface SmartCreateWizardProps {
  selectionText: string;
  initialLoci: SmartSelectionLocus[];
  onClose: () => void;
  onComplete?: (message: string) => void;
  /**
   * طلب فتح منشئ القواعد الكامل (T3): الأنماط الصرفية/النحوية المتقدمة تُبنى
   * في `GlobalRuleBuilder` نفسه — لا شاشة مكررة — مزروعًا بإعداد المعالج.
   */
  onRequestFullBuilder?: (seed: GlobalRuleSeed) => void;
}

/** علاقة النوع الأول بكل هدف على حدة (FR-ED-08.4) — مع «جزء من» البنيوية (DM-03). */
type PerTargetRelation = 'RELATED' | 'MUTUALLY_EXCLUSIVE' | 'PART_OF' | 'NONE';
/** موضع مركّب واحد (loci) أم تكرار البنية لكل هدف (FR-ED-09). */
type TargetMode = 'COMPOSITE' | 'PER_TARGET';

/** قوالب جاهزة تعبّئ الأنواع والأوجه والعلاقة بنقرة واحدة (FR-ED-08.5). */
interface WizardTemplate {
  id: string;
  label: string;
  hint: string;
  config: WizardTemplateConfig;
}

const WIZARD_TEMPLATES: WizardTemplate[] = [
  {
    id: 'madd-tahqiq-sila',
    label: 'مد + تحقيق + صلة',
    hint: 'مد بأوجه: تحقيق، تحقيق + صلة، صلة + فرش — في عملية واحدة',
    config: {
      types: ['MADUD'],
      faces: { MADUD: 'تحقيق\nتحقيق + صلة\nصلة + فرش' },
      relationMode: 'NONE',
      context: 'ALWAYS',
    },
  },
  {
    id: 'madd-munfasil',
    label: 'مد منفصل',
    hint: 'مدود بأوجه القصر والتوسط والطول، وقفا ووصلا',
    config: {
      types: ['MADUD'],
      faces: { MADUD: 'قصر\nتوسط\nطول' },
      relationMode: 'NONE',
      context: 'ALWAYS',
    },
  },
  {
    id: 'farsh-usul',
    label: 'فرش مع أصول',
    hint: 'اختلاف فرشي يرافقه أصل، مرتبطان في الشجرة',
    config: { types: ['FARSH', 'USUL'], faces: {}, relationMode: 'RELATED_TREE', context: 'ALWAYS' },
  },
  {
    id: 'waqf-faces',
    label: 'أوجه الوقف',
    hint: 'سكون وروم وإشمام في الوقف فقط، متنافية',
    config: {
      types: ['WAQF'],
      faces: { WAQF: 'سكون\nروم\nإشمام' },
      relationMode: 'MUTUALLY_EXCLUSIVE',
      context: 'WAQF_ONLY',
    },
  },
  {
    id: 'hamz',
    label: 'همز',
    hint: 'تحقيق وتسهيل وإبدال',
    config: {
      types: ['HAMZ'],
      faces: { HAMZ: 'تحقيق\nتسهيل\nإبدال' },
      relationMode: 'NONE',
      context: 'ALWAYS',
    },
  },
];

const CATEGORY_ORDER = ORDERED_VARIANT_CATEGORIES;

const STEP_LABELS = ['التحديد', 'الأنواع', 'الأوجه', 'القرّاء', 'العلاقات', 'النطاق', 'المراجعة'] as const;

const HARAKA_MODE_OPTIONS: Array<{ value: HarakaMatchMode; label: string }> = [
  { value: 'EXACT', label: 'مطابقة الضبط المحدد' },
  { value: 'IGNORE', label: 'تجاهل الحركة (أي حركة)' },
  { value: 'SAKIN', label: 'ساكن (بعلامة السكون أو معرّى)' },
  { value: 'NONE', label: 'بلا أي علامة فقط' },
];

const MATCH_SCOPE_OPTIONS: Array<{ value: CharacterMatchScope; label: string }> = [
  { value: 'WORDS', label: 'بين الكلمات كما حُدِّد' },
  { value: 'INSIDE_WORD', label: 'داخل الكلمة الواحدة' },
  { value: 'BOTH', label: 'بين الكلمات وداخلها معا' },
];

interface DryRunState {
  phase: 'idle' | 'running' | 'done' | 'cancelled';
  doneSurahs: number;
  totalSurahs: number;
  counts: Array<{ type: VariantCategory; count: number }>;
  /** مواضع مطابقة ستُتخطى في الآية الحالية لوجود اختلاف محلي من نوعها. */
  skippedHere: number;
}

const IDLE_DRY_RUN: DryRunState = { phase: 'idle', doneSurahs: 0, totalSurahs: 0, counts: [], skippedHere: 0 };

export function SmartCreateWizard({
  selectionText,
  initialLoci,
  onClose,
  onComplete,
  onRequestFullBuilder,
}: SmartCreateWizardProps) {
  const { document, applySmartCreateBatch, transactExternal } = useEditorStore();
  const strengthCatalog = useStrengthDegrees();

  const words = useMemo(() => (document ? documentWindowWords(document) : []), [document]);
  const wordLengths = useMemo(
    () => new Map(words.map((word) => [word.position, characterCount(word.text)])),
    [words]
  );

  const safeInitialLoci = initialLoci.length > 0 ? initialLoci : [{ startPosition: 1, endPosition: 1 }];
  const initialPrimary = safeInitialLoci[0]!;
  const initialCharacterRange = initialPrimary.characterRange;

  const [step, setStep] = useState(0);
  const [advanced, setAdvanced] = useState(() => readWizardPrefs().advanced);
  const [selectedTypes, setSelectedTypes] = useState<VariantCategory[]>(['TAHQIQ', 'USUL', 'FARSH']);
  const [variantsText, setVariantsText] = useState<Record<string, string>>({});
  const [typeStrength, setTypeStrength] = useState<Record<string, string>>({});
  const [typeText, setTypeText] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<ReadingScope>({ kind: 'ALL' });
  const [relationMode, setRelationMode] = useState<WizardRelationMode>('RELATED_TREE');
  const [applicationScope, setApplicationScope] = useState<WizardApplicationScope>('LOCAL');
  const [context, setContext] = useState<WizardContextMode>('ALWAYS');
  const [contextByType, setContextByType] = useState<Partial<Record<VariantCategory, WizardContextMode>>>({});
  // المدى الرئيسي بآلة النقر النقيّة: نقرة للبداية ونقرة للنهاية (مثبت).
  const [rangeClick, setRangeClick] = useState<RangeClickState | null>(() => ({
    start: Math.min(initialPrimary.startPosition, initialPrimary.endPosition),
    end: Math.max(initialPrimary.startPosition, initialPrimary.endPosition),
    pinned: initialPrimary.startPosition !== initialPrimary.endPosition,
  }));
  // أهداف متفرقة (FR-ED-09): تُستقبل من تعليم المحرر وتُعدَّل هنا.
  const [extraRanges, setExtraRanges] = useState<SmartSelectionLocus[]>(() =>
    safeInitialLoci.slice(1).map((locus) => ({
      startPosition: Math.min(locus.startPosition, locus.endPosition),
      endPosition: Math.max(locus.startPosition, locus.endPosition),
      characterRange: locus.characterRange,
    }))
  );
  const [targetMode, setTargetMode] = useState<TargetMode>('PER_TARGET');
  const [pendingExtraStart, setPendingExtraStart] = useState<number | null>(null);
  // تحديد الحروف داخل المعالج: نقرات تُجمَّع نطاقات متصلة.
  const [letterMode, setLetterMode] = useState(false);
  const [letterAnchors, setLetterAnchors] = useState<CharacterAnchor[]>([]);
  // علاقة لكل هدف على حدة عند اختيار «مخصص».
  const [perTargetRelations, setPerTargetRelations] = useState<Partial<Record<VariantCategory, PerTargetRelation>>>({});
  // مدى الآيات عند نطاق AYAH_RANGE.
  const [rangeFromAyah, setRangeFromAyah] = useState<number>(document?.ayahNumber ?? 1);
  const [rangeToAyah, setRangeToAyah] = useState<number>(document?.ayahNumber ?? 1);
  // خيارات نمط التعميم الحتمي (الخطوة 6).
  const [harakaDefault, setHarakaDefault] = useState<HarakaMatchMode>('EXACT');
  const [matchScope, setMatchScope] = useState<CharacterMatchScope>('WORDS');
  const [letterSetOverrides, setLetterSetOverrides] = useState<Record<string, GlobalCharacterSet>>({});
  const [dryRun, setDryRun] = useState<DryRunState>(IDLE_DRY_RUN);
  const dryRunCancel = useRef(false);
  const [userTemplates, setUserTemplates] = useState<WizardSavedTemplate[]>(() => listWizardTemplates());
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');

  // ---------- التحديد (الخطوة 1) ----------

  /** نطاقات الحروف المنقورة داخل المعالج، مجمّعة بمواضع متصلة. */
  const letterClusters = useMemo(
    () => (letterAnchors.length === 0 ? [] : clusterCharacterAnchors(letterAnchors, wordLengths)),
    [letterAnchors, wordLengths]
  );

  /** المدى الحرفي الفعّال: نقرات المعالج، وإلا تحديد المحرر الأصلي. */
  const characterRange: CharacterRange | undefined = useMemo(() => {
    if (letterClusters.length > 0) return letterClusters[0];
    if (letterAnchors.length > 0) return rangeFromCharacterAnchors(letterAnchors) ?? undefined;
    return initialCharacterRange;
  }, [initialCharacterRange, letterAnchors, letterClusters]);

  const primary: SmartSelectionLocus = useMemo(() => {
    const start = rangeClick ? Math.min(rangeClick.start, rangeClick.end) : initialPrimary.startPosition;
    const end = rangeClick ? Math.max(rangeClick.start, rangeClick.end) : initialPrimary.endPosition;
    if (!characterRange) return { startPosition: start, endPosition: end };
    // المدى الحرفي يضبط حدود الكلمات على مواضع حروفه.
    return normalizeLocus({ startPosition: start, endPosition: end, characterRange });
  }, [characterRange, initialPrimary.endPosition, initialPrimary.startPosition, rangeClick]);

  /** عناقيد الحروف المتباعدة بعد الأول تصير أهدافًا إضافية تلقائيًا. */
  const letterExtraRanges: SmartSelectionLocus[] = useMemo(
    () =>
      letterClusters.slice(1).map((range) => ({
        startPosition: range.start.position,
        endPosition: range.end.position,
        characterRange: range,
      })),
    [letterClusters]
  );

  const loci = useMemo(
    () => mergeSelectionTargets(primary, [...extraRanges, ...letterExtraRanges]),
    [extraRanges, letterExtraRanges, primary]
  );

  /** أهداف الإنشاء: موضع مركّب واحد أم هدف مستقل لكل تحديد (FR-ED-09). */
  const targets = useMemo<SmartSelectionLocus[][]>(() => {
    if (targetMode !== 'PER_TARGET' || loci.length < 2) return [loci];
    // هدف داخل المدى الرئيسي تمامًا ليس هدفًا مستقلًا — يُستبعد من التكرار.
    const standalone = loci.filter(
      (locus) =>
        locus === primary ||
        locus.startPosition < primary.startPosition ||
        locus.endPosition > primary.endPosition
    );
    return standalone.length > 1 ? standalone.map((locus) => [locus]) : [loci];
  }, [loci, primary, targetMode]);

  const textOfLoci = useMemo(() => {
    const textOf = (ranges: SmartSelectionLocus[]): string => {
      if (!document) return selectionText;
      return ranges
        .map((range) =>
          range.characterRange
            ? textForCharacterRange(words, range.characterRange)
            : words
                .filter((word) => word.position >= range.startPosition && word.position <= range.endPosition)
                .map((word) => word.text)
                .join(' ')
        )
        .filter(Boolean)
        .join('  ·  ');
    };
    return textOf;
  }, [document, selectionText, words]);

  const selectedText = textOfLoci(loci) || selectionText;
  const targetTitles = useMemo(() => targets.map((target) => textOfLoci(target)), [targets, textOfLoci]);
  const baseTitle = selectedText.trim();

  // ---------- الأنواع والأوجه (الخطوتان 2 و3) ----------

  const variantsByType = useMemo<Partial<Record<VariantCategory, SmartVariantSpec[]>>>(() => {
    const result: Partial<Record<VariantCategory, SmartVariantSpec[]>> = {};
    for (const type of selectedTypes) {
      const raw = variantsText[type] ?? '';
      const strengthDegreeId = typeStrength[type] || undefined;
      const faceText = typeText[type]?.trim() || undefined;
      const faces = raw
        .split(/[\n,،]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label, text: faceText ?? selectedText, strengthDegreeId }));
      if (faces.length > 0) result[type] = faces;
    }
    return result;
  }, [selectedText, selectedTypes, typeStrength, typeText, variantsText]);

  const effectiveContextByType = useMemo<Partial<Record<VariantCategory, RecitationContext>>>(() => {
    const result: Partial<Record<VariantCategory, RecitationContext>> = {};
    for (const type of selectedTypes) {
      const override = contextByType[type];
      if (override && override !== context) result[type] = override;
    }
    return result;
  }, [context, contextByType, selectedTypes]);

  // ---------- العلاقات (الخطوة 5) مع اقتراح Resolver ----------

  /**
   * اقتراح السياسة لكل زوج (قرار واحد في مكان واحد): يُقرأ من Resolver
   * ويُعرض سببه، والمستخدم يعدّل — لا علاقات خفية (الحزمة 06 §8).
   */
  const relationSuggestions = useMemo(() => {
    if (selectedTypes.length < 2) return [];
    const first = selectedTypes[0]!;
    return selectedTypes.slice(1).map((type) => {
      const { decision } = decideMutualExclusion(first, type);
      return {
        type,
        suggested: (decision.exclusive ? 'MUTUALLY_EXCLUSIVE' : 'RELATED') as PerTargetRelation,
        reason: decision.reason,
      };
    });
  }, [selectedTypes]);

  const relations = useMemo(() => {
    if (relationMode === 'NONE' || selectedTypes.length < 2) return [];
    const first = selectedTypes[0]!;
    return selectedTypes
      .slice(1)
      .map((type) => {
        const relation: PerTargetRelation =
          relationMode === 'CUSTOM'
            ? (perTargetRelations[type] ??
              relationSuggestions.find((item) => item.type === type)?.suggested ??
              'RELATED')
            : relationMode === 'RELATED_TREE'
              ? 'RELATED'
              : 'MUTUALLY_EXCLUSIVE';
        return relation === 'NONE' ? null : { fromType: first, toType: type, type: relation };
      })
      .filter((item): item is { fromType: VariantCategory; toType: VariantCategory; type: Exclude<PerTargetRelation, 'NONE'> } => item !== null);
  }, [perTargetRelations, relationMode, relationSuggestions, selectedTypes]);

  /**
   * عدد العلاقات المختارة المخالفة لاقتراح السياسة: تُوثَّق عند الإنشاء
   * تصحيحات يدوية (Correction) تسبق السياسة عبر Resolver — حزمة 06 قاعدة 3.
   */
  const relationContradictions = useMemo(
    () =>
      relations.filter((relation) => {
        if (relation.type === 'PART_OF') return false;
        const suggestion = relationSuggestions.find((item) => item.type === relation.toType)?.suggested;
        return Boolean(suggestion) && suggestion !== relation.type;
      }).length,
    [relationSuggestions, relations]
  );

  const canCreateLocal = selectedTypes.length > 0 && loci.length > 0 && Boolean(baseTitle);
  /** نطاقات تُنشئ قاعدة عامة محفوظة (سورة/مدى آيات/مصحف). */
  const isGeneralizing =
    applicationScope === 'AYAH_RANGE' || applicationScope === 'SURAH' || applicationScope === 'MUSHAF';

  // ---------- النطاق الجغرافي والنمط الحتمي (الخطوة 6) ----------

  /** نطاق تطبيق القاعدة العامة المشتق من اختيار المستخدم. */
  const applyRange = useMemo((): GlobalRuleApplyRange | undefined => {
    if (!document) return undefined;
    if (applicationScope === 'SURAH') return { kind: 'SURAH', surahNumber: document.surahNumber };
    if (applicationScope === 'AYAH_RANGE') {
      return {
        kind: 'AYAH_RANGE',
        fromAyahKey: document.surahNumber * 1000 + Math.min(rangeFromAyah, rangeToAyah),
        toAyahKey: document.surahNumber * 1000 + Math.max(rangeFromAyah, rangeToAyah),
      };
    }
    return undefined;
  }, [applicationScope, document, rangeFromAyah, rangeToAyah]);

  /**
   * النمط الحتمي للتعميم: من الحروف المحددة، وإلا من الكلمات كاملة —
   * لا تحليل نحوي احتمالي أبدًا (قاعدة ملزمة 6).
   */
  const generalPattern = useMemo((): { pattern?: GlobalRulePattern; error?: string } => {
    if (!document || !canCreateLocal) return {};
    try {
      const base: GlobalCharacterPattern = characterRange
        ? buildCharacterPattern(document.ayahKey, characterRange, { defaultHarakaMode: harakaDefault })
        : buildCharacterPatternForWords(document.ayahKey, loci[0]!.startPosition, loci[0]!.endPosition, {
            defaultHarakaMode: harakaDefault,
          });
      const words = base.words.map((word) => ({
        ...word,
        constraints: word.constraints.map((constraint, constraintIndex) => {
          const key = `${word.offset}:${constraintIndex}`;
          const letterSet = letterSetOverrides[key];
          return letterSet && letterSet !== 'EXACT' ? { ...constraint, letterSet } : constraint;
        }),
      }));
      return { pattern: { ...base, words, matchScope } };
    } catch (caught) {
      return { error: caught instanceof Error ? caught.message : 'تعذر بناء نمط التعميم.' };
    }
  }, [canCreateLocal, characterRange, document, harakaDefault, letterSetOverrides, loci, matchScope]);

  const canGeneralize = isGeneralizing && Boolean(generalPattern.pattern) && canCreateLocal;

  /**
   * مواضع الآية المطابقة للنمط الحتمي (مسار «الآية» المباشر — بلا قاعدة):
   * عدّ فوري لآية واحدة لا يحتاج Dry-run غير حاجب (الحزمة 06 الخطوة 6).
   */
  const ayahMatches = useMemo(() => {
    if (applicationScope !== 'AYAH' || !document) return [];
    const pattern = generalPattern.pattern;
    if (!pattern) return [];
    try {
      return findGlobalRuleMatchesInAyah({ id: 'ayah-direct', pattern }, document.ayahKey);
    } catch {
      return [];
    }
  }, [applicationScope, document, generalPattern]);

  const canCreate =
    applicationScope === 'LOCAL'
      ? canCreateLocal
      : applicationScope === 'AYAH'
        ? canCreateLocal && Boolean(generalPattern.pattern) && ayahMatches.length > 0
        : canGeneralize;

  const resetDryRun = () => {
    dryRunCancel.current = true;
    setDryRun(IDLE_DRY_RUN);
  };

  /** معاينة Dry-run غير حاجبة: سورةً سورة مع مؤشر تقدم وإلغاء (NFR-02). */
  const runDryRun = async () => {
    const pattern = generalPattern.pattern;
    if (!pattern || !document) return;
    setError('');
    dryRunCancel.current = false;
    const surahs = mushafSurahIndex();
    setDryRun({ phase: 'running', doneSurahs: 0, totalSurahs: surahs.length, counts: [], skippedHere: 0 });
    const totals = new Map<VariantCategory, number>(selectedTypes.map((type) => [type, 0]));
    for (let index = 0; index < surahs.length; index += 1) {
      if (dryRunCancel.current) {
        setDryRun((current) => ({ ...current, phase: 'cancelled' }));
        return;
      }
      const surahNumber = surahs[index]!.surahNumber;
      for (const type of selectedTypes) {
        totals.set(type, (totals.get(type) ?? 0) + countGlobalRuleMatchesInSurah({ id: 'dry-run', pattern, applyRange }, surahNumber));
      }
      const doneSurahs = index + 1;
      setDryRun((current) => ({ ...current, doneSurahs }));
      // إفساح دورة حدث بين السور: يبقى المؤشر متحركًا وزر الإلغاء مستجيبًا.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // المواضع المتطابقة في الآية الحالية التي ستُتخطى لوجود اختلاف محلي نوعه.
    let skippedHere = 0;
    const hereMatches = findGlobalRuleMatchesInAyah({ id: 'dry-run', pattern, applyRange }, document.ayahKey);
    for (const type of selectedTypes) {
      const locals = document.variants.filter((variant) => variant.category === type);
      for (const match of hereMatches) {
        const overlaps = locals.some(
          (variant) => match.startPosition <= variant.endPosition && match.endPosition >= variant.startPosition
        );
        if (overlaps) skippedHere += 1;
      }
    }
    setDryRun({
      phase: 'done',
      doneSurahs: surahs.length,
      totalSurahs: surahs.length,
      counts: selectedTypes.map((type) => ({ type, count: totals.get(type) ?? 0 })),
      skippedHere,
    });
  };

  // ---------- القوالب والتفضيلات ----------

  const currentConfig = useMemo<WizardTemplateConfig>(
    () => ({
      types: selectedTypes,
      faces: Object.fromEntries(
        selectedTypes
          .map((type) => [type, variantsText[type] ?? ''] as const)
          .filter(([, text]) => text.trim())
      ) as Partial<Record<VariantCategory, string>>,
      relationMode,
      context,
      applicationScope,
    }),
    [applicationScope, context, relationMode, selectedTypes, variantsText]
  );

  const applyTemplateConfig = (config: WizardTemplateConfig) => {
    setSelectedTypes([...config.types].sort((a, b) => DEFAULT_TYPE_RANK[a] - DEFAULT_TYPE_RANK[b]));
    setVariantsText((current) => ({ ...current, ...config.faces }));
    setRelationMode(config.relationMode);
    setContext(config.context);
    if (config.applicationScope) setApplicationScope(config.applicationScope);
    setStep(1);
  };

  const handleSaveTemplate = () => {
    setError('');
    try {
      const saved = saveWizardTemplate(templateName.trim() || `قالب ${toArabicDigits(userTemplates.length + 1)}`, currentConfig);
      setUserTemplates(listWizardTemplates());
      setTemplateName('');
      onComplete?.(`حُفظ القالب «${saved.name}» — يعاد استخدامه بنقرة من المعالج أو الإنشاء السريع.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر حفظ القالب.');
    }
  };

  const toggleAdvanced = () => {
    const next = !advanced;
    setAdvanced(next);
    saveWizardPrefs({ advanced: next });
  };

  /** التالي/السابق مع تخطي الخطوات المكتملة الافتراضية في الوضع المتقدم. */
  const goNext = () => setStep((current) => (advanced && current === 1 ? 6 : Math.min(6, current + 1)));
  const goPrev = () => setStep((current) => (advanced && current === 6 ? 1 : Math.max(0, current - 1)));

  // ---------- المراجعة والإنشاء (الخطوة 7) ----------

  const preview = useMemo(() => {
    if (!canCreateLocal || !document) return { differences: 0, faces: 0, relations: 0 };
    const input: SmartCreateInput = {
      ayahKey: document.ayahKey,
      selection: loci,
      baseTitle,
      types: selectedTypes,
      typeRanks: DEFAULT_TYPE_RANK,
      scope,
      context,
      contextByType: effectiveContextByType,
      relations,
      variants: variantsByType,
    };
    if (targetMode === 'PER_TARGET' && targets.length > 1) {
      const result = buildSmartCreateMultiTargetBatch({ ...input, targets, titles: targetTitles });
      return {
        differences: result.differences.length,
        faces: result.differences.reduce((total, difference) => total + difference.variants.length, 0),
        relations: result.relations.length,
      };
    }
    const result = buildSmartCreateBatch(input);
    return {
      differences: result.differences.length,
      faces: result.differences.reduce((total, difference) => total + difference.variants.length, 0),
      relations: result.relations.length,
    };
  }, [baseTitle, canCreateLocal, context, document, effectiveContextByType, loci, relations, scope, selectedTypes, targetMode, targetTitles, targets, variantsByType]);

  const create = () => {
    if (!document) return;
    setError('');

    // مدخل موحّد للمسارين المباشرين (الموضع والآية): نفس الأنواع والأوجه
    // والعلاقات والسياق — يختلفان في قائمة الأهداف فقط.
    const input: SmartCreateInput = {
      ayahKey: document.ayahKey,
      selection: loci,
      baseTitle,
      types: selectedTypes,
      typeRanks: DEFAULT_TYPE_RANK,
      scope,
      context,
      contextByType: effectiveContextByType,
      relations,
      variants: variantsByType,
    };

    if (applicationScope === 'AYAH') {
      if (!canCreateLocal || ayahMatches.length === 0) {
        setError('لا مواضع مطابقة للنمط الحتمي في هذه الآية — عدّل التحديد أو إعدادات النمط.');
        return;
      }
      // الآية كلها مباشرةً بلا قاعدة عامة: البنية نفسها تُنشأ على كل موضع
      // مطابق في معاملة واحدة (ذرية: كله أو لا شيء، وتراجع واحد).
      const result = buildSmartCreateMultiTargetBatch({
        ...input,
        targets: ayahMatches.map((match) => [
          { startPosition: match.startPosition, endPosition: match.endPosition, characterRange: match.characterRange },
        ]),
        titles: ayahMatches.map((match) => match.matchedText),
      });
      applySmartCreateBatch(result);
      onComplete?.(
        `طبّق على الآية: أُنشئت ${toArabicDigits(result.differences.length)} اختلافات مستقلة على ${toArabicDigits(ayahMatches.length)} مواضع مطابقة مباشرةً بلا قاعدة عامة.`
      );
      onClose();
      return;
    }

    if (applicationScope === 'LOCAL') {
      if (!canCreateLocal) {
        setError('حدد موضعًا ونوعًا واحدًا على الأقل قبل الإنشاء.');
        return;
      }
      // معاملة واحدة: اختلافات مستقلة + علاقاتها + سجل تتبع واحد + تراجع واحد.
      const result =
        targetMode === 'PER_TARGET' && targets.length > 1
          ? buildSmartCreateMultiTargetBatch({ ...input, targets, titles: targetTitles })
          : buildSmartCreateBatch(input);
      applySmartCreateBatch(result);
      const targetNote =
        targetMode === 'PER_TARGET' && targets.length > 1
          ? ` على ${toArabicDigits(targets.length)} أهداف`
          : '';
      onComplete?.(
        `أُنشئت ${toArabicDigits(result.differences.length)} اختلافات مستقلة بمعرّفاتها وعلاقاتها في خطوة واحدة${targetNote}.`
      );
      onClose();
      return;
    }

    const pattern = generalPattern.pattern;
    if (!canGeneralize || !pattern) {
      setError(generalPattern.error ?? 'حدد موضعًا ونوعًا واحدًا على الأقل قبل التعميم.');
      return;
    }

    // التعميم: قاعدة عامة حتمية لكل نوع، تُحفظ ذريًا (كله أو لا شيء) في
    // معاملة تراجع موحدة مع سطر تتبع واحد — بلا نسخ آلاف المستندات.
    try {
      const inputs = selectedTypes.map((type) => {
        const faces = variantsByType[type] ?? [];
        return {
          id: createGlobalRuleId(),
          title: `${baseTitle} — ${CATEGORY_LABELS[type]}`,
          category: type,
          orderRank: DEFAULT_TYPE_RANK[type],
          recitationMode: (effectiveContextByType[type] ?? context) === 'ALWAYS' ? undefined : (effectiveContextByType[type] ?? context) as 'WAQF_ONLY' | 'WASL_ONLY',
          scope,
          ruleLabel: faces[0]?.label,
          pattern,
          applyRange,
          strengthDegreeId: faces[0]?.strengthDegreeId,
          status: 'DRAFT' as const,
          isActive: true,
        };
      });
      transactExternal(
        {
          action: 'تعميم دفعي من المعالج',
          targetType: 'RULE',
          targetId: inputs.map((input) => input.id).join(','),
          summary: `عمم المعالج ${toArabicDigits(inputs.length)} قواعد مستقلة على المصحف`,
        },
        () => {
          saveGlobalRuleBatch(inputs, { rankMode: 'TYPE' });
        }
      );
      const matchNote =
        dryRun.phase === 'done'
          ? ` — ${toArabicDigits(dryRun.counts.reduce((total, item) => total + item.count, 0))} موضعًا مطابقًا`
          : '';
      onComplete?.(
        `عُمم ${toArabicDigits(selectedTypes.length)} قواعد مستقلة برتبها على المصحف في عملية واحدة${matchNote}.`
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ القواعد المعممة.');
    }
  };

  const toggleType = (type: VariantCategory) => {
    setSelectedTypes((current) =>
      (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]).sort((a, b) => DEFAULT_TYPE_RANK[a] - DEFAULT_TYPE_RANK[b])
    );
  };

  /** نقرة كلمة: Ctrl يبدّل هدفًا، وإلا تبني المدى الرئيسي (بداية ثم نهاية). */
  const pickWord = (position: number, event?: React.MouseEvent) => {
    if (event?.ctrlKey || event?.metaKey) {
      const inPrimary = position >= primary.startPosition && position <= primary.endPosition;
      if (inPrimary && !extraRanges.some((range) => range.startPosition === position && range.endPosition === position)) {
        setError('هذه الكلمة داخل المدى الرئيسي — Ctrl+نقر لكلمة خارجه يضيفها هدفًا.');
        return;
      }
      setError('');
      resetDryRun();
      setExtraRanges((current) => toggleWordTarget(current, position));
      return;
    }
    if (pendingExtraStart !== null) {
      if (pendingExtraStart === -1) {
        setPendingExtraStart(position);
      } else {
        resetDryRun();
        setExtraRanges((current) => [
          ...current,
          { startPosition: Math.min(pendingExtraStart, position), endPosition: Math.max(pendingExtraStart, position) },
        ]);
        setPendingExtraStart(null);
      }
      return;
    }
    resetDryRun();
    setRangeClick((current) => nextRangeClick(current, position));
  };

  const toggleLetterAnchor = (anchor: CharacterAnchor) => {
    resetDryRun();
    setLetterAnchors((current) => {
      const exists = current.some(
        (item) => item.position === anchor.position && item.characterIndex === anchor.characterIndex
      );
      const next = exists
        ? current.filter((item) => item.position !== anchor.position || item.characterIndex !== anchor.characterIndex)
        : [...current, anchor];
      return next.sort((a, b) => a.position - b.position || a.characterIndex - b.characterIndex);
    });
  };

  const primaryStart = rangeClick ? Math.min(rangeClick.start, rangeClick.end) : initialPrimary.startPosition;
  const primaryEnd = rangeClick ? Math.max(rangeClick.start, rangeClick.end) : initialPrimary.endPosition;
  const primaryWords = words.filter((word) => word.position >= primaryStart && word.position <= primaryEnd);
  const startWordText = words.find((word) => word.position === primaryStart)?.text ?? '';
  const endWordText = words.find((word) => word.position === primaryEnd)?.text ?? '';

  // اختلافات قائمة في هذا الموضع (حزمة 05/T3): يُعرض وجودها ليكون «إضافة
  // اختلاف ثانٍ لنفس القارئ والكلمة» مباشرًا ومعلومًا — الإنشاء يضيف كيانًا
  // مستقلًا جديدًا ولا يستبدل القائمة ولا يدمجها.
  const existingAtPrimary = useMemo(() => {
    if (!document) return [];
    const covering = document.variants.filter(
      (variant) => variant.startPosition <= primaryEnd && variant.endPosition >= primaryStart
    );
    return sortLocusDifferences(covering);
  }, [document, primaryStart, primaryEnd]);

  const patternWords = generalPattern.pattern?.kind === 'CHARACTERS' ? generalPattern.pattern.words : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" role="dialog" aria-modal="true" aria-label="المعالج الذكي لإنشاء الاختلافات والأوجه">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">المعالج الذكي الموحّد</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
              أنشئ عدة اختلافات وأوجه وعلاقات دفعة واحدة من تحديد بصري، دون العودة لإنشاء كل عنصر منفصل.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-stone-600" title="يتخطى الخطوات المكتملة الافتراضية: من الأنواع إلى المراجعة مباشرة">
              <input type="checkbox" checked={advanced} onChange={toggleAdvanced} className="accent-emerald-600" />
              متقدم
            </label>
            <button type="button" onClick={onClose} className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100">
              إغلاق
            </button>
          </div>
        </header>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-stone-100 px-4 py-2">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                index === step ? 'bg-emerald-600 text-white' : index < step ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {toArabicDigits(index + 1)}. {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ١ — التحديد البصري</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                انقر الكلمة الأولى ثم الأخيرة لتثبيت مدى «كلمة ← كلمة» — بلا أرقام يدوية. وCtrl+نقر يضيف كلمات متفرقة أهدافًا مستقلة.
              </p>
              <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                {words.map((word) => {
                  const inRange = word.position >= primaryStart && word.position <= primaryEnd;
                  const inExtra = extraRanges.some((range) => word.position >= range.startPosition && word.position <= range.endPosition);
                  return (
                    <button
                      key={word.position}
                      type="button"
                      onClick={(event) => pickWord(word.position, event)}
                      className={`rounded-md border px-2 py-1 text-lg transition ${
                        inRange
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : inExtra
                            ? 'border-violet-400 bg-violet-50 text-violet-900'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300'
                      }`}
                      style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-900">
                  البداية: كلمة {toArabicDigits(primaryStart)} «{startWordText}»
                </span>
                <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-900">
                  النهاية: كلمة {toArabicDigits(primaryEnd)} «{endWordText}»
                </span>
                {rangeClick?.pinned || primaryStart !== primaryEnd ? (
                  <span className="rounded bg-emerald-600 px-2 py-1 font-medium text-white">✓ المدى مثبّت قبل الإنشاء</span>
                ) : (
                  <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">انقر كلمة النهاية لتثبيت المدى</span>
                )}
              </div>
              {existingAtPrimary.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
                  <p className="text-[11px] font-medium text-amber-950">
                    في هذا الموضع {toArabicDigits(existingAtPrimary.length)}{' '}
                    {existingAtPrimary.length === 1 ? 'اختلاف مسجّل' : 'اختلافات مسجّلة'} — الإنشاء هنا يضيف
                    اختلافًا مستقلًا جديدًا بمعرّفه ولا يستبدلها ولا يدمجها:
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {existingAtPrimary.map((variant) => (
                      <li key={variant.id} className="flex flex-wrap items-center gap-1 text-[10.5px] text-stone-700">
                        <span className="rounded bg-stone-800 px-1 py-0.5 text-[9px] text-white">
                          اختلاف {toArabicDigits(occurrenceIndexOf(variant, existingAtPrimary))}
                        </span>
                        <span className="min-w-0 truncate">{variant.title}</span>
                        <span className="rounded bg-white px-1 py-0.5 text-[9px] text-stone-500">
                          {CATEGORY_LABELS[variant.category] ?? variant.category}
                        </span>
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] ${
                            variant.origin === 'ENGINE' || variant.isGlobalDerived
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {variant.origin === 'ENGINE' || variant.isGlobalDerived ? 'محرك' : 'محرر'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-amber-900/80">
                    التنافي بينها (مدّان لا يُضربان) والارتباط يحسمهما محرك التراكيب من سياسات الاستوديو،
                    ويصحّحه المحرر يدويًا من لوحة التفاصيل («متنافيان/مرتبطان») بتوثيق Correction.
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">تحديد الحروف داخل المدى (اختياري)</p>
                  <div className="flex items-center gap-2">
                    {letterAnchors.length > 0 && (
                      <button type="button" onClick={() => { resetDryRun(); setLetterAnchors([]); }} className="text-[11px] text-red-700 hover:underline">
                        مسح الحروف
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLetterMode((value) => !value)}
                      className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                    >
                      {letterMode ? 'إخفاء الحروف' : 'إظهار الحروف'}
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-stone-500">
                  انقر الحرف فيضم تشكيله وضبطه كما في المحرر. المتصل نطاق واحد، والمتباعد أهداف إضافية تلقائيًا.
                </p>
                {letterMode && (
                  <div className="mt-2 space-y-2">
                    {primaryWords.map((word) => (
                      <div key={word.position} className="flex flex-wrap items-center gap-1 rounded bg-stone-50 p-2">
                        <span className="ml-1 text-[10px] text-stone-400">{toArabicDigits(word.position)}</span>
                        {splitQuranCharacters(word.text).map((character) => {
                          const active = letterAnchors.some(
                            (anchor) => anchor.position === word.position && anchor.characterIndex === character.index
                          );
                          return (
                            <button
                              key={character.index}
                              type="button"
                              onClick={() => toggleLetterAnchor({ position: word.position, characterIndex: character.index })}
                              className={`rounded border px-1.5 py-0.5 text-lg leading-relaxed ${
                                active
                                  ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                                  : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300'
                              }`}
                              style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                              aria-pressed={active}
                            >
                              {character.text}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
                {(characterRange || initialCharacterRange) && (
                  <p className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-900">
                    المدى الحرفي: {describeLoci([{ startPosition: primaryStart, endPosition: primaryEnd, characterRange: characterRange ?? initialCharacterRange }])}
                    {letterClusters.length > 1 && ` + ${toArabicDigits(letterClusters.length - 1)} نطاقات متباعدة كأهداف إضافية`}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-semibold text-stone-700">أهداف متفرقة (اختياري)</p>
                <p className="mt-0.5 text-[11px] text-stone-500">
                  Ctrl+نقر على أي كلمة يضيفها هدفًا فورًا، أو «إضافة هدف» ثم النقر على أولاه وأخراه لمدى إضافي.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {pendingExtraStart === null ? (
                    <button
                      type="button"
                      onClick={() => setPendingExtraStart(-1)}
                      className="rounded border border-emerald-300 bg-white px-2 py-1 text-[11px] text-emerald-800 hover:bg-emerald-50"
                    >
                      إضافة هدف
                    </button>
                  ) : (
                    <span className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                      {pendingExtraStart === -1 ? 'انقر الكلمة الأولى للهدف الإضافي' : `من ${toArabicDigits(pendingExtraStart)}: انقر الكلمة الأخيرة`}
                      <button type="button" onClick={() => setPendingExtraStart(null)} className="mr-2 underline">
                        إلغاء
                      </button>
                    </span>
                  )}
                  {extraRanges.map((range, index) => (
                    <span key={`${range.startPosition}-${range.endPosition}-${index}`} className="flex items-center gap-1 rounded bg-stone-100 px-2 py-1 text-[11px] text-stone-700">
                      {range.startPosition === range.endPosition
                        ? `كلمة ${toArabicDigits(range.startPosition)}`
                        : `${toArabicDigits(range.startPosition)} إلى ${toArabicDigits(range.endPosition)}`}
                      <button
                        type="button"
                        onClick={() => { resetDryRun(); setExtraRanges((current) => current.filter((_, idx) => idx !== index)); }}
                        className="text-red-700"
                        aria-label="إزالة الهدف"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                {loci.length > 1 && (
                  <div className="mt-2 space-y-1.5">
                    <label className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${targetMode === 'PER_TARGET' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                      <input type="radio" checked={targetMode === 'PER_TARGET'} onChange={() => setTargetMode('PER_TARGET')} className="accent-emerald-600" />
                      تكرار البنية لكل هدف: {toArabicDigits(targets.length)} نسخ مستقلة بعلاقاتها (الإسناد الدفعي)
                    </label>
                    <label className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${targetMode === 'COMPOSITE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                      <input type="radio" checked={targetMode === 'COMPOSITE'} onChange={() => setTargetMode('COMPOSITE')} className="accent-emerald-600" />
                      موضع مركّب واحد يجمع الأهداف (loci)
                    </label>
                  </div>
                )}
              </div>
              <p className="rounded bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
                المحدد: {describeLoci(loci)}
              </p>
              <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
                <p className="text-xs font-semibold text-violet-900">قوالب جاهزة</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WIZARD_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplateConfig(template.config)}
                      title={template.hint}
                      className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-violet-900 hover:bg-violet-100"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-violet-800">القالب يعبّئ الأنواع والأوجه والعلاقة والسياق؛ كل شيء قابل للتعديل بعده.</p>
                {userTemplates.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-semibold text-violet-900">قوالبي المحفوظة</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {userTemplates.map((template) => (
                        <span key={template.id} className="flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-2 py-1 text-xs text-violet-900">
                          <button
                            type="button"
                            onClick={() => { touchWizardTemplate(template.id); applyTemplateConfig(template.config); }}
                            title={template.hint ?? 'قالب محفوظ'}
                            className="hover:underline"
                          >
                            {template.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => { deleteWizardTemplate(template.id); setUserTemplates(listWizardTemplates()); }}
                            className="text-red-700"
                            aria-label={`حذف القالب ${template.name}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="اسم القالب الجديد"
                    className="w-44 rounded border border-violet-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="rounded-lg border border-violet-400 bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
                    title="يحفظ إعداد المعالج الحالي قالبًا يعاد استخدامه بنقرة (الإنشاء السريع)"
                  >
                    حفظ الإعداد الحالي قالبًا
                  </button>
                </div>
              </div>
              <p className="rounded bg-stone-50 px-3 py-2 text-sm leading-loose text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                {selectedText}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٢ — الأنواع المستقلة (تُطبَّق على الأوجه)</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                اختر وجهًا واحدًا أو عدة أوجه بـ checkboxes في العملية نفسها — كل نوع يُنشأ كيانًا مستقلًا برتبته الصريحة (تحقيق=١، أصول=٢، فرش=٣…)؛ تعديل أحدها لا يمس الآخر. لا عودة لإعادة التحديد لكل وجه.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORY_ORDER.map((type) => (
                  <label key={type} className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition ${selectedTypes.includes(type) ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-stone-200 bg-white text-stone-700'}`}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleType(type)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {CATEGORY_LABELS[type]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                الرتب: {selectedTypes.map((type) => `${toArabicDigits(DEFAULT_TYPE_RANK[type])} = ${CATEGORY_LABELS[type]}`).join(' · ') || '—'}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٣ — الأوجه المستقلة لكل نوع</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                اكتب أسماء الأوجه سطرًا سطرًا (أو مفصولة بفاصلة). لكل نوع: نص الوجه المقروء ودرجة قوته من سلّم الدرجات — كل وجه كيان مستقل برتبته داخل نوعه.
              </p>
              {selectedTypes.length === 0 && <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">اختر نوعًا واحدًا على الأقل أولًا.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {selectedTypes.map((type) => (
                  <div key={type} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <label className="mb-1 block text-xs font-semibold text-stone-700">{CATEGORY_LABELS[type]}</label>
                    <textarea
                      value={variantsText[type] ?? ''}
                      onChange={(event) => setVariantsText((current) => ({ ...current, [type]: event.target.value }))}
                      rows={3}
                      className="w-full rounded border border-stone-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="مثال: بالألف، بالسين، بالأشمام"
                    />
                    <input
                      value={typeText[type] ?? ''}
                      onChange={(event) => setTypeText((current) => ({ ...current, [type]: event.target.value }))}
                      placeholder="نص الوجه المقروء (افتراضي: نص التحديد)"
                      className="mt-2 w-full rounded border border-stone-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <label className="mt-2 block text-[11px] text-stone-500">
                      درجة القوة
                      <select
                        value={typeStrength[type] ?? ''}
                        onChange={(event) => setTypeStrength((current) => ({ ...current, [type]: event.target.value }))}
                        className="mt-1 w-full rounded border border-stone-300 bg-white p-1.5 text-xs"
                      >
                        <option value="">بلا درجة (تُضبط لاحقًا)</option>
                        {strengthCatalog.degrees.map((degree) => (
                          <option key={degree.id} value={degree.id}>{degree.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                الفارغ يعني إنشاء وجه المصحف (الأساس) فقط؛ يمكنك إضافة الأوجه لاحقًا من محرر الوجه.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٤ — نطاق القرّاء</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                اختر الأئمة/الرواة/الطرق كما في محرر الوجه؛ يُختصر النطاق تلقائيًا.
              </p>
              <ScopePicker scope={scope} onChange={setScope} />
              <p className="rounded bg-stone-50 px-3 py-2 text-xs text-stone-600">
                النطاق المختصر: <span className="font-medium">{describeLoci(loci)}</span> — {toArabicDigits(resolveScope(scope).length)} راويًا
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٥ — العلاقات بين الأنواع</h3>
              {relationSuggestions.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold text-sky-900">اقتراح السياسة (Resolver) — قابل للتعديل، لا علاقات خفية</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-sky-900">
                    {relationSuggestions.map((item) => (
                      <li key={item.type}>
                        {CATEGORY_LABELS[selectedTypes[0]!]} ← {CATEGORY_LABELS[item.type]}:{' '}
                        {item.suggested === 'RELATED' ? 'مرتبط' : 'متنافٍ'} — {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'RELATED_TREE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'RELATED_TREE'} onChange={() => setRelationMode('RELATED_TREE')} className="accent-emerald-600" />
                  علاقة «مرتبط» من النوع الأول إلى كل نوع لاحق
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'MUTUALLY_EXCLUSIVE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'MUTUALLY_EXCLUSIVE'} onChange={() => setRelationMode('MUTUALLY_EXCLUSIVE')} className="accent-emerald-600" />
                  تنافٍ (لا يُضربّا معًا) بين النوع الأول وكل نوع لاحق — يُحسم عبر Resolver، وما خالف اقتراح السياسة يُوثَّق تصحيحًا يسبقها
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'CUSTOM' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'CUSTOM'} onChange={() => setRelationMode('CUSTOM')} className="accent-emerald-600" />
                  علاقة مختلفة لكل هدف (الافتراض: اقتراح السياسة)
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'NONE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'NONE'} onChange={() => setRelationMode('NONE')} className="accent-emerald-600" />
                  لا أُنشئ علاقات تلقائية
                </label>
              </div>
              {relationMode === 'CUSTOM' && selectedTypes.length >= 2 && (
                <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-700">من «{CATEGORY_LABELS[selectedTypes[0]!]}» إلى:</p>
                  {selectedTypes.slice(1).map((type) => (
                    <div key={type} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-3 py-2 text-sm">
                      <span className="font-medium text-stone-800">{CATEGORY_LABELS[type]}</span>
                      <select
                        value={perTargetRelations[type] ?? relationSuggestions.find((item) => item.type === type)?.suggested ?? 'RELATED'}
                        onChange={(event) =>
                          setPerTargetRelations((current) => ({ ...current, [type]: event.target.value as PerTargetRelation }))
                        }
                        className="rounded border border-stone-300 px-2 py-1 text-xs"
                      >
                        <option value="RELATED">مرتبط</option>
                        <option value="MUTUALLY_EXCLUSIVE">تنافٍ</option>
                        <option value="PART_OF">جزء من</option>
                        <option value="NONE">بلا علاقة</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {relationMode === 'CUSTOM' && selectedTypes.length < 2 && (
                <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">اختر نوعين على الأقل لتعيين علاقة لكل هدف.</p>
              )}
              <p className="text-xs text-stone-500">قد تُعين العلاقة لاحقًا من لوحة العلاقات. قرارات الدمج نفسها محسومة في السياسات لا هنا.</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٦ — النطاق الجغرافي (التعميم)</h3>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'LOCAL' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={applicationScope === 'LOCAL'} onChange={() => { setApplicationScope('LOCAL'); resetDryRun(); }} className="accent-emerald-600" />
                  هذا الموضع فقط
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'AYAH' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input
                    type="radio"
                    checked={applicationScope === 'AYAH'}
                    onChange={() => { setApplicationScope('AYAH'); resetDryRun(); }}
                    className="accent-emerald-600"
                  />
                  هذه الآية كلها: كل المواضع المطابقة فيها مباشرةً (بلا قاعدة عامة)
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'AYAH_RANGE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input
                    type="radio"
                    checked={applicationScope === 'AYAH_RANGE'}
                    onChange={() => { setApplicationScope('AYAH_RANGE'); resetDryRun(); }}
                    className="accent-emerald-600"
                  />
                  مدى آيات في هذه السورة (قاعدة عامة مقيّدة)
                </label>
                {applicationScope === 'AYAH_RANGE' && document && (
                  <div className="mr-7 flex flex-wrap items-center gap-2 text-xs text-stone-700">
                    <span>من الآية</span>
                    <input
                      type="number"
                      min={1}
                      value={rangeFromAyah}
                      onChange={(event) => {
                        setRangeFromAyah(Math.max(1, Number(event.target.value) || 1));
                        resetDryRun();
                      }}
                      className="w-20 rounded border border-stone-300 px-2 py-1"
                    />
                    <span>إلى الآية</span>
                    <input
                      type="number"
                      min={1}
                      value={rangeToAyah}
                      onChange={(event) => {
                        setRangeToAyah(Math.max(1, Number(event.target.value) || 1));
                        resetDryRun();
                      }}
                      className="w-20 rounded border border-stone-300 px-2 py-1"
                    />
                    <span className="text-stone-500">في سورة رقم {toArabicDigits(document.surahNumber)}</span>
                  </div>
                )}
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'SURAH' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input
                    type="radio"
                    checked={applicationScope === 'SURAH'}
                    onChange={() => { setApplicationScope('SURAH'); resetDryRun(); }}
                    className="accent-emerald-600"
                  />
                  هذه السورة كلها (قاعدة عامة مقيّدة بالسورة)
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'MUSHAF' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input
                    type="radio"
                    checked={applicationScope === 'MUSHAF'}
                    onChange={() => { setApplicationScope('MUSHAF'); resetDryRun(); }}
                    className="accent-emerald-600"
                  />
                  المصحف كله (قاعدة عامة حتمية لكل نوع)
                </label>
              </div>
              {applicationScope !== 'LOCAL' && (
                <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
                  <p className="text-xs text-violet-900">
                    النمط حتمي من {characterRange ? 'الحروف المحددة' : 'الكلمات المحددة كاملة'} — يُنشأ لكل نوع مختار كيان مستقل برتبته
                    ({selectedTypes.map((type) => `${toArabicDigits(DEFAULT_TYPE_RANK[type])}=${CATEGORY_LABELS[type]}`).join('، ')})؛
                    التجميع في «عملية إنشاء» فقط لا في كيان واحد.
                  </p>
                  {generalPattern.error && (
                    <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">{generalPattern.error}</p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-[11px] text-stone-600">
                      سياسة الضبط الابتدائية لكل حرف
                      <select
                        value={harakaDefault}
                        onChange={(event) => { setHarakaDefault(event.target.value as HarakaMatchMode); resetDryRun(); }}
                        className="mt-1 w-full rounded border border-stone-300 bg-white p-1.5 text-xs"
                      >
                        {HARAKA_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] text-stone-600">
                      نطاق البحث عن التتابع
                      <select
                        value={matchScope}
                        onChange={(event) => { setMatchScope(event.target.value as CharacterMatchScope); resetDryRun(); }}
                        className="mt-1 w-full rounded border border-stone-300 bg-white p-1.5 text-xs"
                      >
                        {MATCH_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {patternWords.length > 0 && (
                    <div className="rounded border border-stone-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-stone-700">توسيع الحروف إلى مجموعات (اختياري)</p>
                      <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                        {patternWords.map((word) => (
                          <div key={word.offset} className="flex flex-wrap items-center gap-1 text-[11px]">
                            <span className="text-stone-400">ك{toArabicDigits(loci[0]!.startPosition + word.offset)}:</span>
                            {word.constraints.map((constraint, constraintIndex) => (
                              <select
                                key={constraintIndex}
                                value={letterSetOverrides[`${word.offset}:${constraintIndex}`] ?? 'EXACT'}
                                onChange={(event) => {
                                  const key = `${word.offset}:${constraintIndex}`;
                                  const value = event.target.value as GlobalCharacterSet;
                                  setLetterSetOverrides((current) => ({ ...current, [key]: value }));
                                  resetDryRun();
                                }}
                                title={`الحرف «${constraint.baseLetter}» — اختر مجموعة لتوسيعه`}
                                className="max-w-28 rounded border border-stone-300 bg-white px-1 py-0.5 text-[11px]"
                              >
                                {(Object.keys(GLOBAL_CHARACTER_SET_LABELS) as GlobalCharacterSet[]).map((set) => (
                                  <option key={set} value={set}>
                                    {set === 'EXACT' ? `«${constraint.baseLetter}» فقط` : GLOBAL_CHARACTER_SET_LABELS[set]}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {applicationScope === 'AYAH' && (
                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-700">
                        المواضع المطابقة للنمط في هذه الآية الآن: {toArabicDigits(ayahMatches.length)} موضعًا
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                        إنشاء مباشر بلا قاعدة عامة: تُولد البنية نفسها (أنواع + أوجه + علاقات) على كل موضع
                        مطابق في معاملة واحدة ذرية بتراجع واحد، وكل موضع كيان مستقل قابل للتعديل منفردًا.
                      </p>
                    </div>
                  )}
                  {isGeneralizing && dryRun.phase === 'idle' && (
                    <button
                      type="button"
                      onClick={() => void runDryRun()}
                      disabled={!generalPattern.pattern}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                    >
                      معاينة عدد المواضع المتطابقة (Dry-run)
                    </button>
                  )}
                  {isGeneralizing && dryRun.phase === 'running' && (
                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <div className="flex items-center justify-between text-[11px] text-stone-600">
                        <span>جارٍ فحص المصحف… السورة {toArabicDigits(dryRun.doneSurahs)} من {toArabicDigits(dryRun.totalSurahs)}</span>
                        <button
                          type="button"
                          onClick={() => { dryRunCancel.current = true; }}
                          className="rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
                        >
                          إلغاء
                        </button>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded bg-stone-100">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${dryRun.totalSurahs === 0 ? 0 : Math.round((dryRun.doneSurahs / dryRun.totalSurahs) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isGeneralizing && dryRun.phase === 'cancelled' && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-amber-800">أُلغيت المعاينة عند السورة {toArabicDigits(dryRun.doneSurahs)}.</p>
                      <button type="button" onClick={() => void runDryRun()} className="text-xs text-emerald-700 hover:underline">
                        إعادة التشغيل
                      </button>
                    </div>
                  )}
                  {isGeneralizing && dryRun.phase === 'done' && (
                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <ul className="space-y-1 text-xs text-stone-700">
                        {dryRun.counts.map(({ type, count }) => (
                          <li key={type}>{CATEGORY_LABELS[type]}: {toArabicDigits(count)} موضعًا مطابقًا</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[11px] text-stone-500">
                        ستُتخطى في هذه الآية {toArabicDigits(dryRun.skippedHere)} مواضع مطابقة لوجود اختلاف محلي من نوعها.
                      </p>
                      <button type="button" onClick={() => void runDryRun()} className="mt-1 text-[11px] text-emerald-700 hover:underline">
                        إعادة المعاينة
                      </button>
                    </div>
                  )}
                  {isGeneralizing && onRequestFullBuilder && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestFullBuilder({
                          title: baseTitle,
                          category: selectedTypes[0],
                          scope,
                          ruleLabel: selectedTypes[0] ? CATEGORY_LABELS[selectedTypes[0]] : undefined,
                          orderRank: 1,
                        })
                      }
                      className="w-full rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs text-violet-900 hover:bg-violet-50"
                      title="الأنماط الصرفية والنحوية المتقدمة (قوالب، خصائص، سلاسل كلمات) في المنشئ الكامل نفسه مزروعًا بإعدادك"
                    >
                      المنشئ الكامل: أنماط صرفية/نحوية متقدمة
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٧ — السياق والمراجعة</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'ALWAYS' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'ALWAYS'} onChange={() => setContext('ALWAYS')} className="accent-emerald-600" />
                  وقفًا ووصلًا
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'WAQF_ONLY' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'WAQF_ONLY'} onChange={() => setContext('WAQF_ONLY')} className="accent-emerald-600" />
                  وقفًا فقط
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'WASL_ONLY' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'WASL_ONLY'} onChange={() => setContext('WASL_ONLY')} className="accent-emerald-600" />
                  وصلًا فقط
                </label>
              </div>
              {selectedTypes.length > 1 && (
                <div className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-700">سياق مستقل لنوع واحد (اختياري — يتجاوز العام لذلك النوع)</p>
                  {selectedTypes.map((type) => (
                    <div key={type} className="flex items-center justify-between gap-2 rounded bg-white px-3 py-1.5 text-xs">
                      <span className="font-medium text-stone-800">{CATEGORY_LABELS[type]}</span>
                      <select
                        value={contextByType[type] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value as WizardContextMode | '';
                          setContextByType((current) => {
                            if (!value) {
                              const next = { ...current };
                              delete next[type];
                              return next;
                            }
                            return { ...current, [type]: value };
                          });
                        }}
                        className="rounded border border-stone-300 px-2 py-1 text-xs"
                      >
                        <option value="">كالمجموعة</option>
                        <option value="ALWAYS">وقفًا ووصلًا</option>
                        <option value="WAQF_ONLY">وقفًا فقط</option>
                        <option value="WASL_ONLY">وصلًا فقط</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-sm font-semibold text-stone-800">ملخص الإنشاء</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <Summary value={toArabicDigits(preview.differences)} label="اختلافًا مستقلاً" />
                  <Summary value={toArabicDigits(preview.faces)} label="وجهًا" />
                  <Summary value={toArabicDigits(preview.relations)} label="علاقة تلقائية" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  الهدف: {applicationScope === 'LOCAL' ? 'هذا الموضع' : applicationScope === 'AYAH' ? 'هذه الآية كلها (مباشر بلا قاعدة)' : applicationScope === 'SURAH' ? 'هذه السورة' : applicationScope === 'AYAH_RANGE' ? 'مدى آيات' : 'المصحف كله'}
                  {' · '}الأهداف: {applicationScope === 'AYAH' ? `${toArabicDigits(ayahMatches.length)} مواضع مطابقة` : targetMode === 'PER_TARGET' && targets.length > 1 ? `${toArabicDigits(targets.length)} أهداف مستقلة` : 'موضع واحد'}
                  {' · '}النطاق: من {selectedTextLabel(baseTitle)}
                  {' · '}العلاقات: {relationMode === 'NONE' ? 'لا تلقائية' : relationMode === 'RELATED_TREE' ? 'مرتبط' : relationMode === 'CUSTOM' ? 'لكل هدف' : 'متنافٍ'}
                  {isGeneralizing && dryRun.phase === 'done' && ` · المعاينة: ${dryRun.counts.map(({ type, count }) => `${CATEGORY_LABELS[type]} ${toArabicDigits(count)}`).join('، ')}`}
                </p>
                {relationContradictions > 0 && (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                    {toArabicDigits(relationContradictions)} {relationContradictions === 1 ? 'علاقة تخالف' : 'علاقات تخالف'} اقتراح السياسة (Resolver) — ستُوثَّق
                    تصحيحًا يدويًا (Correction) يسبق السياسة في محرك التراكيب، ويظهر في التتبع.
                  </p>
                )}
                <p className="mt-1 text-[11px] text-stone-500">
                  التنفيذ ذري (كله أو لا شيء) بدفعة تراجع واحدة، ويُسجَّل في التتبع.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-3">
          <div>
            {error && <p className="text-xs text-red-700">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              السابق
            </button>
            {step < 6 ? (
              <button type="button" onClick={goNext} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                التالي{advanced && step === 1 ? ' (تخطٍّ للمراجعة)' : ''}
              </button>
            ) : (
              <button
                type="button"
                onClick={create}
                disabled={!canCreate}
                className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                إنشاء
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function selectedTextLabel(baseTitle: string): string {
  return baseTitle.length > 40 ? `${baseTitle.slice(0, 37)}…` : baseTitle;
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-2 py-2">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}
