import { NextResponse } from 'next/server';
import prisma from '@/lib/db/client';

export async function GET(
  _request: Request,
  context: { params: Promise<{ pathId: string }> }
) {
  const { pathId } = await context.params;

  const path =
    (await prisma.transmissionPath.findUnique({
      where: { id: pathId },
      include: pathInclude,
    })) ??
    (await prisma.transmissionPath.findUnique({
      where: { code: pathId },
      include: pathInclude,
    }));

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

  return NextResponse.json({
    success: true,
    data: path,
  });
}

const pathInclude = {
  narrator: {
    include: { imam: true },
  },
  nodes: {
    orderBy: { depth: 'asc' as const },
    include: { node: true },
  },
  groupItems: {
    include: { group: true },
  },
};
