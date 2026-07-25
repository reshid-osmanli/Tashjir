// البيانات الأولية - Database Seed
// مشروع التشجير - نظام القراءات العشر

import { PrismaClient } from '@prisma/client';
import {
  NARRATORS,
  READING_IMAMS,
  TRANSMISSION_PATH_SEEDS,
} from '../src/data/qiraat-data/qiraat';

const prisma = new PrismaClient();

async function main() {
  console.log('بدء إدخال بيانات القراءات والطرق...');

  await seedReadingImams();
  await seedNarrators();
  await seedTransmissionPaths();
  await seedApplicabilityGroups();
  await seedSettings();
  await seedStatistics();

  console.log('تم إدخال البيانات الأولية بنجاح.');
}

async function seedReadingImams() {
  for (const imam of READING_IMAMS) {
    await prisma.readingImam.upsert({
      where: { slug: imam.slug },
      update: {
        name: imam.name,
        order: imam.order,
        region: imam.region,
      },
      create: {
        id: imam.id,
        name: imam.name,
        slug: imam.slug,
        order: imam.order,
        region: imam.region,
      },
    });
  }

  console.log(`تم إدخال ${READING_IMAMS.length} من القراء الأئمة.`);
}

async function seedNarrators() {
  for (const narrator of NARRATORS) {
    await prisma.narrator.upsert({
      where: {
        imamId_slug: {
          imamId: narrator.imamId,
          slug: narrator.slug,
        },
      },
      update: {
        name: narrator.name,
        order: narrator.order,
        legacyOrderInTayyibah: narrator.legacyOrderInTayyibah,
      },
      create: {
        id: narrator.id,
        imamId: narrator.imamId,
        name: narrator.name,
        slug: narrator.slug,
        order: narrator.order,
        legacyOrderInTayyibah: narrator.legacyOrderInTayyibah,
      },
    });
  }

  console.log(`تم إدخال ${NARRATORS.length} راويا.`);
}

async function seedTransmissionPaths() {
  for (const item of TRANSMISSION_PATH_SEEDS) {
    await prisma.transmissionPath.upsert({
      where: { code: item.code },
      update: {
        narratorId: item.narratorId,
        shortName: item.shortName,
        fullName: item.fullName,
        order: item.order,
        depth: item.depth,
        isCanonical: item.isCanonical,
        sourceRef: item.sourceRef,
        notes: item.notes,
      },
      create: {
        id: item.id,
        narratorId: item.narratorId,
        code: item.code,
        shortName: item.shortName,
        fullName: item.fullName,
        order: item.order,
        depth: item.depth,
        isCanonical: item.isCanonical,
        sourceRef: item.sourceRef,
        notes: item.notes,
      },
    });

    await prisma.transmissionPathNode.deleteMany({
      where: { pathId: item.id },
    });

    let parentId: string | undefined;
    for (const [index, nodeName] of item.nodeNames.entries()) {
      const nodeCode = `${item.code}-node-${index + 1}`;
      const node = await prisma.transmissionNode.upsert({
        where: { code: nodeCode },
        update: {
          parentId,
          name: nodeName,
          slug: slugify(nodeName),
          kind: index === item.nodeNames.length - 1 ? 'TARIQ' : 'SUB_TARIQ',
        },
        create: {
          code: nodeCode,
          parentId,
          name: nodeName,
          slug: slugify(nodeName),
          kind: index === item.nodeNames.length - 1 ? 'TARIQ' : 'SUB_TARIQ',
        },
      });

      await prisma.transmissionPathNode.create({
        data: {
          pathId: item.id,
          nodeId: node.id,
          depth: index + 1,
          label: nodeName,
        },
      });

      parentId = node.id;
    }
  }

  console.log(`تم إدخال ${TRANSMISSION_PATH_SEEDS.length} طريقا كبذرة أولية.`);
}

async function seedApplicabilityGroups() {
  const allGroup = await prisma.applicabilityGroup.upsert({
    where: { code: 'all-readers' },
    update: {
      name: 'كل القراء والرواة والطرق',
      scope: 'ALL',
      description: 'نطاق عام للأحكام التي تنطبق على الجميع.',
    },
    create: {
      code: 'all-readers',
      name: 'كل القراء والرواة والطرق',
      scope: 'ALL',
      description: 'نطاق عام للأحكام التي تنطبق على الجميع.',
    },
  });

  await prisma.applicabilityGroupItem.deleteMany({
    where: { groupId: allGroup.id },
  });

  for (const imam of READING_IMAMS) {
    await prisma.applicabilityGroupItem.create({
      data: {
        groupId: allGroup.id,
        imamId: imam.id,
        include: true,
      },
    });
  }

  for (const narrator of NARRATORS) {
    const group = await prisma.applicabilityGroup.upsert({
      where: { code: `narrator-${narrator.id}` },
      update: {
        name: `رواية ${narrator.name}`,
        scope: 'NARRATOR',
      },
      create: {
        code: `narrator-${narrator.id}`,
        name: `رواية ${narrator.name}`,
        scope: 'NARRATOR',
      },
    });

    await prisma.applicabilityGroupItem.deleteMany({
      where: { groupId: group.id },
    });

    await prisma.applicabilityGroupItem.create({
      data: {
        groupId: group.id,
        narratorId: narrator.id,
        include: true,
      },
    });
  }

  for (const path of TRANSMISSION_PATH_SEEDS) {
    const group = await prisma.applicabilityGroup.upsert({
      where: { code: `path-${path.id}` },
      update: {
        name: path.shortName,
        scope: 'SINGLE_PATH',
      },
      create: {
        code: `path-${path.id}`,
        name: path.shortName,
        scope: 'SINGLE_PATH',
      },
    });

    await prisma.applicabilityGroupItem.deleteMany({
      where: { groupId: group.id },
    });

    await prisma.applicabilityGroupItem.create({
      data: {
        groupId: group.id,
        pathId: path.id,
        include: true,
      },
    });
  }

  console.log('تم إنشاء مجموعات التطبيق الأساسية.');
}

async function seedSettings() {
  const settings = [
    { key: 'app_name', value: 'مشروع التشجير', description: 'اسم التطبيق' },
    { key: 'app_version', value: '0.1.0', description: 'إصدار التطبيق' },
    { key: 'default_font_size', value: '24', description: 'حجم الخط الافتراضي' },
    { key: 'default_zoom', value: '1', description: 'التكبير الافتراضي' },
    { key: 'auto_save', value: 'true', description: 'الحفظ التلقائي' },
    { key: 'auto_save_interval', value: '30000', description: 'فترة الحفظ التلقائي بالمللي ثانية' },
    { key: 'transmission_model_version', value: '1', description: 'إصدار نموذج الطرق والرواة' },
  ];

  for (const setting of settings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }

  console.log('تم إدخال الإعدادات.');
}

async function seedStatistics() {
  await prisma.statistics.upsert({
    where: { id: 1 },
    update: {
      totalPaths: TRANSMISSION_PATH_SEEDS.length,
    },
    create: {
      id: 1,
      totalAyahs: 0,
      totalWords: 0,
      totalTashjeer: 0,
      totalReviews: 0,
      totalPaths: TRANSMISSION_PATH_SEEDS.length,
    },
  });

  console.log('تم إدخال الإحصائيات الأولية.');
}

function slugify(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

main()
  .catch((error) => {
    console.error('خطأ في إدخال البيانات الأولية:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
