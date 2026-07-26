-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RevelationType" AS ENUM ('MECCAN', 'MEDINAN');

-- CreateEnum
CREATE TYPE "TransmissionNodeKind" AS ENUM ('IMAM', 'NARRATOR', 'TARIQ', 'SUB_TARIQ', 'WAJH', 'BOOK');

-- CreateEnum
CREATE TYPE "ApplicabilityScope" AS ENUM ('ALL', 'IMAM', 'NARRATOR', 'PATH_GROUP', 'SINGLE_PATH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VariantCategory" AS ENUM ('USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED');

-- CreateEnum
CREATE TYPE "NodePosition" AS ENUM ('TOP', 'MIDDLE', 'BOTTOM');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NASHR', 'TAYYIBAH', 'JANNAH', 'OTHER');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('MANZUMA', 'KITAB', 'KHARIJI');

-- CreateEnum
CREATE TYPE "ScholarRole" AS ENUM ('REVIEWER', 'VERIFIER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "surahs" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameArabic" TEXT NOT NULL,
    "ayahsCount" INTEGER NOT NULL,
    "revelationType" "RevelationType" NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,

    CONSTRAINT "surahs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ayahs" (
    "id" INTEGER NOT NULL,
    "surahId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "hizb" INTEGER NOT NULL,
    "rub" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "wordsCount" INTEGER NOT NULL,

    CONSTRAINT "ayahs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" INTEGER NOT NULL,
    "ayahId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "unicode" TEXT NOT NULL,
    "pageX" DOUBLE PRECISION,
    "pageY" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_imams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_imams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrators" (
    "id" TEXT NOT NULL,
    "imamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "legacyOrderInTayyibah" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmission_nodes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "TransmissionNodeKind" NOT NULL,
    "sourceRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transmission_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmission_paths" (
    "id" TEXT NOT NULL,
    "narratorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isCanonical" BOOLEAN NOT NULL DEFAULT true,
    "sourceRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transmission_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmission_path_nodes" (
    "pathId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "transmission_path_nodes_pkey" PRIMARY KEY ("pathId","nodeId")
);

-- CreateTable
CREATE TABLE "applicability_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "ApplicabilityScope" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicability_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicability_group_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "pathId" TEXT,
    "narratorId" TEXT,
    "imamId" TEXT,
    "include" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "applicability_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_rules" (
    "id" TEXT NOT NULL,
    "ayahId" INTEGER,
    "wordId" INTEGER,
    "groupId" TEXT NOT NULL,
    "category" "VariantCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "startWordId" INTEGER,
    "endWordId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_readings" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "wordId" INTEGER,
    "fromWordId" INTEGER,
    "toWordId" INTEGER,
    "text" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "variant_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tashjeer_lines" (
    "id" TEXT NOT NULL,
    "ayahId" INTEGER NOT NULL,
    "ruleId" TEXT,
    "type" "LineType" NOT NULL,
    "yPosition" DOUBLE PRECISION NOT NULL,
    "style" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tashjeer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tashjeer_nodes" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "wordId" INTEGER NOT NULL,
    "pathId" TEXT,
    "groupId" TEXT,
    "position" "NodePosition" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "label" TEXT,

    CONSTRAINT "tashjeer_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "variantReadingId" TEXT,
    "source" "SourceType" NOT NULL,
    "text" TEXT NOT NULL,
    "reference" TEXT,
    "manzumaLine" TEXT,
    "manzumaRef" TEXT,
    "kitabPage" TEXT,
    "kitabRef" TEXT,
    "linkType" "LinkType" NOT NULL,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholars" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "ScholarRole" NOT NULL,
    "specializations" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "readers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ijazat" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "narratorId" TEXT,
    "qiraahName" TEXT NOT NULL,
    "narratorName" TEXT NOT NULL,
    "granter" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ijazat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ijazah_paths" (
    "id" TEXT NOT NULL,
    "ijazahId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,

    CONSTRAINT "ijazah_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" INTEGER NOT NULL,
    "totalAyahs" INTEGER NOT NULL DEFAULT 0,
    "totalWords" INTEGER NOT NULL DEFAULT 0,
    "totalTashjeer" INTEGER NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalPaths" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ayahs_page_idx" ON "ayahs"("page");

-- CreateIndex
CREATE INDEX "ayahs_juz_idx" ON "ayahs"("juz");

-- CreateIndex
CREATE UNIQUE INDEX "ayahs_surahId_number_key" ON "ayahs"("surahId", "number");

-- CreateIndex
CREATE INDEX "words_plainText_idx" ON "words"("plainText");

-- CreateIndex
CREATE UNIQUE INDEX "words_ayahId_position_key" ON "words"("ayahId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "reading_imams_slug_key" ON "reading_imams"("slug");

-- CreateIndex
CREATE INDEX "reading_imams_order_idx" ON "reading_imams"("order");

-- CreateIndex
CREATE INDEX "narrators_imamId_order_idx" ON "narrators"("imamId", "order");

-- CreateIndex
CREATE INDEX "narrators_legacyOrderInTayyibah_idx" ON "narrators"("legacyOrderInTayyibah");

-- CreateIndex
CREATE UNIQUE INDEX "narrators_imamId_slug_key" ON "narrators"("imamId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "transmission_nodes_code_key" ON "transmission_nodes"("code");

-- CreateIndex
CREATE INDEX "transmission_nodes_parentId_idx" ON "transmission_nodes"("parentId");

-- CreateIndex
CREATE INDEX "transmission_nodes_kind_idx" ON "transmission_nodes"("kind");

-- CreateIndex
CREATE INDEX "transmission_nodes_name_idx" ON "transmission_nodes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transmission_nodes_parentId_slug_key" ON "transmission_nodes"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "transmission_paths_code_key" ON "transmission_paths"("code");

-- CreateIndex
CREATE INDEX "transmission_paths_narratorId_order_idx" ON "transmission_paths"("narratorId", "order");

-- CreateIndex
CREATE INDEX "transmission_paths_shortName_idx" ON "transmission_paths"("shortName");

-- CreateIndex
CREATE INDEX "transmission_path_nodes_nodeId_idx" ON "transmission_path_nodes"("nodeId");

-- CreateIndex
CREATE INDEX "transmission_path_nodes_pathId_depth_idx" ON "transmission_path_nodes"("pathId", "depth");

-- CreateIndex
CREATE UNIQUE INDEX "transmission_path_nodes_pathId_depth_key" ON "transmission_path_nodes"("pathId", "depth");

-- CreateIndex
CREATE UNIQUE INDEX "applicability_groups_code_key" ON "applicability_groups"("code");

-- CreateIndex
CREATE INDEX "applicability_groups_scope_idx" ON "applicability_groups"("scope");

-- CreateIndex
CREATE INDEX "applicability_group_items_groupId_idx" ON "applicability_group_items"("groupId");

-- CreateIndex
CREATE INDEX "applicability_group_items_pathId_idx" ON "applicability_group_items"("pathId");

-- CreateIndex
CREATE INDEX "applicability_group_items_narratorId_idx" ON "applicability_group_items"("narratorId");

-- CreateIndex
CREATE INDEX "applicability_group_items_imamId_idx" ON "applicability_group_items"("imamId");

-- CreateIndex
CREATE INDEX "variant_rules_ayahId_idx" ON "variant_rules"("ayahId");

-- CreateIndex
CREATE INDEX "variant_rules_wordId_idx" ON "variant_rules"("wordId");

-- CreateIndex
CREATE INDEX "variant_rules_groupId_idx" ON "variant_rules"("groupId");

-- CreateIndex
CREATE INDEX "variant_rules_category_idx" ON "variant_rules"("category");

-- CreateIndex
CREATE INDEX "variant_rules_status_idx" ON "variant_rules"("status");

-- CreateIndex
CREATE INDEX "variant_readings_ruleId_idx" ON "variant_readings"("ruleId");

-- CreateIndex
CREATE INDEX "variant_readings_wordId_idx" ON "variant_readings"("wordId");

-- CreateIndex
CREATE INDEX "variant_readings_normalized_idx" ON "variant_readings"("normalized");

-- CreateIndex
CREATE INDEX "tashjeer_lines_ayahId_idx" ON "tashjeer_lines"("ayahId");

-- CreateIndex
CREATE INDEX "tashjeer_lines_ruleId_idx" ON "tashjeer_lines"("ruleId");

-- CreateIndex
CREATE INDEX "tashjeer_lines_type_idx" ON "tashjeer_lines"("type");

-- CreateIndex
CREATE INDEX "tashjeer_nodes_lineId_idx" ON "tashjeer_nodes"("lineId");

-- CreateIndex
CREATE INDEX "tashjeer_nodes_wordId_idx" ON "tashjeer_nodes"("wordId");

-- CreateIndex
CREATE INDEX "tashjeer_nodes_pathId_idx" ON "tashjeer_nodes"("pathId");

-- CreateIndex
CREATE INDEX "tashjeer_nodes_groupId_idx" ON "tashjeer_nodes"("groupId");

-- CreateIndex
CREATE INDEX "evidence_ruleId_idx" ON "evidence"("ruleId");

-- CreateIndex
CREATE INDEX "evidence_variantReadingId_idx" ON "evidence"("variantReadingId");

-- CreateIndex
CREATE INDEX "evidence_source_idx" ON "evidence"("source");

-- CreateIndex
CREATE UNIQUE INDEX "scholars_email_key" ON "scholars"("email");

-- CreateIndex
CREATE INDEX "reviews_scholarId_idx" ON "reviews"("scholarId");

-- CreateIndex
CREATE INDEX "reviews_lineId_idx" ON "reviews"("lineId");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "readers_email_key" ON "readers"("email");

-- CreateIndex
CREATE INDEX "ijazat_readerId_idx" ON "ijazat"("readerId");

-- CreateIndex
CREATE INDEX "ijazat_narratorId_idx" ON "ijazat"("narratorId");

-- CreateIndex
CREATE INDEX "ijazah_paths_pathId_idx" ON "ijazah_paths"("pathId");

-- CreateIndex
CREATE UNIQUE INDEX "ijazah_paths_ijazahId_pathId_key" ON "ijazah_paths"("ijazahId", "pathId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "ayahs" ADD CONSTRAINT "ayahs_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_ayahId_fkey" FOREIGN KEY ("ayahId") REFERENCES "ayahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrators" ADD CONSTRAINT "narrators_imamId_fkey" FOREIGN KEY ("imamId") REFERENCES "reading_imams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmission_nodes" ADD CONSTRAINT "transmission_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "transmission_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmission_paths" ADD CONSTRAINT "transmission_paths_narratorId_fkey" FOREIGN KEY ("narratorId") REFERENCES "narrators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmission_path_nodes" ADD CONSTRAINT "transmission_path_nodes_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "transmission_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmission_path_nodes" ADD CONSTRAINT "transmission_path_nodes_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "transmission_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicability_group_items" ADD CONSTRAINT "applicability_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "applicability_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicability_group_items" ADD CONSTRAINT "applicability_group_items_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "transmission_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicability_group_items" ADD CONSTRAINT "applicability_group_items_narratorId_fkey" FOREIGN KEY ("narratorId") REFERENCES "narrators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicability_group_items" ADD CONSTRAINT "applicability_group_items_imamId_fkey" FOREIGN KEY ("imamId") REFERENCES "reading_imams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_rules" ADD CONSTRAINT "variant_rules_ayahId_fkey" FOREIGN KEY ("ayahId") REFERENCES "ayahs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_rules" ADD CONSTRAINT "variant_rules_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_rules" ADD CONSTRAINT "variant_rules_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "applicability_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_readings" ADD CONSTRAINT "variant_readings_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "variant_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_readings" ADD CONSTRAINT "variant_readings_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_lines" ADD CONSTRAINT "tashjeer_lines_ayahId_fkey" FOREIGN KEY ("ayahId") REFERENCES "ayahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_lines" ADD CONSTRAINT "tashjeer_lines_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "variant_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_nodes" ADD CONSTRAINT "tashjeer_nodes_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "tashjeer_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_nodes" ADD CONSTRAINT "tashjeer_nodes_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_nodes" ADD CONSTRAINT "tashjeer_nodes_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "transmission_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tashjeer_nodes" ADD CONSTRAINT "tashjeer_nodes_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "applicability_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "variant_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_variantReadingId_fkey" FOREIGN KEY ("variantReadingId") REFERENCES "variant_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "scholars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "tashjeer_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ijazat" ADD CONSTRAINT "ijazat_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "readers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ijazat" ADD CONSTRAINT "ijazat_narratorId_fkey" FOREIGN KEY ("narratorId") REFERENCES "narrators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ijazah_paths" ADD CONSTRAINT "ijazah_paths_ijazahId_fkey" FOREIGN KEY ("ijazahId") REFERENCES "ijazat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ijazah_paths" ADD CONSTRAINT "ijazah_paths_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "transmission_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

