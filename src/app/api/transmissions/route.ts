import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const imamId = searchParams.get('imamId')?.trim();
  const narratorId = searchParams.get('narratorId')?.trim();
  const limit = clampLimit(Number(searchParams.get('limit') ?? 50));

  const pathWhere: Prisma.TransmissionPathWhereInput = {};

  if (narratorId) {
    pathWhere.narratorId = narratorId;
  }

  if (imamId) {
    pathWhere.narrator = { imamId };
  }

  if (query) {
    pathWhere.OR = [
      { code: { contains: query, mode: 'insensitive' } },
      { shortName: { contains: query, mode: 'insensitive' } },
      { fullName: { contains: query, mode: 'insensitive' } },
      { narrator: { name: { contains: query, mode: 'insensitive' } } },
      { narrator: { imam: { name: { contains: query, mode: 'insensitive' } } } },
    ];
  }

  const [imams, narrators, paths] = await Promise.all([
    prisma.readingImam.findMany({
      orderBy: { order: 'asc' },
      include: {
        narrators: {
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.narrator.findMany({
      where: {
        ...(imamId ? { imamId } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { imam: { name: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ imamId: 'asc' }, { order: 'asc' }],
      include: { imam: true },
    }),
    prisma.transmissionPath.findMany({
      where: pathWhere,
      take: limit,
      orderBy: [{ narratorId: 'asc' }, { order: 'asc' }],
      include: {
        narrator: {
          include: { imam: true },
        },
        nodes: {
          orderBy: { depth: 'asc' },
          include: { node: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      imams,
      narrators,
      paths,
    },
  });
}

function clampLimit(value: number): number {
  if (Number.isNaN(value)) return 50;
  return Math.min(Math.max(value, 1), 200);
}
