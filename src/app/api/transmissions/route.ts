// واجهة الطرق والرواة - Transmissions API
// مشروع التشجير - نظام القراءات العشر
//
// GET /api/transmissions
//
// المصدر في هذه المرحلة هو بيانات المشروع الثابتة (src/data/qiraat-data)،
// لا قاعدة البيانات، لأن التخزين كله محلي حتى يستقر أساس المحرر.
// مخطط Prisma وملف البذور موجودان وجاهزان، وعند تفعيل قاعدة البيانات
// يُستبدل جسم هذه الدالة بالاستعلام دون تغيير عقد الواجهة (شكل الرد).
//
// المعاملات:
//   q          بحث نصي في الأئمة والرواة والطرق (يتجاهل التشكيل)
//   imamId     تصفية بإمام
//   narratorId تصفية براو
//   limit      حد النتائج (1..200، الافتراضي 50)

import { NextResponse, type NextRequest } from 'next/server';
import {
  NARRATORS,
  READING_IMAMS,
  TRANSMISSION_PATH_SEEDS,
} from '@/data/qiraat-data/qiraat';
import { normalizeForSearch } from '@/data/quran';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = normalizeForSearch(searchParams.get('q') ?? '');
  const imamId = searchParams.get('imamId')?.trim();
  const narratorId = searchParams.get('narratorId')?.trim();
  const limit = clampLimit(Number(searchParams.get('limit') ?? 50));

  const imams = READING_IMAMS.filter(
    (imam) => !query || normalizeForSearch(imam.name).includes(query)
  ).map((imam) => ({
    ...imam,
    narrators: NARRATORS.filter((narrator) => narrator.imamId === imam.id),
  }));

  const narrators = NARRATORS.filter((narrator) => {
    if (imamId && narrator.imamId !== imamId) return false;
    if (!query) return true;

    const imam = READING_IMAMS.find((item) => item.id === narrator.imamId);
    return normalizeForSearch(`${narrator.name} ${imam?.name ?? ''}`).includes(query);
  }).map((narrator) => ({
    ...narrator,
    imam: READING_IMAMS.find((item) => item.id === narrator.imamId),
  }));

  const paths = TRANSMISSION_PATH_SEEDS.filter((path) => {
    if (narratorId && path.narratorId !== narratorId) return false;

    if (imamId) {
      const narrator = NARRATORS.find((item) => item.id === path.narratorId);
      if (narrator?.imamId !== imamId) return false;
    }

    if (!query) return true;
    return normalizeForSearch(`${path.shortName} ${path.fullName} ${path.code}`).includes(query);
  })
    .slice(0, limit)
    .map((path) => {
      const narrator = NARRATORS.find((item) => item.id === path.narratorId);
      return {
        ...path,
        narrator: narrator
          ? { ...narrator, imam: READING_IMAMS.find((item) => item.id === narrator.imamId) }
          : undefined,
      };
    });

  return NextResponse.json({
    success: true,
    data: { imams, narrators, paths },
    meta: {
      source: 'static',
      totalPaths: TRANSMISSION_PATH_SEEDS.length,
      note: 'المصدر بيانات ثابتة في هذه المرحلة. قاعدة البيانات تُفعَّل لاحقا بلا تغيير في شكل الرد.',
    },
  });
}

function clampLimit(value: number): number {
  if (Number.isNaN(value)) return 50;
  return Math.min(Math.max(Math.trunc(value), 1), 200);
}
