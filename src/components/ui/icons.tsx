// مجموعة الأيقونات — Tashjir Icon Set
//
// مشروع التشجير - نظام القراءات العشر
//
// لماذا ملف واحد: هوية أيقونية واحدة. كل الأيقونات بخط واحد (1.5) وأطراف
// مستديرة ومساحة اسم واحدة (24x24)، فلا تتفاوت الأوزان بين شاشة وأخرى، ولا
// تُستعمل الإيموجي أو المحارف النصية كأيقونات (SPEC §191-194).
//
// القاعدة:
//   - الأيقونة الزخرفية: aria-hidden، لا تصل إلى قارئ الشاشة.
//   - الأيقونة الحاملة معنى بلا نص مصاحب: title إلزامي (يصبح role="img").

import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** مقاس الأيقونة بالبكسل. المجموعة المعتمدة: 16 · 18 · 20 · 24 */
  size?: number;
  /** نص بديل. إن غاب فالأيقونة زخرفية. */
  title?: string;
  strokeWidth?: number;
}

function Icon({ size = 18, title, strokeWidth = 1.5, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ------------------------------- الهوية والمحتوى ------------------------------ */

/** التشجير: عقدة أصل تتفرّع إلى ثلاثة مسارات. */
export function IconBranch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 6.5v5" />
      <path d="M12 11.5c0 3-4.5 3.4-4.5 6.5" />
      <path d="M12 11.5c0 3 4.5 3.4 4.5 6.5" />
      <path d="M12 11.5v6.5" />
      <circle cx="7.5" cy="20" r="1.5" />
      <circle cx="16.5" cy="20" r="1.5" />
      <circle cx="12" cy="19.5" r="1.5" />
    </Icon>
  );
}

/** المصحف: صفحة مفتوحة بخط قاعدة. */
export function IconMushaf(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10.4 5.3 8.4 4.7 6 4.7H4v13.6h2c2.4 0 4.4.6 6 1.8 1.6-1.2 3.6-1.8 6-1.8h2V4.7h-2c-2.4 0-4.4.6-6 1.8Z" />
      <path d="M12 6.5v13.6" />
    </Icon>
  );
}

/** المحرر: قلم على مسطرة. */
export function IconEditor(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M4 15.5h6" />
      <path d="m13.5 15.5 6.2-6.2a1.9 1.9 0 0 0-2.7-2.7L10.8 12.8v2.7Z" />
    </Icon>
  );
}

/** التتبع: خط زمني بنقاط تدقيق. */
export function IconAudit(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h11" />
      <path d="M4 12h16" />
      <path d="M4 17.5h8" />
      <circle cx="18" cy="6.5" r="1.7" />
      <circle cx="14.5" cy="17.5" r="1.7" />
    </Icon>
  );
}

/** الوثائق: صحيفة ببيانات وصفية. */
export function IconDocs(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h7.5L19 9v11.5H6Z" />
      <path d="M13 3.5V9h6" />
      <path d="M9 13h6" />
      <path d="M9 16.5h4" />
    </Icon>
  );
}

/** طبقة/وجه مستقل. */
export function IconLayers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.5 8 4.2-8 4.2-8-4.2Z" />
      <path d="m4 13 8 4.2 8-4.2" />
    </Icon>
  );
}

/** قاعدة مطّردة: قوسان متماثلان. */
export function IconRule(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4.5H5.5v15H8" />
      <path d="M16 4.5h2.5v15H16" />
      <path d="M12 9.5v5" />
    </Icon>
  );
}

/** طريق: مسار بنقاط متتابعة. */
export function IconRoute(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="18.5" r="1.8" />
      <circle cx="18.5" cy="5.5" r="1.8" />
      <path d="M8.5 18.5h5.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-6h4" strokeDasharray="2.5 2.5" />
    </Icon>
  );
}

/** قارئ/راوٍ: رمز هندسي مجرّد، لا صورة إنسان (SPEC §235). */
export function IconReader(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v4" />
      <path d="M5.5 20.5c0-4 2.9-7 6.5-7s6.5 3 6.5 7" />
      <circle cx="12" cy="9.5" r="2.6" />
    </Icon>
  );
}

/** مصدر/دليل: علامة اقتباس تحريرية. */
export function IconSource(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5.5v5.2c0 3.4 1.9 5.6 4.6 7" />
      <path d="M13 5.5v5.2c0 3.4 1.9 5.6 4.6 7" />
      <path d="M5 5.5h4.4" />
      <path d="M13 5.5h4.4" />
    </Icon>
  );
}

/** موضع مضبوط: نقطة مثبّتة على خط. */
export function IconAnchor(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v17" />
      <circle cx="12" cy="9.5" r="3" />
      <path d="M8.5 20.5h7" />
    </Icon>
  );
}

/** ترتيب ثابت: قائمة مرتّبة بطول متناقص. */
export function IconSequence(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 5v14" />
      <path d="M8.5 8h11" />
      <path d="M8.5 12h8" />
      <path d="M8.5 16h5" />
    </Icon>
  );
}

/** موثّق: درع بعلامة صح. */
export function IconVerified(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v5.5c0 4.3-2.8 7.6-7 9-4.2-1.4-7-4.7-7-9V6Z" />
      <path d="m9 12 2.2 2.2L15 10.5" />
    </Icon>
  );
}

/** قيد المراجعة: دائرة نصف مستكملة. */
export function IconPending(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" opacity="0.24" />
      <path d="M12 4v16" />
    </Icon>
  );
}

/** متعارض: مساران يتفرّعان بلا التقاء. */
export function IconConflict(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4.5v4.8c0 2 1.6 3.2 3.3 3.2h5.4c1.7 0 3.3 1.2 3.3 3.2v3.8" />
      <path d="m15 17.5 3 3 3-3" />
      <circle cx="6" cy="4.2" r="1.6" />
    </Icon>
  );
}

/* ------------------------------ البيانات والتحكم ----------------------------- */

/** إحصاءات: أعمدة بيانات. */
export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7 20V11" />
      <path d="M12 20V5" />
      <path d="M17 20v-6" />
    </Icon>
  );
}

/** لوحة التحكم: مؤشر قياس. */
export function IconGauge(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17 15.5 10" />
      <circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** إحصاء/فهرس: علامة مرجعية. */
export function IconIndex(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4.5h10.5v15H9" />
      <path d="M9 4.5 4.5 7v12.5H9" />
      <path d="M12.5 9h4" />
      <path d="M12.5 13h4" />
    </Icon>
  );
}

/* --------------------------------- الواجهة ---------------------------------- */

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </Icon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </Icon>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

/** سهم إلى الأمام في اتجاه القراءة (RTL: إلى اليسار). */
export function IconArrowForward(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  );
}

/** سهم إلى الخلف في اتجاه القراءة (RTL: إلى اليمين). */
export function IconArrowBack(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

/** إعادة تشغيل الترسيم: حركة يجوز للمستخدم أن يعيدها صراحة (SPEC §51). */
export function IconReplay(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </Icon>
  );
}

export function IconAccount(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
    </Icon>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1" />
    </Icon>
  );
}

export function IconZoomIn(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M10.5 8v5M8 10.5h5" />
      <path d="m15 15 4.5 4.5" />
    </Icon>
  );
}

export function IconZoomOut(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M8 10.5h5" />
      <path d="m15 15 4.5 4.5" />
    </Icon>
  );
}
