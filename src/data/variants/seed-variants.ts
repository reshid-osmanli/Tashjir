// اختلافات قرائية أولية - Seed Variants
// مشروع التشجير - نظام القراءات العشر
//
// ⚠️ تنبيه منهجي مهم:
//   كل الاختلافات في هذا الملف مسجّلة بحالة DRAFT (مسودة).
//   هي بذرة أولية لتشغيل المحرر واختباره، وليست مادة علمية معتمدة.
//   لا يجوز الاعتماد عليها قبل مراجعة مختص مجاز، ثم رفع الحالة إلى APPROVED
//   من داخل المشروع بعد مقابلتها على النشر وطيبة النشر.
//
//   نصوص الأدلة هنا إشارات إلى مواضع البحث في المصادر، وليست اقتباسا حرفيا
//   من المنظومة. إدخال النص الحرفي وبيت الطيبة مهمة المدقّق البشري.
//
// طريقة الترميز:
//   - startPosition / endPosition: ترتيب الكلمة داخل الآية (1-based).
//   - وجه واحد يجب أن يحمل isBase: true وهو نص المصحف المطبوع (رواية حفص).
//   - بقية الأوجه تُرسم خطوطا في المحرر.
//   - النطاق (scope) يُكتب بأقصر تعبير ممكن: IMAMS أفضل من تعداد الرواة.

import type { Variant } from '@/types/tashjeer';
import { makeAyahKey } from '@/data/quran';

/** أدوات مختصرة لبناء معرّفات الأئمة والرواة بشكل مقروء. */
const IMAM = {
  nafi: 'imam-nafi',
  ibnKathir: 'imam-ibn-kathir',
  abuAmr: 'imam-abu-amr',
  ibnAmir: 'imam-ibn-amir',
  asim: 'imam-asim',
  hamzah: 'imam-hamzah',
  kisai: 'imam-al-kisai',
  abuJafar: 'imam-abu-jafar',
  yaqub: 'imam-yaqub',
  khalaf: 'imam-khalaf',
} as const;

const NARRATOR = {
  qalun: 'narrator-qalun',
  warsh: 'narrator-warsh',
  bazzi: 'narrator-al-bazzi',
  qunbul: 'narrator-qunbul',
  duriAbuAmr: 'narrator-al-duri-abu-amr',
  susi: 'narrator-al-susi',
  hisham: 'narrator-hisham',
  ibnDhakwan: 'narrator-ibn-dhakwan',
  hafs: 'narrator-hafs',
  shubah: 'narrator-shubah',
  khalafHamzah: 'narrator-khalaf-hamzah',
  khallad: 'narrator-khallad',
  layth: 'narrator-al-layth',
  duriKisai: 'narrator-al-duri-kisai',
  ibnWardan: 'narrator-ibn-wardan',
  ibnJammaz: 'narrator-ibn-jammaz',
  ruways: 'narrator-ruways',
  rawh: 'narrator-rawh',
  idris: 'narrator-idris',
  ishaq: 'narrator-ishaq',
} as const;

/**
 * الاختلافات الأولية، مفهرسة بمعرّف الآية.
 * الفاتحة كاملة، ومقدمة البقرة، وسورة الإخلاص: عيّنة تغطي كل الفئات.
 */
export const SEED_VARIANTS: Variant[] = [
  // ============ الفاتحة 1:4 ============
  {
    id: 'v-1-4-malik',
    ayahKey: makeAyahKey(1, 4),
    category: 'FARSH',
    title: 'مَٰلِكِ / مَلِكِ',
    description:
      'إثبات الألف بعد الميم أو حذفها. من أشهر مواضع الفرش في الفاتحة، ويترتب عليه فرق في المعنى بين الملك والمالك.',
    startPosition: 1,
    endPosition: 1,
    status: 'DRAFT',
    sourceRef: 'النشر في القراءات العشر - فرش حروف سورة الفاتحة',
    alternatives: [
      {
        id: 'a-malik-base',
        text: 'مَٰلِكِ',
        label: 'بالألف',
        isBase: true,
        scope: {
          kind: 'IMAMS',
          imamIds: [IMAM.asim, IMAM.kisai, IMAM.yaqub, IMAM.khalaf],
        },
      },
      {
        id: 'a-malik-no-alif',
        text: 'مَلِكِ',
        label: 'بغير ألف',
        scope: {
          kind: 'IMAMS',
          imamIds: [
            IMAM.nafi,
            IMAM.ibnKathir,
            IMAM.abuAmr,
            IMAM.ibnAmir,
            IMAM.hamzah,
            IMAM.abuJafar,
          ],
        },
        evidences: [
          {
            id: 'e-malik-nashr',
            source: 'NASHR',
            text: 'موضعه في فرش حروف سورة الفاتحة من كتاب النشر لابن الجزري.',
            reference: 'النشر - فرش الفاتحة',
          },
        ],
      },
    ],
  },

  // ============ الفاتحة 1:7 ============
  {
    id: 'v-1-7-alayhim',
    ayahKey: makeAyahKey(1, 7),
    category: 'USUL',
    title: 'عَلَيۡهِمۡ - ضم الهاء',
    description:
      'ضم هاء الضمير في «عليهم» بدل كسرها. حكم أصولي مطّرد في نظائره مثل «إليهم» و«لديهم».',
    startPosition: 4,
    endPosition: 4,
    status: 'DRAFT',
    sourceRef: 'النشر - باب هاء الكناية وميم الجمع',
    alternatives: [
      {
        id: 'a-alayhim-base',
        text: 'عَلَيۡهِمۡ',
        label: 'بكسر الهاء',
        isBase: true,
        scope: {
          kind: 'ALL_EXCEPT',
          narratorIds: [
            NARRATOR.khalafHamzah,
            NARRATOR.khallad,
            NARRATOR.ruways,
            NARRATOR.rawh,
          ],
        },
      },
      {
        id: 'a-alayhim-damm',
        text: 'عَلَيۡهُمۡ',
        label: 'بضم الهاء',
        scope: { kind: 'IMAMS', imamIds: [IMAM.hamzah, IMAM.yaqub] },
        evidences: [
          {
            id: 'e-alayhim-nashr',
            source: 'NASHR',
            text: 'باب هاء الكناية وما يتصل بها من كتاب النشر.',
            reference: 'النشر - باب هاء الكناية',
          },
        ],
      },
    ],
  },
  {
    id: 'v-1-7-dallin',
    ayahKey: makeAyahKey(1, 7),
    category: 'MADUD',
    title: 'ٱلضَّآلِّينَ - المد اللازم',
    description:
      'مد لازم كلمي مثقّل، مقداره ست حركات باتفاق. أُدرج هنا للتوثيق البصري لا للخلاف.',
    startPosition: 9,
    endPosition: 9,
    status: 'DRAFT',
    sourceRef: 'النشر - باب المد والقصر',
    alternatives: [
      {
        id: 'a-dallin-base',
        text: 'ٱلضَّآلِّينَ',
        label: 'إشباع ست حركات',
        isBase: true,
        scope: { kind: 'ALL' },
      },
    ],
  },

  // ============ البقرة 2:3 ============
  {
    id: 'v-2-3-yuminun',
    ayahKey: makeAyahKey(2, 3),
    category: 'HAMZ',
    title: 'يُؤۡمِنُونَ - إبدال الهمز الساكن',
    description:
      'إبدال الهمزة الساكنة حرف مد من جنس حركة ما قبلها، فتصير «يُومنون». حكم أصولي مطّرد في نظائره.',
    startPosition: 2,
    endPosition: 2,
    status: 'DRAFT',
    sourceRef: 'النشر - باب الهمز المفرد',
    alternatives: [
      {
        id: 'a-yuminun-base',
        text: 'يُؤۡمِنُونَ',
        label: 'بتحقيق الهمز',
        isBase: true,
        scope: {
          kind: 'ALL_EXCEPT',
          narratorIds: [
            NARRATOR.warsh,
            NARRATOR.susi,
            NARRATOR.ibnWardan,
            NARRATOR.ibnJammaz,
          ],
        },
      },
      {
        id: 'a-yuminun-badal',
        text: 'يُومِنُونَ',
        label: 'بإبدال الهمز واوا',
        scope: {
          kind: 'NARRATORS',
          narratorIds: [
            NARRATOR.warsh,
            NARRATOR.susi,
            NARRATOR.ibnWardan,
            NARRATOR.ibnJammaz,
          ],
        },
        notes: 'ورش من طريق الأزرق. يحتاج تحرير الطرق عند التدقيق.',
        evidences: [
          {
            id: 'e-yuminun-nashr',
            source: 'NASHR',
            text: 'باب الهمز المفرد من كتاب النشر.',
            reference: 'النشر - الهمز المفرد',
          },
        ],
      },
    ],
  },

  // ============ البقرة 2:6 ============
  {
    id: 'v-2-6-aandhartahum',
    ayahKey: makeAyahKey(2, 6),
    category: 'HAMZ',
    title: 'ءَأَنذَرۡتَهُمۡ - الهمزتان من كلمة',
    description:
      'اجتماع همزتين في كلمة واحدة. فيه تحقيق الهمزتين، وتسهيل الثانية، وإدخال ألف فاصلة بينهما.',
    startPosition: 6,
    endPosition: 6,
    status: 'DRAFT',
    sourceRef: 'النشر - باب الهمزتين من كلمة',
    alternatives: [
      {
        id: 'a-aandhar-base',
        text: 'ءَأَنذَرۡتَهُمۡ',
        label: 'بتحقيق الهمزتين بلا إدخال',
        isBase: true,
        scope: {
          kind: 'IMAMS',
          imamIds: [IMAM.asim, IMAM.hamzah, IMAM.kisai, IMAM.khalaf, IMAM.ibnAmir],
        },
      },
      {
        id: 'a-aandhar-tasheel',
        text: 'ءَاَنذَرۡتَهُمۡ',
        label: 'بتسهيل الهمزة الثانية',
        scope: {
          kind: 'NARRATORS',
          narratorIds: [
            NARRATOR.warsh,
            NARRATOR.bazzi,
            NARRATOR.qunbul,
            NARRATOR.duriAbuAmr,
            NARRATOR.susi,
            NARRATOR.ruways,
            NARRATOR.rawh,
          ],
        },
        evidences: [
          {
            id: 'e-aandhar-nashr',
            source: 'NASHR',
            text: 'باب الهمزتين من كلمة من كتاب النشر.',
            reference: 'النشر - الهمزتان من كلمة',
          },
        ],
      },
      {
        id: 'a-aandhar-idkhal',
        text: 'ءَاٰأَنذَرۡتَهُمۡ',
        label: 'بالتسهيل مع إدخال ألف',
        scope: {
          kind: 'NARRATORS',
          narratorIds: [
            NARRATOR.qalun,
            NARRATOR.duriAbuAmr,
            NARRATOR.susi,
            NARRATOR.hisham,
            NARRATOR.ibnWardan,
            NARRATOR.ibnJammaz,
          ],
        },
        notes: 'لهشام خلاف في الإدخال. يحتاج تحرير الطرق عند التدقيق.',
      },
    ],
  },

  // ============ البقرة 2:9 ============
  {
    id: 'v-2-9-yakhdaun',
    ayahKey: makeAyahKey(2, 9),
    category: 'FARSH',
    title: 'يَخۡدَعُونَ / يُخَٰدِعُونَ',
    description: 'اختلاف الصيغة في الفعل الثاني بين المجرد والمزيد بالألف.',
    startPosition: 6,
    endPosition: 6,
    status: 'DRAFT',
    sourceRef: 'النشر - فرش حروف سورة البقرة',
    alternatives: [
      {
        id: 'a-yakhdaun-base',
        text: 'يَخۡدَعُونَ',
        label: 'بغير ألف',
        isBase: true,
        scope: {
          kind: 'IMAMS',
          imamIds: [IMAM.ibnAmir, IMAM.asim, IMAM.hamzah, IMAM.kisai, IMAM.yaqub, IMAM.khalaf],
        },
      },
      {
        id: 'a-yakhdaun-alif',
        text: 'يُخَٰدِعُونَ',
        label: 'بالألف',
        ruleLabel: 'بالألف',
        strength: 1,
        scope: {
          kind: 'IMAMS',
          imamIds: [IMAM.nafi, IMAM.ibnKathir, IMAM.abuAmr, IMAM.abuJafar],
        },
        evidences: [
          {
            id: 'e-yakhdaun-nashr',
            source: 'NASHR',
            text: 'فرش حروف سورة البقرة من كتاب النشر.',
            reference: 'النشر - فرش البقرة',
          },
        ],
      },
    ],
  },
  {
    id: 'v-2-9-munfasil',
    ayahKey: makeAyahKey(2, 9),
    category: 'MADUD',
    title: 'إِلَّآ أَنفُسَهُمۡ - المد المنفصل',
    description:
      'مد منفصل بين كلمتين. فيه القصر والتوسط والإشباع بحسب مذهب كل راو في المنفصل.',
    startPosition: 7,
    endPosition: 8,
    status: 'DRAFT',
    sourceRef: 'النشر - باب المد والقصر',
    alternatives: [
      {
        id: 'a-munfasil-base',
        text: 'إِلَّآ أَنفُسَهُمۡ',
        label: 'توسط أربع أو خمس حركات',
        isBase: true,
        scope: {
          kind: 'ALL_EXCEPT',
          narratorIds: [
            NARRATOR.qalun,
            NARRATOR.duriAbuAmr,
            NARRATOR.susi,
            NARRATOR.ibnWardan,
            NARRATOR.ibnJammaz,
            NARRATOR.ruways,
            NARRATOR.rawh,
            NARRATOR.warsh,
            NARRATOR.khalafHamzah,
            NARRATOR.khallad,
          ],
        },
      },
      {
        id: 'a-munfasil-qasr',
        text: 'إِلَّا أَنفُسَهُمۡ',
        label: 'القصر حركتان',
        ruleLabel: 'قصر',
        maddHarakat: 2,
        strength: 1,
        scope: {
          kind: 'NARRATORS',
          narratorIds: [
            NARRATOR.qalun,
            NARRATOR.duriAbuAmr,
            NARRATOR.susi,
            NARRATOR.ibnWardan,
            NARRATOR.ibnJammaz,
            NARRATOR.ruways,
            NARRATOR.rawh,
          ],
        },
        notes: 'لقالون خلاف بين القصر والتوسط. يحتاج تحرير الطرق.',
      },
      {
        id: 'a-munfasil-ishbaa',
        text: 'إِلَّآ أَنفُسَهُمۡ',
        label: 'الإشباع ست حركات',
        ruleLabel: 'إشباع',
        maddHarakat: 6,
        strength: 2,
        scope: { kind: 'IMAMS', imamIds: [IMAM.hamzah] },
        notes: 'ولورش من طريق الأزرق الإشباع كذلك. يحتاج تحرير الطرق.',
      },
    ],
  },

  // ============ البقرة 2:10 ============
  {
    id: 'v-2-10-yakdhibun',
    ayahKey: makeAyahKey(2, 10),
    category: 'FARSH',
    title: 'يَكۡذِبُونَ / يُكَذِّبُونَ',
    description:
      'اختلاف بين الثلاثي المجرد بمعنى الكذب، والمزيد المضعّف بمعنى التكذيب.',
    startPosition: 12,
    endPosition: 12,
    status: 'DRAFT',
    sourceRef: 'النشر - فرش حروف سورة البقرة',
    alternatives: [
      {
        id: 'a-yakdhibun-base',
        text: 'يَكۡذِبُونَ',
        label: 'بفتح الياء وإسكان الكاف وتخفيف الذال',
        isBase: true,
        scope: {
          kind: 'IMAMS',
          imamIds: [IMAM.asim, IMAM.hamzah, IMAM.kisai, IMAM.khalaf],
        },
      },
      {
        id: 'a-yakdhibun-tashdid',
        text: 'يُكَذِّبُونَ',
        label: 'بضم الياء وفتح الكاف وتشديد الذال',
        scope: {
          kind: 'IMAMS',
          imamIds: [
            IMAM.nafi,
            IMAM.ibnKathir,
            IMAM.abuAmr,
            IMAM.ibnAmir,
            IMAM.abuJafar,
            IMAM.yaqub,
          ],
        },
        evidences: [
          {
            id: 'e-yakdhibun-nashr',
            source: 'NASHR',
            text: 'فرش حروف سورة البقرة من كتاب النشر.',
            reference: 'النشر - فرش البقرة',
          },
        ],
      },
    ],
  },

  // ============ الإخلاص 112:4 ============
  {
    id: 'v-112-4-kufuwan',
    ayahKey: makeAyahKey(112, 4),
    category: 'FARSH',
    title: 'كُفُوًا / كُفُؤًا / كُفۡـًٔا',
    description:
      'ثلاثة أوجه: بضم الفاء والواو، وبضم الفاء والهمز، وبإسكان الفاء والهمز.',
    startPosition: 4,
    endPosition: 4,
    status: 'DRAFT',
    sourceRef: 'النشر - فرش حروف سورة الإخلاص',
    alternatives: [
      {
        id: 'a-kufuwan-base',
        text: 'كُفُوًا',
        label: 'بضم الفاء وواو خالصة',
        isBase: true,
        scope: { kind: 'NARRATORS', narratorIds: [NARRATOR.hafs] },
      },
      {
        id: 'a-kufuwan-hamz-damm',
        text: 'كُفُؤًا',
        label: 'بضم الفاء والهمز',
        scope: {
          kind: 'ALL_EXCEPT',
          narratorIds: [
            NARRATOR.hafs,
            NARRATOR.khalafHamzah,
            NARRATOR.khallad,
            NARRATOR.ruways,
            NARRATOR.rawh,
          ],
        },
      },
      {
        id: 'a-kufuwan-sukun',
        text: 'كُفۡـًٔا',
        label: 'بإسكان الفاء والهمز',
        scope: { kind: 'IMAMS', imamIds: [IMAM.hamzah, IMAM.yaqub] },
        evidences: [
          {
            id: 'e-kufuwan-nashr',
            source: 'NASHR',
            text: 'فرش حروف سورة الإخلاص من كتاب النشر.',
            reference: 'النشر - فرش الإخلاص',
          },
        ],
      },
    ],
  },
];

/** فهرس الاختلافات حسب معرّف الآية، لتفادي التصفية المتكررة. */
const variantsByAyah = SEED_VARIANTS.reduce((index, variant) => {
  const list = index.get(variant.ayahKey) ?? [];
  list.push(variant);
  index.set(variant.ayahKey, list);
  return index;
}, new Map<number, Variant[]>());

/**
 * يعيد الاختلافات الأولية لآية معينة.
 * @param ayahKey معرّف الآية (surah * 1000 + ayah)
 */
export function getSeedVariants(ayahKey: number): Variant[] {
  return variantsByAyah.get(ayahKey) ?? [];
}

/** معرّفات الآيات التي فيها بيانات أولية، لعرضها كمقترحات في المحرر. */
export const SEEDED_AYAH_KEYS: number[] = [...variantsByAyah.keys()].sort((a, b) => a - b);
