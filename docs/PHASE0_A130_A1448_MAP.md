# خريطة المرحلة 0: A130 و A1448

> هذه خريطة **استرجاعية للحالة قبل الإصلاح**، وليست وصفًا للكود الحالي؛
> الحالة الحالية موثّقة في `docs/EDITOR.md` §7.4 و`docs/UI_REGISTRY.md`.
> اعتمدت على سجل واجهة المستخدم `src/ui/ui-registry.records.json`، وشيفرة المصدر، والنسخة المنشورة على
> `https://tashjir.vercel.app/editor` حين أمكن فحصها. النسخة المنشورة تعطي
> «Application error: a client-side exception has occurred» على `/editor`
> و`/editor?uiInspector=1`؛ لذلك اعتُمد DOM/الشيفرة المحلية مصدرًا للحقيقة،
> مع إثبات أن SHA النشر (`1bfb5dcd…`) يساوي `main` و`HEAD` لكن Runtime قد
> يختلف. **A1148 ليس A1448**؛ A1148 خيار `FaceSelect` في `RelationsPanel.tsx`
> ولم يُغيّر اسمه ولا سلوكه.

## A130 — قائمة سياق العنصر النشط

| البند | الحقيقة قبل الإصلاح |
| --- | --- |
| الاسم في السجل | `Selection Context Menu` — `menu`, الحالة `active`, الميزة `A001`, الأب `A111` |
| المكوّن/الملف | `SelectionContextMenu` — `src/components/editor/SelectionContextMenu.tsx` |
| كيف يُفتح | `TashjeerCanvas.handleContextMenu` يحدد كلمة/سطر/وجه ثم يضبط `contextMenu`؛ يُرسم بـ `createPortal` في `document.body` |
| الأبناء | A1259 COPY، A1260 CUT، A1261 PASTE، A1262 DELETE، A1263 COPY_ID، A1264 LINK، A1265 MOVE_UP، A1266 MOVE_DOWN، A1267 WHY، A1268 UNLINK، A1269 EDIT |
| الأحداث | `onClick` على كل زر؛ `pointerdown`/`keydown` للإغلاق؛ `Escape` يغلق |
| الإجراءات قبل الإصلاح | COPY/CUT/PASTE/DELETE/COPY_ID و EDIT لنوع RULE فقط كانت تنفّذ; PASTE كان يستدعي `pasteSelection` منخفض المستوى بلا تأكيد |
| الأوامر الميتة | LINK، MOVE_UP، MOVE_DOWN، WHY، UNLINK، ومعظم EDIT/DELETE لأنواع LINE/RULE/COMPOSITE_FACE كانت تُبتلع في `default: break` بلا أثر ولا رسالة |
| الارتباط بالمخزن/المحرك | `useEditorStore` للتحديد/الحافظة؛ لا ربط بمحرك التشجير؛ لا `confirmAction` على اللصق |
| الجذر | زر يبدو فعّالًا لكنه بلا تنفيذ، وحوار التأكيد الكمي كان معطّلًا أصلًا (موافقة تلقائية في `confirm-store.ts` ومستضيف A327 غير مركّب) |

## A1448 — قالب تحديد السطر الكلاسيكي

| البند | الحقيقة قبل الإصلاح |
| --- | --- |
| الاسم في السجل | `Classic Line Selection Template` — `control`, الحالة `active`, الميزة `A001`, الأب `A1443` |
| المكوّن/الملف | `ClassicLineShape` داخل `src/components/editor/TashjeerFigure.tsx`؛ يُركّب من `TashjeerCanvas.tsx` و`src/components/quran/AyahTashjeerView.tsx` |
| الأبناء/المتقاعد | الابن A1450 (مداخل السطر)؛ A1449 متقاعد |
| البنية | `<g data-ui-instance={line.id}>` مع مستطيل ضرب شفاف، نبضة، خطوط توضيحية ومداخل؛ **لا أزرار ولا حقول** |
| الأحداث قبل الإصلاح | `onClick` → `onLineClick` → `selectLine/selectVariant`; `onMouseEnter/onMouseLeave` للتمرير; لا `Pointer Events`, لا ضغط، لا تركيز، لا لوحة مفاتيح، لا ARIA |
| الحالات قبل الإصلاح | `isSelected` مشتق من `selectedVariantId` فقط، لا من التحديد الموحّد؛ لا normal/hover/focus/pressed/selected/dragging/disabled/saving/error |
| الارتباط بالمخزن/المحرك | `selectLine` في `editor-store.ts`; الرسم من `classic-tashjeer.ts`; لا تعديل لقواعد المحرك |
| الجذر | قالب SVG تفاعلي ناقص: يبدو قابلًا للنقر لكنه غير قابل للوصول بلوحة المفاتيح ولا يعكس التحديد الموحّد |

## ما فُحص أيضًا

- `docs/EDITOR.md`، `docs/SRS_STATUS.md`، `docs/UI_ARCHITECTURE.md`،
  `docs/ENGINE_STUDIO.md`، `README.md`.
- الاختبارات: `tests/e2e/editor-ph3.spec.ts`، `tests/manual-links.test.ts`،
  `tests/editor-manual-actions.test.ts`، اختبارات القوائم الطويلة.
- النشر: `/` و`/quran` يعملان؛ `/editor` و`/editor?ayah=1004` و`?uiInspector=1`
  تعطي خطأ عميل؛ رابط النشر المحمي يتطلب SSO؛ لا يمكن استعمال المفتش هناك.
- `A1148` خيار حقيقي لكنه غير ذي صلة؛ لم يُبدّل بأي معرّف آخر.
- السجل: 1785 سجلًا، أعلى معرّف `A2210` قبل إضافة عناصر المرحلة 2.
