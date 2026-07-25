// واجهة طريق واحد - Single Transmission Path API
// مشروع التشجير - نظام القراءات العشر
//
// GET /api/transmissions/:pathId
// يقبل معرّف الطريق أو كوده.
//
// المصدر بيانات ثابتة في هذه المرحلة، انظر التعليق في route.ts المجاور.

import { NextResponse } from 'next/server';
import {
  NARRATORS,
  READING_IMAMS,
  TRANSMISSION_PATH_SEEDS,
} from '@/data/qiraat-data/qiraat';

export async function GET(
  _request: Request,
  context: { params: Promise<{ pathId: string }> }
) {
  const { pathId } = await context.params;

  const path = TRANSMISSION_PATH_SEEDS.find(
    (item) => item.id === pathId || item.code === pathId
  );

  if (!path) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TRANSMISSION_PATH_NOT_FOUND',
          message: 'لم يتم العثور على الطريق المطلوب.',
        },
      },
      { status: 404 }
    );
  }

  const narrator = NARRATORS.find((item) => item.id === path.narratorId);
  const imam = narrator
    ? READING_IMAMS.find((item) => item.id === narrator.imamId)
    : undefined;

  return NextResponse.json({
    success: true,
    data: {
      ...path,
      narrator: narrator ? { ...narrator, imam } : undefined,
      // عقد الطريق مرتبة من الأعلى إلى الأدنى في سلسلة النقل.
      nodes: path.nodeNames.map((name, index) => ({
        depth: index + 1,
        label: name,
        node: { name, kind: index === path.nodeNames.length - 1 ? 'TARIQ' : 'SUB_TARIQ' },
      })),
    },
  });
}
