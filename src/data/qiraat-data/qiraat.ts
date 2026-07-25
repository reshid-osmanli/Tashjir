// بيانات القراءات والطرق
// المصدر المنهجي: ترتيب طيبة النشر، مع بنية قابلة للتوسع إلى مئات الطرق

import type {
  Narrator,
  Qiraah,
  ReadingImam,
  TransmissionPath,
  TransmissionSearchResult,
  Turuq,
} from '@/types';

// ==================== القراء العشرة ====================

export const READING_IMAMS: ReadingImam[] = [
  { id: 'imam-nafi', name: 'نافع', slug: 'nafi', order: 1, region: 'المدينة' },
  { id: 'imam-ibn-kathir', name: 'ابن كثير', slug: 'ibn-kathir', order: 2, region: 'مكة' },
  { id: 'imam-abu-amr', name: 'أبو عمرو', slug: 'abu-amr', order: 3, region: 'البصرة' },
  { id: 'imam-ibn-amir', name: 'ابن عامر', slug: 'ibn-amir', order: 4, region: 'الشام' },
  { id: 'imam-asim', name: 'عاصم', slug: 'asim', order: 5, region: 'الكوفة' },
  { id: 'imam-hamzah', name: 'حمزة', slug: 'hamzah', order: 6, region: 'الكوفة' },
  { id: 'imam-al-kisai', name: 'الكسائي', slug: 'al-kisai', order: 7, region: 'الكوفة' },
  { id: 'imam-abu-jafar', name: 'أبو جعفر', slug: 'abu-jafar', order: 8, region: 'المدينة' },
  { id: 'imam-yaqub', name: 'يعقوب', slug: 'yaqub', order: 9, region: 'البصرة' },
  { id: 'imam-khalaf', name: 'خلف', slug: 'khalaf', order: 10, region: 'الكوفة' },
];

// ==================== الرواة العشرون ====================

export const NARRATORS: Narrator[] = [
  { id: 'narrator-qalun', imamId: 'imam-nafi', name: 'قالون', slug: 'qalun', order: 1, legacyOrderInTayyibah: 1 },
  { id: 'narrator-warsh', imamId: 'imam-nafi', name: 'ورش', slug: 'warsh', order: 2, legacyOrderInTayyibah: 2 },
  { id: 'narrator-al-bazzi', imamId: 'imam-ibn-kathir', name: 'البزي', slug: 'al-bazzi', order: 1, legacyOrderInTayyibah: 3 },
  { id: 'narrator-qunbul', imamId: 'imam-ibn-kathir', name: 'قنبل', slug: 'qunbul', order: 2, legacyOrderInTayyibah: 4 },
  { id: 'narrator-al-duri-abu-amr', imamId: 'imam-abu-amr', name: 'الدوري', slug: 'al-duri-abu-amr', order: 1, legacyOrderInTayyibah: 5 },
  { id: 'narrator-al-susi', imamId: 'imam-abu-amr', name: 'السوسي', slug: 'al-susi', order: 2, legacyOrderInTayyibah: 6 },
  { id: 'narrator-hisham', imamId: 'imam-ibn-amir', name: 'هشام', slug: 'hisham', order: 1, legacyOrderInTayyibah: 7 },
  { id: 'narrator-ibn-dhakwan', imamId: 'imam-ibn-amir', name: 'ابن ذكوان', slug: 'ibn-dhakwan', order: 2, legacyOrderInTayyibah: 8 },
  { id: 'narrator-hafs', imamId: 'imam-asim', name: 'حفص', slug: 'hafs', order: 1, legacyOrderInTayyibah: 9 },
  { id: 'narrator-shubah', imamId: 'imam-asim', name: 'شعبة', slug: 'shubah', order: 2, legacyOrderInTayyibah: 10 },
  { id: 'narrator-khalaf-hamzah', imamId: 'imam-hamzah', name: 'خلف', slug: 'khalaf-hamzah', order: 1, legacyOrderInTayyibah: 11 },
  { id: 'narrator-khallad', imamId: 'imam-hamzah', name: 'خلاد', slug: 'khallad', order: 2, legacyOrderInTayyibah: 12 },
  { id: 'narrator-al-layth', imamId: 'imam-al-kisai', name: 'الليث', slug: 'al-layth', order: 1, legacyOrderInTayyibah: 13 },
  { id: 'narrator-al-duri-kisai', imamId: 'imam-al-kisai', name: 'الدوري', slug: 'al-duri-kisai', order: 2, legacyOrderInTayyibah: 14 },
  { id: 'narrator-ibn-wardan', imamId: 'imam-abu-jafar', name: 'ابن وردان', slug: 'ibn-wardan', order: 1, legacyOrderInTayyibah: 15 },
  { id: 'narrator-ibn-jammaz', imamId: 'imam-abu-jafar', name: 'ابن جماز', slug: 'ibn-jammaz', order: 2, legacyOrderInTayyibah: 16 },
  { id: 'narrator-ruways', imamId: 'imam-yaqub', name: 'رويس', slug: 'ruways', order: 1, legacyOrderInTayyibah: 17 },
  { id: 'narrator-rawh', imamId: 'imam-yaqub', name: 'روح', slug: 'rawh', order: 2, legacyOrderInTayyibah: 18 },
  { id: 'narrator-idris', imamId: 'imam-khalaf', name: 'إدريس', slug: 'idris', order: 1, legacyOrderInTayyibah: 19 },
  { id: 'narrator-ishaq', imamId: 'imam-khalaf', name: 'إسحاق', slug: 'ishaq', order: 2, legacyOrderInTayyibah: 20 },
];

export interface TransmissionPathSeed extends TransmissionPath {
  nodeNames: string[];
}

// هذه بذرة أولى فقط. التصميم يسمح باستيراد 980+ طريق من CSV/JSON لاحقا.
export const TRANSMISSION_PATH_SEEDS: TransmissionPathSeed[] = [
  path('path-qalun-abu-nashit', 'narrator-qalun', 'قالون / أبو نشيط', 'طريق أبي نشيط عن قالون عن نافع', 1, ['أبو نشيط']),
  path('path-qalun-al-halwani', 'narrator-qalun', 'قالون / الحلواني', 'طريق الحلواني عن قالون عن نافع', 2, ['الحلواني']),
  path('path-warsh-al-azraq', 'narrator-warsh', 'ورش / الأزرق', 'طريق الأزرق عن ورش عن نافع', 1, ['الأزرق']),
  path('path-warsh-al-asbahani', 'narrator-warsh', 'ورش / الأصبهاني', 'طريق الأصبهاني عن ورش عن نافع', 2, ['الأصبهاني']),
  path('path-bazzi-ibn-al-husayn', 'narrator-al-bazzi', 'البزي / ابن الحصين', 'طريق ابن الحصين عن البزي عن ابن كثير', 1, ['ابن الحصين']),
  path('path-bazzi-ibn-shanabudh', 'narrator-al-bazzi', 'البزي / ابن شنبوذ', 'طريق ابن شنبوذ عن البزي عن ابن كثير', 2, ['ابن شنبوذ']),
  path('path-qunbul-al-bazzaz', 'narrator-qunbul', 'قنبل / البزاز', 'طريق البزاز عن قنبل عن ابن كثير', 1, ['البزاز']),
  path('path-qunbul-ibn-shanabudh', 'narrator-qunbul', 'قنبل / ابن شنبوذ', 'طريق ابن شنبوذ عن قنبل عن ابن كثير', 2, ['ابن شنبوذ']),
  path('path-duri-abu-amr-abu-al-zaraa', 'narrator-al-duri-abu-amr', 'الدوري / أبو الزعراء', 'طريق أبي الزعراء عن الدوري عن أبي عمرو', 1, ['أبو الزعراء']),
  path('path-duri-abu-amr-abu-tahir', 'narrator-al-duri-abu-amr', 'الدوري / أبو طاهر', 'طريق أبي طاهر عن الدوري عن أبي عمرو', 2, ['أبو طاهر']),
  path('path-susi-abu-imran', 'narrator-al-susi', 'السوسي / أبو عمران', 'طريق أبي عمران عن السوسي عن أبي عمرو', 1, ['أبو عمران']),
  path('path-susi-abu-shuaib', 'narrator-al-susi', 'السوسي / أبو شعيب', 'طريق أبي شعيب عن السوسي عن أبي عمرو', 2, ['أبو شعيب']),
  path('path-hisham-ibn-abdan', 'narrator-hisham', 'هشام / ابن عبدان', 'طريق ابن عبدان عن هشام عن ابن عامر', 1, ['ابن عبدان']),
  path('path-hisham-al-dajwani', 'narrator-hisham', 'هشام / الداجوني', 'طريق الداجوني عن هشام عن ابن عامر', 2, ['الداجوني']),
  path('path-ibn-dhakwan-ibn-al-akhram', 'narrator-ibn-dhakwan', 'ابن ذكوان / ابن الأخرم', 'طريق ابن الأخرم عن ابن ذكوان عن ابن عامر', 1, ['ابن الأخرم']),
  path('path-ibn-dhakwan-al-suri', 'narrator-ibn-dhakwan', 'ابن ذكوان / الصوري', 'طريق الصوري عن ابن ذكوان عن ابن عامر', 2, ['الصوري']),
  path('path-hafs-ubayd', 'narrator-hafs', 'حفص / عبيد', 'طريق عبيد بن الصباح عن حفص عن عاصم', 1, ['عبيد بن الصباح']),
  path('path-hafs-amr', 'narrator-hafs', 'حفص / عمرو', 'طريق عمرو بن الصباح عن حفص عن عاصم', 2, ['عمرو بن الصباح']),
  path('path-shubah-yahya', 'narrator-shubah', 'شعبة / يحيى', 'طريق يحيى بن آدم عن شعبة عن عاصم', 1, ['يحيى بن آدم']),
  path('path-shubah-al-ulaimi', 'narrator-shubah', 'شعبة / العليمي', 'طريق العليمي عن شعبة عن عاصم', 2, ['العليمي']),
  path('path-khalaf-hamzah-ishaq', 'narrator-khalaf-hamzah', 'خلف / إسحاق', 'طريق إسحاق عن خلف عن حمزة', 1, ['إسحاق']),
  path('path-khalaf-hamzah-idris', 'narrator-khalaf-hamzah', 'خلف / إدريس', 'طريق إدريس عن خلف عن حمزة', 2, ['إدريس']),
  path('path-khallad-ibn-shanabudh', 'narrator-khallad', 'خلاد / ابن شنبوذ', 'طريق ابن شنبوذ عن خلاد عن حمزة', 1, ['ابن شنبوذ']),
  path('path-khallad-ibn-khalid', 'narrator-khallad', 'خلاد / ابن خالد', 'طريق ابن خالد عن خلاد عن حمزة', 2, ['ابن خالد']),
  path('path-layth-al-duri', 'narrator-al-layth', 'الليث / الدوري', 'طريق الدوري عن الليث عن الكسائي', 1, ['الدوري']),
  path('path-layth-abu-al-harith', 'narrator-al-layth', 'الليث / أبو الحارث', 'طريق أبي الحارث عن الليث عن الكسائي', 2, ['أبو الحارث']),
  path('path-duri-kisai-abu-al-zaraa', 'narrator-al-duri-kisai', 'الدوري / أبو الزعراء', 'طريق أبي الزعراء عن الدوري عن الكسائي', 1, ['أبو الزعراء']),
  path('path-duri-kisai-abu-tahir', 'narrator-al-duri-kisai', 'الدوري / أبو طاهر', 'طريق أبي طاهر عن الدوري عن الكسائي', 2, ['أبو طاهر']),
  path('path-ibn-wardan-ibn-hammad', 'narrator-ibn-wardan', 'ابن وردان / ابن حماد', 'طريق ابن حماد عن ابن وردان عن أبي جعفر', 1, ['ابن حماد']),
  path('path-ibn-wardan-al-fadl', 'narrator-ibn-wardan', 'ابن وردان / الفضل', 'طريق الفضل عن ابن وردان عن أبي جعفر', 2, ['الفضل']),
  path('path-ibn-jammaz-ibn-shanabudh', 'narrator-ibn-jammaz', 'ابن جماز / ابن شنبوذ', 'طريق ابن شنبوذ عن ابن جماز عن أبي جعفر', 1, ['ابن شنبوذ']),
  path('path-ibn-jammaz-al-rabi', 'narrator-ibn-jammaz', 'ابن جماز / أبو الربيع', 'طريق أبي الربيع عن ابن جماز عن أبي جعفر', 2, ['أبو الربيع']),
  path('path-ruways-ibn-shanabudh', 'narrator-ruways', 'رويس / ابن شنبوذ', 'طريق ابن شنبوذ عن رويس عن يعقوب', 1, ['ابن شنبوذ']),
  path('path-ruways-abu-al-tayyib', 'narrator-ruways', 'رويس / أبو الطيب', 'طريق أبي الطيب عن رويس عن يعقوب', 2, ['أبو الطيب']),
  path('path-rawh-ibn-wahb', 'narrator-rawh', 'روح / ابن وهب', 'طريق ابن وهب عن روح عن يعقوب', 1, ['ابن وهب']),
  path('path-rawh-al-zubayr', 'narrator-rawh', 'روح / الزبير', 'طريق الزبير عن روح عن يعقوب', 2, ['الزبير']),
  path('path-idris-al-shatti', 'narrator-idris', 'إدريس / الشطي', 'طريق الشطي عن إدريس عن خلف العاشر', 1, ['الشطي']),
  path('path-idris-al-mutawwi', 'narrator-idris', 'إدريس / المطوعي', 'طريق المطوعي عن إدريس عن خلف العاشر', 2, ['المطوعي']),
  path('path-ishaq-al-warraq', 'narrator-ishaq', 'إسحاق / الوراق', 'طريق الوراق عن إسحاق عن خلف العاشر', 1, ['الوراق']),
  path('path-ishaq-al-marwazi', 'narrator-ishaq', 'إسحاق / المروزي', 'طريق المروزي عن إسحاق عن خلف العاشر', 2, ['المروزي']),
];

function path(
  id: string,
  narratorId: string,
  shortName: string,
  fullName: string,
  order: number,
  nodeNames: string[]
): TransmissionPathSeed {
  return {
    id,
    narratorId,
    code: id.replace(/^path-/, ''),
    shortName,
    fullName,
    order,
    depth: nodeNames.length,
    isCanonical: true,
    nodeNames,
  };
}

// ==================== طبقة التوافق مع الصفحات الحالية ====================

export const QIRAAT_ORDER_TAYYIBAH: Qiraah[] = NARRATORS
  .map((narrator) => {
    const imam = READING_IMAMS.find((item) => item.id === narrator.imamId);
    return {
      id: narrator.legacyOrderInTayyibah ?? narrator.order,
      name: imam?.name ?? '',
      narrator: narrator.name,
      tier: 'RAVI' as const,
      orderInTayyibah: narrator.legacyOrderInTayyibah ?? narrator.order,
      narratorId: narrator.id,
    };
  })
  .sort((a, b) => a.orderInTayyibah - b.orderInTayyibah);

export const TURUQ_DATA: Turuq[] = TRANSMISSION_PATH_SEEDS.map((item, index) => {
  const narrator = NARRATORS.find((n) => n.id === item.narratorId);
  return {
    id: index + 1,
    qiraahId: narrator?.legacyOrderInTayyibah ?? index + 1,
    name: item.shortName,
    pathId: item.id,
    code: item.code,
    fullName: item.fullName,
  };
});

// ==================== دوال مساعدة ====================

export function getQiraatByTayyibahOrder(): Qiraah[] {
  return [...QIRAAT_ORDER_TAYYIBAH].sort((a, b) => a.orderInTayyibah - b.orderInTayyibah);
}

export function getQiraahByOrder(order: number): Qiraah | undefined {
  return QIRAAT_ORDER_TAYYIBAH.find((q) => q.orderInTayyibah === order);
}

export function getTuruqForQiraah(qiraahId: number): Turuq[] {
  return TURUQ_DATA.filter((t) => t.qiraahId === qiraahId);
}

export function getTransmissionPathsForNarrator(narratorId: string): TransmissionPathSeed[] {
  return TRANSMISSION_PATH_SEEDS.filter((path) => path.narratorId === narratorId);
}

export function getFullQiraahName(qiraah: Qiraah): string {
  return `${qiraah.narrator} عن ${qiraah.name}`;
}

export function getTenQiraat(): Qiraah[] {
  return READING_IMAMS.map((imam) => ({
    id: imam.order,
    name: imam.name,
    narrator: '',
    tier: 'QARI',
    orderInTayyibah: imam.order,
  }));
}

export function getRawisForQari(qariName: string): Qiraah[] {
  return QIRAAT_ORDER_TAYYIBAH.filter((q) => q.name === qariName);
}

export function searchTransmissions(query: string): TransmissionSearchResult {
  const normalizedQuery = normalizeSearch(query);

  const imams = READING_IMAMS.filter((imam) => normalizeSearch(imam.name).includes(normalizedQuery));
  const narrators = NARRATORS.filter((narrator) => normalizeSearch(narrator.name).includes(normalizedQuery));
  const paths = TRANSMISSION_PATH_SEEDS.filter((item) => {
    const haystack = normalizeSearch(`${item.shortName} ${item.fullName} ${item.code}`);
    return haystack.includes(normalizedQuery);
  });

  return { imams, narrators, paths };
}

function normalizeSearch(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}
