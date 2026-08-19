// قياس النص الحقيقي في المتصفح - Canvas Text Metrics
//
// لماذا هذا الملف؟
//
//   محرك التخطيط يقيس الكلمات بنموذج رياضي حتمي (نسب حروف خط أميري)، وهذا
//   ضروري ليعطي الخادم والاختبارات الناتج نفسه. لكنه تقريب: الشاشة ترسم
//   بالخط الحقيقي، فيقع تفاوت صغير بين الموضع المحسوب والموضع المرسوم.
//   ذلك التفاوت هو سبب شكوى «الخطوط المنقّطة في غير مكانها الدقيق»: تُحسب
//   الوصلة على حرف وتُرسم بجواره.
//
//   هنا نقيس بالخط نفسه الذي يُرسم به النص (Canvas measureText)، فيصير
//   موضع كل حرف مطابقا لما تراه العين.
//
// مسألة الوصل العربي:
//
//   قياس «الرَّح» وحدها يعطي الحاء بصورتها **النهائية** وهي أعرض من صورتها
//   المتوسطة داخل «الرَّحِيمُ». فنقيس كل بادئة موصولةً بحرف الوصل الصفري
//   (ZWJ U+200D)، فيبقى الحرف على صورته المتوسطة، ثم نُسوّي المجموع على
//   عرض الكلمة الحقيقي حتى لا يتراكم الخطأ في آخر الكلمة.

import { splitQuranCharacters } from '@/lib/quran-logic/characters';
import type { TextMetricsProvider } from './layout-engine';

/** حرف الوصل الصفري: يُبقي الحرف الأخير في البادئة على صورته المتصلة. */
const ZWJ = '\u200D';

const DEFAULT_FONT_FAMILY = "'Amiri Quran', 'Amiri', serif";

/**
 * يبني مقياسا حقيقيا للنص، أو null خارج المتصفح (خادم/اختبارات) فيبقى
 * القياس النموذجي هو المعتمد.
 */
export function createCanvasTextMetrics(
  fontFamily: string = DEFAULT_FONT_FAMILY
): TextMetricsProvider | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const cache = new Map<string, number>();

  const width = (text: string, fontSize: number): number => {
    const key = `${fontSize}|${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    context.font = `${fontSize}px ${fontFamily}`;
    const measured = context.measureText(text).width;
    cache.set(key, measured);
    return measured;
  };

  return {
    measureWord(text, fontSize) {
      return Math.max(width(text, fontSize), fontSize * 0.4);
    },

    measureCharacterOffsets(text, fontSize) {
      const characters = splitQuranCharacters(text);
      if (characters.length === 0) return [0];

      const total = Math.max(width(text, fontSize), 0.0001);
      const raw: number[] = [0];
      let prefix = '';

      for (let index = 0; index < characters.length; index++) {
        prefix += characters[index].text;
        const isLast = index === characters.length - 1;
        const measured = isLast ? total : width(prefix + ZWJ, fontSize);
        // القياس يجب أن يبقى متزايدا؛ الحركة وحدها لا تزيد عرضا.
        raw.push(Math.max(measured, raw[raw.length - 1]));
      }

      // تسوية على العرض الحقيقي، فلا يزيح خطأ التقدير آخر حرف في الكلمة.
      const measuredTotal = raw[raw.length - 1] || total;
      const scale = measuredTotal > 0 ? total / measuredTotal : 1;
      return raw.map((offset) => offset * scale);
    },
  };
}
