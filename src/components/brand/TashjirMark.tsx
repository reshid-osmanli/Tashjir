// العلامة — Tashjir Mark
//
// مشروع التشجير - نظام القراءات العشر
//
// البناء: عقدة أصل واحدة في الأعلى، وثلاثة فروع تنحدر إلى ثلاث عقد.
// هذا ليس اختيارا جماليا: هو تمثيل مصغّر لقاعدة التشجير (نص واحد ← قراءات
// متعددة)، وهو خال من أي رمز ديني جاهز (SPEC §195, §4, §5).
//
// الخطوط كلها `currentColor`، فتعمل العلامة على الرقّ وعلى الفحمي بلا تعديل.

export function TashjirMark({
  size = 28,
  className,
  animated = false,
  title,
}: {
  size?: number;
  className?: string;
  /** تحريك الترسيم عند التحميل: مرة واحدة فقط، ثم يستقر (SPEC §196). */
  animated?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      {title ? <title>{title}</title> : null}

      {/* عقدة الأصل */}
      <circle cx="12" cy="4.4" r="1.7" fill="currentColor" stroke="none" />

      {/* الساق والفرعان: تُرسم مرة واحدة عند التحميل ثم تستقر. */}
      <g className={animated ? 'mark-draw' : undefined}>
        <path d="M12 6.1v4.4" />
        <path d="M12 10.5c0 2.9-4.7 3.2-4.7 6.3" />
        <path d="M12 10.5c0 2.9 4.7 3.2 4.7 6.3" />
        <path d="M12 10.5v6.3" />
      </g>

      {/* عقد القراءات */}
      <circle cx="7.3" cy="18.6" r="1.5" />
      <circle cx="16.7" cy="18.6" r="1.5" />
      <circle cx="12" cy="18.6" r="1.5" />
    </svg>
  );
}

/**
 * العلامة مع اسم المشروع. تُستعمل في الترويسة والتذييل بحجم واحد ثابت،
 * فلا يتغيّر شكل الهوية بين سطحين.
 */
export function TashjirWordmark({
  size = 28,
  className,
  subtitle = 'نظام القراءات العشر',
  animated = false,
}: {
  size?: number;
  className?: string;
  subtitle?: string | null;
  animated?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <TashjirMark size={size} className="text-primary-700" animated={animated} />
      <span className="flex flex-col leading-none">
        <span className="font-amiri text-[1.0625rem] font-bold text-ink-900">التشجير</span>
        {subtitle ? (
          <span className="mt-1 text-micro text-ink-400">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
