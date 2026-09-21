// شجرة القراءات — Qiraat Tree
//
// مشروع التشجير - نظام القراءات العشر
//
// هذه شجرة الرواية عند المشروع: القراء العشرة ← الرواة العشرون ← الطرق.
// كل اسم وترتيب هنا من `src/data/qiraat-data/qiraat.ts`، ولا شيء مكتوب يدويا.
//
// الأسلوب: مخطط علمي لا لعبة. لا عقد متوهجة ولا اهتزاز؛ التمييز بالتعتيم
// والسماكة فقط (SPEC §28, §29, §48-49). والرسم كله من اليمين إلى اليسار
// كما يُقرأ الكتاب العربي: القارئ في اليمين، ثم الراوي، ثم الطرق في الطرف.
//
// التفاعل: التمرير أو التركيز يُبرز فرع القارئ كاملا ويخفّف ما سواه؛ والنقر
// يثبّت الاختيار ويفصّله في اللوحة الجانبية.

'use client';

import { useMemo, useState } from 'react';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

export interface QiraatPathNode {
  id: string;
  fullName: string;
}

export interface QiraatNarratorNode {
  id: string;
  name: string;
  tayyibahOrder: number;
  paths: QiraatPathNode[];
}

export interface QiraatImamNode {
  id: string;
  name: string;
  order: number;
  region: string;
  narrators: QiraatNarratorNode[];
}

/** هندسة الشجرة. القيم بوحدات viewBox، والقياس من العرض المتاح. */
const G = {
  width: 660,
  imamNumeralX: 636,
  imamNameX: 618,
  imamNodeX: 566,
  narratorNameX: 300,
  narratorRowHeight: 30,
  imamTop: 46,
  padding: { top: 44, bottom: 26 },
  // شعب الطرق: علامة مختصرة ملاصقة لاسم الراوي، لا صندوق منفصل.
  tickRight: 178,
  tickLength: 28,
  tickGap: 7,
};

/** منحنى وصلي: أفقي عند الطرفين، بميل هادئ في الوسط. */
function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

export function QiraatTree({ imams }: { imams: QiraatImamNode[] }) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? pinned;

  const geometry = useMemo(() => {
    const rows = imams.map((imam, imamIndex) => {
      const narrators = imam.narrators.map((narrator, narratorIndex) => ({
        narrator,
        y: G.padding.top + (imamIndex * 2 + narratorIndex) * G.narratorRowHeight + G.narratorRowHeight / 2,
      }));
      const imamY = narrators.length
        ? (narrators[0].y + narrators[narrators.length - 1].y) / 2
        : G.padding.top + imamIndex * G.narratorRowHeight * 2 + G.narratorRowHeight;
      return { imam, y: imamY, narrators };
    });

    const height = G.padding.top + imams.length * 2 * G.narratorRowHeight + G.padding.bottom;
    return { rows, height };
  }, [imams]);

  const activeImam = imams.find((imam) => imam.id === active) ?? null;
  const activeNarrator = useMemo(() => {
    if (!active) return null;
    for (const imam of imams) {
      const narrator = imam.narrators.find((item) => item.id === active);
      if (narrator) return { narrator, imam };
    }
    return null;
  }, [active, imams]);

  const dimGroup = (imamId: string, narratorId?: string) => {
    if (!activeImam && !activeNarrator) return false;
    const focusedImamId = activeImam?.id ?? activeNarrator?.imam.id;
    if (imamId !== focusedImamId) return true;
    if (activeNarrator) return narratorId !== activeNarrator.narrator.id;
    return false;
  };

  const narratorCount = imams.reduce((total, imam) => total + imam.narrators.length, 0);
  const pathCount = imams.reduce(
    (total, imam) => total + imam.narrators.reduce((sum, narrator) => sum + narrator.paths.length, 0),
    0
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
      <div className="min-w-0">
        <div className="tashjeer-scroll-area -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <svg
          viewBox={`0 0 ${G.width} ${geometry.height}`}
          className="w-full min-w-[34rem]"
          role="img"
          aria-label={`شجرة القراءات: ${toArabicDigits(imams.length)} قراء، ${toArabicDigits(narratorCount)} راويا، ${toArabicDigits(pathCount)} طريقا`}
        >
          {/* رؤوس الأعمدة: واحد فقط لكل مستوى، لا يتكرر مع كل صف. */}
          <g fontSize={10} fill="var(--color-ink-400)">
            <text x={G.imamNameX} y={G.padding.top - 20} textAnchor="end">
              القارئ
            </text>
            <text x={G.narratorNameX} y={G.padding.top - 20} textAnchor="end">
              الراوي
            </text>
            <text x={G.tickRight - G.tickLength} y={G.padding.top - 20}>
              الطرق
            </text>
          </g>

          {/* الوصلات أولا: خلفية البنية. */}
          <g fill="none" stroke="var(--color-line-strong)" strokeWidth={1}>
            {geometry.rows.map((row) => (
              <g key={row.imam.id}>
                {row.narrators.map((narratorRow) => {
                  const dimmed = dimGroup(row.imam.id, narratorRow.narrator.id);
                  return (
                    <path
                      key={narratorRow.narrator.id}
                      d={linkPath(G.imamNodeX - 8, row.y, G.narratorNameX + 14, narratorRow.y)}
                      opacity={dimmed ? 0.18 : 0.6}
                    />
                  );
                })}
              </g>
            ))}
            {/* شعب الطرق: خطان قصيران لكل راوٍ، موصولان بعمود رأسي واحد. */}
            {geometry.rows.map((row) =>
              row.narrators.map((narratorRow) => {
                const dimmed = dimGroup(row.imam.id, narratorRow.narrator.id);
                const count = Math.max(narratorRow.narrator.paths.length, 1);
                const spread = count > 1 ? G.tickGap : 0;
                return (
                  <g key={`fork-${narratorRow.narrator.id}`} opacity={dimmed ? 0.18 : 0.8}>
                    {/* علامة الطرق: خط عمودي قصير يجمعها، ثم خط لكل طريق.
                        الطول ثابت، فيُقاس العرض بعدد الطرق لا بحجم الرسم. */}
                    <line
                      x1={G.tickRight}
                      y1={narratorRow.y - spread}
                      x2={G.tickRight}
                      y2={narratorRow.y + spread}
                      stroke="var(--color-ink-300)"
                    />
                    {narratorRow.narrator.paths.map((path, index) => {
                      const offset = count > 1 ? (index - (count - 1) / 2) * spread * 2 : 0;
                      const y = narratorRow.y + offset;
                      return (
                        <g key={path.id}>
                          <line
                            x1={G.tickRight}
                            y1={y}
                            x2={G.tickRight - G.tickLength}
                            y2={y}
                            strokeWidth={1.6}
                            stroke="var(--color-ink-400)"
                          />
                          <title>{path.fullName}</title>
                        </g>
                      );
                    })}
                  </g>
                );
              })
            )}
          </g>

          {/* الرواة */}
          {geometry.rows.map((row) =>
            row.narrators.map((narratorRow) => {
              const dimmed = dimGroup(row.imam.id, narratorRow.narrator.id);
              const selected = activeNarrator?.narrator.id === narratorRow.narrator.id;
              const emphasized = Boolean(activeImam) || selected;
              return (
                <g
                  key={narratorRow.narrator.id}
                  opacity={dimmed ? 0.26 : 1}
                  className="cursor-pointer"
                  onClick={() => setPinned(narratorRow.narrator.id)}
                  onMouseEnter={() => setHovered(narratorRow.narrator.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect
                    x={G.narratorNameX - 190}
                    y={narratorRow.y - 11}
                    width={216}
                    height={22}
                    rx={3}
                    fill="transparent"
                  />
                  <text
                    x={G.narratorNameX}
                    y={narratorRow.y + 4.5}
                    textAnchor="end"
                    fontSize={13}
                    fontWeight={emphasized && !dimmed ? 600 : 400}
                    fill={emphasized && !dimmed ? 'var(--color-ink-900)' : 'var(--color-ink-600)'}
                  >
                    {narratorRow.narrator.name}
                  </text>
                  <title>{`${narratorRow.narrator.name} — الترتيب في الطيبة ${toArabicDigits(narratorRow.narrator.tayyibahOrder)}`}</title>
                </g>
              );
            })
          )}

          {/* القراء العشرة */}
          {geometry.rows.map((row) => {
            const dimmed = dimGroup(row.imam.id);
            const selected = activeImam?.id === row.imam.id;
            return (
              <g
                key={row.imam.id}
                opacity={dimmed ? 0.26 : 1}
                className="cursor-pointer"
                onClick={() => setPinned(row.imam.id)}
                onMouseEnter={() => setHovered(row.imam.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={G.imamNameX - 120}
                  y={row.y - 18}
                  width={228}
                  height={36}
                  rx={4}
                  fill="transparent"
                />
                <circle
                  cx={G.imamNodeX}
                  cy={row.y}
                  r={selected || (!active && !dimmed) ? 4.5 : 3.6}
                  fill={
                    selected || (!active && !dimmed) ? 'var(--color-primary-600)' : 'var(--color-ink-300)'
                  }
                />
                <text
                  x={G.imamNameX}
                  y={row.y + 1}
                  textAnchor="end"
                  fontSize={17}
                  fontFamily="'Amiri', serif"
                  fontWeight={700}
                  fill="var(--color-ink-900)"
                >
                  {row.imam.name}
                </text>
                <text
                  x={G.imamNameX}
                  y={row.y + 14}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--color-ink-400)"
                >
                  {row.imam.region}
                </text>
                <text
                  x={G.imamNumeralX}
                  y={row.y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-ink-300)"
                >
                  {toArabicDigits(row.imam.order)}
                </text>
                <title>{`${row.imam.name} — ${row.imam.region}`}</title>
              </g>
            );
          })}
        </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary-600" />
            القارئ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-300" />
            الراوي
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
              <line x1="16" y1="5" x2="4" y2="5" stroke="var(--color-ink-400)" strokeWidth="1.6" />
            </svg>
            الطريق
          </span>
          <span>الأرقام: ترتيب القراء في طيبة النشر</span>
        </div>
      </div>

      {/* اللوحة الجانبية: تفصيل ما اختير، لا كل الشجرة في وقت واحد. */}
      <aside className="min-w-0 rounded-lg border border-line bg-panel p-4">
        {activeImam ? (
          <div>
            <p className="eyebrow">القارئ</p>
            <h3 className="mt-1 font-amiri text-h3 text-ink-900">{activeImam.name}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-2">
              <dt className="meta-key">جهته</dt>
              <dd className="meta-value">{activeImam.region}</dd>
              <dt className="meta-key">ترتيبه في الطيبة</dt>
              <dd className="meta-value numeral">{toArabicDigits(activeImam.order)}</dd>
              <dt className="meta-key">رواته</dt>
              <dd className="meta-value numeral">{toArabicDigits(activeImam.narrators.length)}</dd>
              <dt className="meta-key">طرقه المسجّلة</dt>
              <dd className="meta-value numeral">
                {toArabicDigits(activeImam.narrators.reduce((sum, item) => sum + item.paths.length, 0))}
              </dd>
            </dl>

            <ul className="mt-4 space-y-3">
              {activeImam.narrators.map((narrator) => (
                <li key={narrator.id}>
                  <p className="text-label font-medium text-ink-800">{narrator.name}</p>
                  <ul className="mt-1 space-y-1">
                    {narrator.paths.map((path) => (
                      <li key={path.id} className="text-citation text-ink-500">
                        {path.fullName}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : activeNarrator ? (
          <div>
            <p className="eyebrow">الراوي</p>
            <h3 className="mt-1 font-amiri text-h3 text-ink-900">{activeNarrator.narrator.name}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-2">
              <dt className="meta-key">عن</dt>
              <dd className="meta-value">{activeNarrator.imam.name}</dd>
              <dt className="meta-key">ترتيبه في الطيبة</dt>
              <dd className="meta-value numeral">
                {toArabicDigits(activeNarrator.narrator.tayyibahOrder)}
              </dd>
            </dl>
            <ul className="mt-4 space-y-1">
              {activeNarrator.narrator.paths.map((path) => (
                <li key={path.id} className="text-citation text-ink-600">
                  {path.fullName}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="eyebrow">البنية</p>
            <p className="mt-2 text-body-sm text-ink-600">
              كل قارئ يروي عنه راويان، ولكل راوٍ طرق متعددة. تمرير المؤشر على قارئ يبرز فروعه،
              والنقر يثبّت الاختيار ويفصّله هنا.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <dt className="meta-key">القراء</dt>
                <dd className="numeral text-h3 text-ink-900">{toArabicDigits(imams.length)}</dd>
              </div>
              <div>
                <dt className="meta-key">الرواة</dt>
                <dd className="numeral text-h3 text-ink-900">{toArabicDigits(narratorCount)}</dd>
              </div>
              <div>
                <dt className="meta-key">الطرق المسجّلة</dt>
                <dd className="numeral text-h3 text-ink-900">{toArabicDigits(pathCount)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-ink-400">
              البنية تقبل مئات الطرق؛ المسجّل هنا بذرة أولى قابلة للتوسّع بالاستيراد.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
