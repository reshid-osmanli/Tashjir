// أنواع البيانات الأساسية - TypeScript Types
// مشروع التشجير - نظام القراءات العشر

// ==================== أنواع عامة ====================

export type EntityId = string | number;

// ==================== المصحف ====================

export interface Surah {
  id: number;
  name: string;
  nameArabic: string;
  ayahsCount: number;
  revelationType: 'MECCAN' | 'MEDINAN';
  pageStart: number;
  pageEnd: number;
}

export interface Ayah {
  id: number;
  surahId: number;
  number: number;
  page: number;
  juz: number;
  hizb: number;
  rub: number;
  text: string;
  plainText: string;
  wordsCount: number;
  words: Word[];
  variantRules?: VariantRule[];
  tashjeerLines?: TashjeerLine[];
}

export interface Word {
  id: number;
  ayahId: number;
  position: number;
  text: string;
  plainText: string;
  unicode: string;
  pageX?: number;
  pageY?: number;
  width?: number;
  height?: number;
  variantRules?: VariantRule[];
  variantReadings?: VariantReading[];
  tashjeerNodes?: TashjeerNode[];
}

// ==================== القراءات والطرق ====================

export type TransmissionNodeKind = 'IMAM' | 'NARRATOR' | 'TARIQ' | 'SUB_TARIQ' | 'WAJH' | 'BOOK';
export type ApplicabilityScope = 'ALL' | 'IMAM' | 'NARRATOR' | 'PATH_GROUP' | 'SINGLE_PATH' | 'CUSTOM';
export type VariantCategory = 'USUL' | 'FARSH' | 'MADUD' | 'HAMZ' | 'WAQF' | 'TAJWEED';
export type RuleStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED';

export interface ReadingImam {
  id: string;
  name: string;
  slug: string;
  order: number;
  region?: string;
  narrators?: Narrator[];
}

export interface Narrator {
  id: string;
  imamId: string;
  name: string;
  slug: string;
  order: number;
  legacyOrderInTayyibah?: number;
  imam?: ReadingImam;
  paths?: TransmissionPath[];
}

export interface TransmissionNode {
  id: string;
  code: string;
  parentId?: string;
  name: string;
  slug: string;
  kind: TransmissionNodeKind;
  sourceRef?: string;
  notes?: string;
  children?: TransmissionNode[];
}

export interface TransmissionPath {
  id: string;
  narratorId: string;
  code: string;
  shortName: string;
  fullName: string;
  order: number;
  depth: number;
  isCanonical: boolean;
  sourceRef?: string;
  notes?: string;
  narrator?: Narrator;
  nodes?: TransmissionPathNode[];
}

export interface TransmissionPathNode {
  pathId: string;
  nodeId: string;
  depth: number;
  label?: string;
  node?: TransmissionNode;
}

export interface ApplicabilityGroup {
  id: string;
  code: string;
  name: string;
  scope: ApplicabilityScope;
  description?: string;
  items?: ApplicabilityGroupItem[];
}

export interface ApplicabilityGroupItem {
  id: string;
  groupId: string;
  pathId?: string;
  narratorId?: string;
  imamId?: string;
  include: boolean;
  notes?: string;
}

// واجهات توافق مؤقتة مع صفحات المشروع الأولى.
export type Tier = 'QARI' | 'RAVI' | 'TARIQ';
export type Category = VariantCategory;

export interface Qiraah {
  id: number;
  name: string;
  narrator: string;
  tier: Tier;
  orderInTayyibah: number;
  parentId?: number;
  narratorId?: string;
  children?: Qiraah[];
  turuq?: Turuq[];
}

export interface Turuq {
  id: number;
  qiraahId: number;
  name: string;
  parentTuruqId?: number;
  pathId?: string;
  code?: string;
  fullName?: string;
  children?: Turuq[];
}

// ==================== الأحكام والاختلافات ====================

export interface VariantRule {
  id: string;
  ayahId?: number;
  wordId?: number;
  groupId: string;
  category: VariantCategory;
  title: string;
  description?: string;
  isGlobal: boolean;
  startWordId?: number;
  endWordId?: number;
  sortOrder: number;
  status: RuleStatus;
  group?: ApplicabilityGroup;
  readings?: VariantReading[];
  evidences?: Evidence[];
}

export interface VariantReading {
  id: string;
  ruleId: string;
  wordId?: number;
  fromWordId?: number;
  toWordId?: number;
  text: string;
  normalized: string;
  notes?: string;
  word?: Word;
  evidences?: Evidence[];
}

// ==================== التشجير ====================

export type LineType = 'USUL' | 'FARSH' | 'MADUD' | 'HAMZ' | 'WAQF' | 'TAJWEED';
export type NodePosition = 'TOP' | 'MIDDLE' | 'BOTTOM';

export interface TashjeerLine {
  id: EntityId;
  ayahId: number;
  ruleId?: string;
  type: LineType;
  color?: string;
  strokeWidth?: number;
  dashStyle?: string;
  yPosition: number;
  style?: LineStyle | Record<string, unknown>;
  isActive: boolean;
  createdBy?: EntityId;
  verifiedBy?: EntityId;
  nodes: TashjeerNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TashjeerNode {
  id: EntityId;
  lineId?: EntityId;
  tashjeerLineId?: EntityId;
  wordId: number;
  pathId?: string;
  groupId?: string;
  qiraahId?: number;
  narratorId?: string;
  position: NodePosition;
  x: number;
  y: number;
  label?: string;
  word?: Word;
  path?: TransmissionPath;
}

// ==================== الأدلة ====================

export type SourceType = 'NASHR' | 'TAYYIBAH' | 'JANNAH' | 'OTHER';
export type LinkType = 'MANZUMA' | 'KITAB' | 'KHARIJI';

export interface Evidence {
  id: EntityId;
  ruleId?: string;
  variantReadingId?: string;
  wordReadingId?: EntityId;
  source: SourceType;
  text: string;
  reference?: string;
  manzumaLine?: string;
  manzumaRef?: string;
  kitabPage?: string;
  kitabRef?: string;
  linkType: LinkType;
  linkUrl?: string;
}

// ==================== المراجعة ====================

export type ScholarRole = 'REVIEWER' | 'VERIFIER' | 'SUPERVISOR';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Scholar {
  id: EntityId;
  name: string;
  email: string;
  role: ScholarRole;
  specializations: string[];
  isActive: boolean;
}

export interface Review {
  id: EntityId;
  scholarId: EntityId;
  lineId?: EntityId;
  tashjeerLineId?: EntityId;
  status: ReviewStatus;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  scholar?: Scholar;
}

// ==================== القراء والإجازات ====================

export interface Reader {
  id: EntityId;
  name: string;
  email: string;
  isActive: boolean;
  ijazat: Ijazah[];
}

export interface Ijazah {
  id: EntityId;
  readerId: EntityId;
  narratorId?: string;
  qiraahName: string;
  narratorName: string;
  qiraah?: string;
  narrator?: string;
  turuq?: string[];
  granter: string;
  grantedAt?: Date;
  date?: Date;
  certificateUrl?: string;
  paths?: IjazahPath[];
}

export interface IjazahPath {
  id: string;
  ijazahId: string;
  pathId: string;
  path?: TransmissionPath;
}

// ==================== المحرر ====================

export interface WordPosition {
  wordId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  baselineY: number;
}

export interface LayoutContext {
  currentX: number;
  currentY: number;
  fontSize: number;
  wordSpacing: number;
  lineHeight: number;
  pageWidth: number;
  pageHeight: number;
  MARGIN_TOP?: number;
  MARGIN_BOTTOM?: number;
  MARGIN_RIGHT?: number;
  MARGIN_LEFT?: number;
  FONT_SIZE?: number;
  WORD_SPACING?: number;
  LINE_HEIGHT?: number;
  USUL_AREA_HEIGHT?: number;
  FARSH_AREA_TOP?: number;
  TASHJEER_LINE_HEIGHT?: number;
  TASHJEER_LINE_GAP?: number;
}

export interface TashjeerSaveData {
  version: string;
  ayahId: number;
  lines: TashjeerLineData[];
  metadata: TashjeerMetadata;
}

export interface TashjeerLineData {
  id: string;
  type: LineType;
  qiraahOrder?: number;
  groupId?: string;
  pathId?: string;
  ruleId?: string;
  nodes: TashjeerNodeData[];
  style: LineStyle;
}

export interface TashjeerNodeData {
  wordId: number;
  position: NodePosition;
  x: number;
  y: number;
  pathId?: string;
  groupId?: string;
}

export interface LineStyle {
  color: string;
  strokeWidth: number;
  dashArray?: string;
}

export interface TashjeerMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  verifiedBy?: string;
  status: 'draft' | 'review' | 'approved';
}

// ==================== التجويد ====================

export type HarakaType =
  | 'fatha'
  | 'damma'
  | 'kasra'
  | 'shadda'
  | 'sukun'
  | 'madd'
  | 'tanween'
  | 'hamza_above'
  | 'hamza_below';

export type TajweedRule = 'IDGHAM' | 'IKHFAA' | 'IQLAB' | 'IZHAR';

export interface Haraka {
  type: HarakaType;
  position: 'above' | 'below' | 'on';
  character: string;
  width: number;
  height: number;
}

export interface HarakaAnalysis {
  harakat: Haraka[];
  baseLetters: string[];
  totalWidth: number;
  maxHeight: number;
}

// ==================== API ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface TransmissionSearchResult {
  imams: ReadingImam[];
  narrators: Narrator[];
  paths: TransmissionPath[];
}

// ==================== الفلاتر ====================

export interface TashjeerFilter {
  surahId?: number;
  ayahId?: number;
  pathId?: string;
  groupId?: string;
  qiraahId?: number;
  type?: LineType;
  status?: ReviewStatus;
  createdBy?: EntityId;
}

export interface MushafViewOptions {
  page: number;
  surahId?: number;
  ayahId?: number;
  showTashjeer: boolean;
  qiraahFilter: number[];
  pathFilter?: string[];
  zoom: number;
  panX: number;
  panY: number;
}
