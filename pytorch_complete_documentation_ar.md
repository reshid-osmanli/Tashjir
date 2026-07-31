# 🐍 توثيق PyTorch الشامل (v2.13 - الإصدار المستقر)

> **آخر تحديث:** 31 يوليو 2026 | **الإصدار:** 2.13.0 (مستقر) | **الموقع الرسمي:** [pytorch.org](https://pytorch.org)

---

## 📑 جدول المحتويات

1. [مقدمة عن PyTorch](#1-مقدمة-عن-pytorch)
2. [تثبيت PyTorch](#2-تثبيت-pytorch)
3. [وحدة `torch` - العمليات الأساسية](#3-وحدة-torch---العمليات-الأساسية)
4. [وحدة `torch.Tensor` - المصفوفات متعددة الأبعاد](#4-وحدة-torchtensor---المصفوفات-متعددة-الأبعاد)
5. [وحدة `torch.nn` - الشبكات العصبية](#5-وحدة-torchnn---الشبكات-العصبية)
6. [وحدة `torch.nn.functional` - دوال الشبكات العصبية](#6-وحدة-torchnnfunctional---دوال-الشبكات-العصبية)
7. [وحدة `torch.optim` - خوارزميات التحسين](#7-وحدة-torchoptim---خوارزميات-التحسين)
8. [وحدة `torch.autograd` - التفاضل التلقائي](#8-وحدة-torchautograd---التفاضل-التلقائي)
9. [وحدة `torch.cuda` - معالجة GPU](#9-وحدة-torchcuda---معالجة-gpu)
10. [وحدة `torch.amp` - الدقة المختلطة التلقائية](#10-وحدة-torchamp---الدقة-المختلطة-التلقائية)
11. [وحدة `torch.distributed` - المعالجة الموزعة](#11-وحدة-torchdistributed---المعالجة-الموزعة)
12. [وحدة `torch.linalg` - الجبر الخطي](#12-وحدة-torchlinalg---الجبر-الخطي)
13. [وحدة `torch.fft` - تحويل فورييه](#13-وحدة-torchfft---تحويل-فورييه)
14. [وحدة `torch.random` - العينات العشوائية](#14-وحدة-torchrandom---العينات-العشوائية)
15. [وحدة `torch.sparse` - المصفوفات المتفرقة](#15-وحدة-torchsparse---المصفوفات-المتفرقة)
16. [وحدة `torch.utils.data` - تحميل البيانات](#16-وحدة-torchutilsdata---تحميل-البيانات)
17. [وحدة `torch.hub` - النماذج المحفوظة مسبقاً](#17-وحدة-torchhub---النماذج-المحفوظة-مسبقاً)
18. [وحدة `torch.onnx` - تصدير النماذج](#18-وحدة-torchonnx---تصدير-النماذج)
19. [وحدة `torch.profiler` - تحليل الأداء](#19-وحدة-torchprofiler---تحليل-الأداء)
20. [وحدة `torch.export` - تصدير النماذج](#20-وحدة-torchexport---تصدير-النماذج)
21. [وحدة `torch.compiler` - تسريع التحويل البرمجي](#21-وحدة-torchcompiler---تسريع-التحويل-البرمجي)
22. [وحدة `torch.distributions` - التوزيعات الاحتمالية](#22-وحدة-torchdistributions---التوزيعات-الاحتمالية)
23. [وحدات إضافية](#23-وحدات-إضافية)
24. [متغيرات البيئة](#24-متغيرات-البيئة)
25. [مراجع سريعة](#25-مراجع-سريعة)

---

## 1. مقدمة عن PyTorch

**PyTorch** هي مكتبة مفتوحة المصدر لتعلم الآلة والتعلم العميق، طورتها Facebook AI Research (Meta). توفر:

- 🧮 **مكتبة موترات (Tensors)** محسّنة للحوسبة على GPUs و CPUs
- 🔄 **تفاضل تلقائي (Autograd)** لحساب المشتقات
- 🧠 **وحدات شبكات عصبية** جاهزة (`torch.nn`)
- ⚡ **دعم الحوسبة الموزعة** عبر أجهزة متعددة
- 📱 **دعم النشر** على الأجهزة المحمولة والحواف

### المفاهيم الأساسية

| المفهوم | الوصف |
|---------|-------|
| **Tensor** | مصفوفة متعددة الأبعاد (مشابهة لـ NumPy ndarray) مع دعم GPU |
| **Autograd** | نظام التفاضل التلقائي لتتبع العمليات وحساب التدرجات |
| **nn.Module** | الوحدة الأساسية لبناء الشبكات العصبية |
| **Optimizer** | خوارزميات تحسين معاملات النموذج |
| **DataLoader** | تحميل البيانات بكفاءة مع دعم المعالجة المتوازية |

---

## 2. تثبيت PyTorch

### التثبيت الأساسي

```bash
# الإصدار المستقر مع CUDA (NVIDIA GPU)
pip install torch torchvision torchaudio

# الإصدار المستقر - CPU فقط
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# إصدار محدد مع CUDA
pip install torch==2.13.0 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### التحقق من التثبيت

```python
import torch
print(f"إصدار PyTorch: {torch.__version__}")
print(f"CUDA متاح: {torch.cuda.is_available()}")
print(f"إصدار CUDA: {torch.version.cuda}")
```

---

## 3. وحدة `torch` - العمليات الأساسية

### 3.1 إنشاء الموترات (Tensor Creation)

```python
import torch

# من البيانات مباشرة
torch.tensor([[1, 2], [3, 4]])           # من قائمة
torch.tensor(data, dtype=torch.float32)   # مع تحديد النوع
torch.as_tensor(data)                      # بدون نسخ إذا أمكن
torch.from_numpy(np_array)                 # من NumPy

# موترات مهيأة بقيم
torch.zeros(3, 4)                          # zeros: كل القيم 0
torch.ones(2, 3)                           # ones: كل القيم 1
torch.full((2, 3), 7.0)                   # full: قيمة محددة
torch.empty(2, 3)                          # empty: غير مهيأ
torch.eye(3)                               # eye: مصفوفة وحدة
torch.eye(3, 4)                            # eye مستطيلة

# سلاسل عددية
torch.arange(start, end, step)             # تسلسل بخطوة
torch.linspace(start, end, steps)          # متباعد بانتظام
torch.logspace(start, end, steps, base=10) # متباعد لوغاريتمياً

# إنشاء مشابه
torch.zeros_like(tensor)                   # zeros بنفس الشكل
torch.ones_like(tensor)                    # ones بنفس الشكل
torch.full_like(tensor, value)             # full بنفس الشكل
torch.empty_like(tensor)                   # empty بنفس الشكل
torch.rand_like(tensor)                    # عشوائي بنفس الشكل
torch.randn_like(tensor)                   # عشوائي طبيعي بنفس الشكل
```

### 3.2 أنواع البيانات (dtypes)

| النوع | الوصف | البتات |
|-------|-------|--------|
| `torch.float32` / `torch.float` | فاصلة عائمة 32-بت | 32 |
| `torch.float64` / `torch.double` | فاصلة عائمة 64-بت | 64 |
| `torch.float16` / `torch.half` | فاصلة عائمة 16-بت | 16 |
| `torch.bfloat16` | Brain Floating Point | 16 |
| `torch.int8` | عدد صحيح 8-بت | 8 |
| `torch.int16` / `torch.short` | عدد صحيح 16-بت | 16 |
| `torch.int32` / `torch.int` | عدد صحيح 32-بت | 32 |
| `torch.int64` / `torch.long` | عدد صحيح 64-بت | 64 |
| `torch.uint8` | عدد صحيح غير سالب 8-بت | 8 |
| `torch.bool` | قيمة منطقية | 1 |
| `torch.complex64` | عدد مركب 64-بت | 64 |
| `torch.complex128` | عدد مركب 128-بت | 128 |

### 3.3 الفهرسة والتقطيع (Indexing & Slicing)

```python
tensor[0]              # الصف الأول
tensor[:, 1]           # العمود الثاني
tensor[1, 2]           # عنصر محدد
tensor[1:3, 2:5]       # تقطيع
tensor[[0, 2, 4]]      # فهرسة متقدمة
tensor[tensor > 0]     # فهرسة شرطية (boolean masking)
tensor[0, ...]         # Ellipsis
```

### 3.4 العمليات الحسابية

```python
# العمليات الأساسية
torch.add(a, b)        # a + b
torch.sub(a, b)        # a - b
torch.mul(a, b)        # a * b
torch.div(a, b)        # a / b
torch.matmul(a, b)     # ضرب مصفوفات
torch.pow(a, n)        # a ** n
torch.sqrt(tensor)     # الجذر التربيعي
torch.exp(tensor)      # e^x
torch.log(tensor)      # ln(x)
torch.abs(tensor)      # القيمة المطلقة
torch.ceil(tensor)     # التقريب للأعلى
torch.floor(tensor)    # التقريب للأسفل
torch.round(tensor)    # التقريب
torch.clamp(tensor, min, max)  # القص
torch.sigmoid(tensor)  # الدالة السينية
torch.tanh(tensor)     # الظل الزائدي
torch.relu(tensor)     # ReLU

# العمليات في المكان (in-place) - تنتهي بـ _
tensor.add_(5)         # إضافة في المكان
tensor.mul_(2)         # ضرب في المكان
```

### 3.5 عمليات الاختزال (Reduction)

```python
torch.sum(tensor)          # المجموع الكلي
torch.sum(tensor, dim=0)   # مجموع على بعد محدد
torch.mean(tensor)         # المتوسط
torch.median(tensor)       # الوسيط
torch.std(tensor)          # الانحراف المعياري
torch.var(tensor)          # التباين
torch.max(tensor)          # القيمة العظمى
torch.min(tensor)          # القيمة الصغرى
torch.argmax(tensor)       # مؤشر القيمة العظمى
torch.argmin(tensor)       # مؤشر القيمة الصغرى
torch.norm(tensor)         # المعيار (norm)
torch.unique(tensor)       # القيم الفريدة
torch.prod(tensor)         # حاصل الضرب
torch.all(tensor)          # هل الكل True؟
torch.any(tensor)          # هل يوجد True؟
```

### 3.6 المقارنات والمنطق

```python
torch.eq(a, b)          # a == b
torch.ne(a, b)          # a != b
torch.lt(a, b)          # a < b
torch.le(a, b)          # a <= b
torch.gt(a, b)          # a > b
torch.ge(a, b)          # a >= b
torch.logical_and(a, b) # a AND b
torch.logical_or(a, b)  # a OR b
torch.logical_not(a)    # NOT a
torch.where(condition, x, y)  # اختيار شرطي
```

### 3.7 تغيير الشكل (Manipulation)

```python
tensor.view(shape)          # إعادة تشكيل (مشاركة البيانات)
tensor.reshape(shape)       # إعادة تشكيل (قد ينسخ)
tensor.transpose(dim0, dim1)# تبديل بعدين
tensor.permute(dims)        # تبديل الأبعاد
tensor.squeeze()            # إزالة الأبعاد ذات الحجم 1
tensor.unsqueeze(dim)       # إضافة بعد بحجم 1
tensor.flatten()            # تسطيح إلى بعد واحد
tensor.flatten(start_dim)   # تسطيح جزئي
torch.cat(tensors, dim)     # دمج على بعد
torch.stack(tensors, dim)   # تكديس (بعد جديد)
torch.split(tensor, size, dim)  # تقسيم
torch.chunk(tensor, chunks, dim) # تقسيم متساوي
tensor.expand(shape)        # توسيع (broadcasting)
tensor.repeat(sizes)        # تكرار
```

### 3.8 تحويل الأنواع والأجهزة

```python
tensor.to(dtype)            # تحويل النوع
tensor.to(device)           # نقل إلى جهاز
tensor.to('cuda')           # نقل إلى GPU
tensor.to('cpu')            # نقل إلى CPU
tensor.cuda()               # نقل إلى GPU (افتراضي)
tensor.cpu()                # نقل إلى CPU
tensor.float()              # تحويل إلى float32
tensor.double()             # تحويل إلى float64
tensor.half()               # تحويل إلى float16
tensor.int()                # تحويل إلى int32
tensor.long()               # تحويل إلى int64
tensor.bool()               # تحويل إلى bool
tensor.numpy()              # تحويل إلى NumPy (CPU فقط)
tensor.item()               # قيمة Python عددية
tensor.tolist()             # قائمة Python
```

### 3.9 الحفظ والتحميل

```python
# حفظ/تحميل موتر
torch.save(tensor, 'tensor.pt')
tensor = torch.load('tensor.pt')

# حفظ/تحميل نموذج كامل
torch.save(model.state_dict(), 'model_weights.pth')
model.load_state_dict(torch.load('model_weights.pth'))

# حفظ/تحميل Checkpoint
torch.save({
    'epoch': epoch,
    'model_state_dict': model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'loss': loss,
}, 'checkpoint.tar')
```

---

## 4. وحدة `torch.Tensor` - المصفوفات متعددة الأبعاد

`torch.Tensor` هو الفئة الأساسية في PyTorch. كل موتر له:

- **dtype**: نوع البيانات
- **device**: الجهاز (CPU/GPU)
- **layout**: تخطيط الذاكرة (strided, sparse, mkldnn)
- **requires_grad**: هل يتطلب تدرجاً

### خصائص الموتر

```python
tensor.shape         # الشكل
tensor.size()        # الشكل
tensor.dtype         # نوع البيانات
tensor.device        # الجهاز
tensor.layout        # تخطيط الذاكرة
tensor.ndim          # عدد الأبعاد
tensor.numel()       # عدد العناصر
tensor.requires_grad # هل يتطلب تدرج
tensor.grad          # التدرج (بعد backward)
tensor.grad_fn       # دالة التدرج
tensor.is_leaf       # هل هو ورقة في الرسم البياني الحسابي
```

### Tensor Views

```python
# view يُشارك البيانات الأصلية
y = x.view(2, 6)         # إعادة تشكيل
y = x.transpose(0, 1)    # تبديل
y = x[:5]                # تقطيع
y = x.expand(4, 3, 6)    # توسيع
y = x.permute(1, 0, 2)   # تبديل الأبعاد

# للتأكد من استمرارية الذاكرة
x = x.contiguous()
```

---

## 5. وحدة `torch.nn` - الشبكات العصبية

### 5.1 `nn.Module` - الفئة الأساسية

```python
import torch.nn as nn

class MyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(10, 5)
        self.relu = nn.ReLU()

    def forward(self, x):
        return self.relu(self.linear(x))

model = MyModel()
output = model(input_tensor)  # استدعاء forward تلقائياً
```

### 5.2 الحاويات (Containers)

| الوحدة | الوصف |
|--------|-------|
| `nn.Module` | الفئة الأساسية لكل وحدات الشبكات العصبية |
| `nn.Sequential` | حاوية متسلسلة: تمرير الإخراج تباعاً |
| `nn.ModuleList` | قائمة وحدات فرعية |
| `nn.ModuleDict` | قاموس وحدات فرعية |
| `nn.ParameterList` | قائمة معاملات |
| `nn.ParameterDict` | قاموس معاملات |

```python
# Sequential
model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)

# ModuleList
layers = nn.ModuleList([nn.Linear(10, 10) for _ in range(5)])

# ModuleDict
layers = nn.ModuleDict({
    'linear': nn.Linear(10, 10),
    'activation': nn.ReLU()
})
```

### 5.3 طبقات الالتفاف (Convolution Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.Conv1d` | التفاف 1D للإشارات |
| `nn.Conv2d` | التفاف 2D للصور |
| `nn.Conv3d` | التفاف 3D للفيديو |
| `nn.ConvTranspose1d` | التفاف منقول 1D |
| `nn.ConvTranspose2d` | التفاف منقول 2D (Deconvolution) |
| `nn.ConvTranspose3d` | التفاف منقول 3D |
| `nn.LazyConv1d` / `2d` / `3d` | التفاف مع تهيئة كسولة |
| `nn.Unfold` | استخراج كتل محلية منزلقة |
| `nn.Fold` | دمج كتل إلى موتر كبير |

```python
# Conv2d مثال
conv = nn.Conv2d(
    in_channels=3,      # عدد قنوات الإدخال (RGB = 3)
    out_channels=64,    # عدد المرشحات
    kernel_size=3,      # حجم النواة (3x3)
    stride=1,           # خطوة الانزلاق
    padding=1,          # الحشو
    dilation=1,         # التمدد
    groups=1,           # مجموعات الالتفاف
    bias=True           # إضافة الانحياز
)
```

### 5.4 طبقات التجميع (Pooling Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.MaxPool1d` / `2d` / `3d` | تجميع أقصى |
| `nn.MaxUnpool1d` / `2d` / `3d` | عكس التجميع الأقصى |
| `nn.AvgPool1d` / `2d` / `3d` | تجميع متوسط |
| `nn.AdaptiveMaxPool1d` / `2d` / `3d` | تجميع أقصى متكيف |
| `nn.AdaptiveAvgPool1d` / `2d` / `3d` | تجميع متوسط متكيف |
| `nn.FractionalMaxPool2d` / `3d` | تجميع أقصى كسري |
| `nn.LPPool1d` / `2d` / `3d` | تجميع قوة-متوسط |

### 5.5 طبقات الحشو (Padding Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.ReflectionPad1d` / `2d` / `3d` | حشو بالانعكاس |
| `nn.ReplicationPad1d` / `2d` / `3d` | حشو بالنسخ |
| `nn.ZeroPad1d` / `2d` / `3d` | حشو بالأصفار |
| `nn.ConstantPad1d` / `2d` / `3d` | حشو بقيمة ثابتة |
| `nn.CircularPad1d` / `2d` / `3d` | حشو دائري |

### 5.6 دوال التنشيط (Activation Functions)

| الدالة | الوصف |
|--------|-------|
| `nn.ReLU` | ReLU: max(0, x) |
| `nn.ReLU6` | ReLU محدود بـ 6 |
| `nn.LeakyReLU` | ReLU متسرب (negative_slope=0.01) |
| `nn.PReLU` | Parametric ReLU |
| `nn.RReLU` | Randomized Leaky ReLU |
| `nn.ELU` | Exponential Linear Unit |
| `nn.SELU` | Scaled ELU |
| `nn.CELU` | Continuously Differentiable ELU |
| `nn.GELU` | Gaussian Error Linear Unit |
| `nn.Sigmoid` | Sigmoid: 1/(1+e^(-x)) |
| `nn.Tanh` | Tanh |
| `nn.SiLU` / `nn.Swish` | Sigmoid Linear Unit |
| `nn.Mish` | Mish |
| `nn.Softplus` | Softplus: ln(1+e^x) |
| `nn.Softmax` | Softmax |
| `nn.LogSoftmax` | Log(Softmax(x)) |
| `nn.Softmin` | Softmin |
| `nn.Softmax2d` | Softmax على الخصائص المكانية |
| `nn.LogSigmoid` | Log(Sigmoid) |
| `nn.Hardtanh` | HardTanh |
| `nn.Hardsigmoid` | HardSigmoid |
| `nn.Hardswish` | HardSwish |
| `nn.Hardshrink` | Hard Shrinkage |
| `nn.Softshrink` | Soft Shrinkage |
| `nn.Tanhshrink` | Tanh Shrinkage |
| `nn.Threshold` | Threshold |
| `nn.GLU` | Gated Linear Unit |
| `nn.MultiheadAttention` | انتباه متعدد الرؤوس |

### 5.7 طبقات التسوية (Normalization Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.BatchNorm1d` / `2d` / `3d` | تسوية الدفعة |
| `nn.SyncBatchNorm` | تسوية دفعة متزامنة (موزع) |
| `nn.GroupNorm` | تسوية المجموعات |
| `nn.InstanceNorm1d` / `2d` / `3d` | تسوية المثيل |
| `nn.LayerNorm` | تسوية الطبقة |
| `nn.LocalResponseNorm` | تسوية الاستجابة المحلية |
| `nn.RMSNorm` | Root Mean Square Normalization |

### 5.8 الطبقات المتكررة (Recurrent Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.RNN` | شبكة عصبية متكررة |
| `nn.LSTM` | ذاكرة طويلة قصيرة المدى |
| `nn.GRU` | وحدة متكررة مُبوَّبة |
| `nn.RNNCell` | خلية RNN |
| `nn.LSTMCell` | خلية LSTM |
| `nn.GRUCell` | خلية GRU |

### 5.9 طبقات الانتباه (Attention Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.MultiheadAttention` | الانتباه متعدد الرؤوس |
| `nn.MultiheadAttention.fast_path` | مسار سريع |

### 5.10 الطبقات الخطية (Linear Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.Identity` | هوية (لا تفعل شيئاً) |
| `nn.Linear` | تحويل خطي: y = xAᵀ + b |
| `nn.Bilinear` | تحويل ثنائي الخطية |
| `nn.LazyLinear` | طبقة خطية بتهيئة كسولة |

### 5.11 طبقات الإسقاط (Dropout Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.Dropout` | إسقاط عشوائي (p=0.5) |
| `nn.Dropout1d` | إسقاط 1D |
| `nn.Dropout2d` | إسقاط 2D (قنوات كاملة) |
| `nn.Dropout3d` | إسقاط 3D |
| `nn.AlphaDropout` | إسقاط لـ SELU |
| `nn.FeatureAlphaDropout` | إسقاط خصائص Alpha |

### 5.12 الطبقات المتفرقة (Sparse Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.Embedding` | تضمين الكلمات |
| `nn.EmbeddingBag` | تضمين مع تجميع |

### 5.13 دوال المسافة (Distance Functions)

| الدالة | الوصف |
|--------|-------|
| `nn.CosineSimilarity` | تشابه جيب التمام |
| `nn.PairwiseDistance` | المسافة بين أزواج المتجهات |

### 5.14 دوال الخسارة (Loss Functions)

| الدالة | الوصف |
|--------|-------|
| `nn.L1Loss` | خسارة L1 (MAE) |
| `nn.MSELoss` | خسارة MSE |
| `nn.CrossEntropyLoss` | إنتروبيا متقاطعة (مع Softmax) |
| `nn.CTCLoss` | Connectionist Temporal Classification |
| `nn.NLLLoss` | Negative Log Likelihood |
| `nn.PoissonNLLLoss` | Poisson NLL |
| `nn.GaussianNLLLoss` | Gaussian NLL |
| `nn.KLDivLoss` | Kullback-Leibler Divergence |
| `nn.BCELoss` | Binary Cross Entropy |
| `nn.BCEWithLogitsLoss` | BCE مع Sigmoid مدمجة |
| `nn.MarginRankingLoss` | Margin Ranking |
| `nn.HingeEmbeddingLoss` | Hinge Embedding |
| `nn.MultiLabelMarginLoss` | Multi-label Margin |
| `nn.HuberLoss` | Huber (SmoothL1Loss) |
| `nn.SmoothL1Loss` | Smooth L1 |
| `nn.SoftMarginLoss` | Soft Margin |
| `nn.MultiLabelSoftMarginLoss` | Multi-label Soft Margin |
| `nn.CosineEmbeddingLoss` | Cosine Embedding |
| `nn.MultiMarginLoss` | Multi-class Margin |
| `nn.TripletMarginLoss` | Triplet Margin |
| `nn.TripletMarginWithDistanceLoss` | Triplet Margin مع مسافة مخصصة |

### 5.15 دوال الرؤية (Vision Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.PixelShuffle` | إعادة ترتيب البكسلات |
| `nn.PixelUnshuffle` | عكس PixelShuffle |
| `nn.Upsample` | تكبير العينة |
| `nn.UpsamplingNearest2d` | تكبير بأقرب جار |
| `nn.UpsamplingBilinear2d` | تكبير ثنائي الخطية |

### 5.16 طبقات المحول (Transformer Layers)

| الطبقة | الوصف |
|--------|-------|
| `nn.Transformer` | نموذج المحول الكامل |
| `nn.TransformerEncoder` | مشفر المحول |
| `nn.TransformerDecoder` | مفكك المحول |
| `nn.TransformerEncoderLayer` | طبقة مشفر المحول |
| `nn.TransformerDecoderLayer` | طبقة مفكك المحول |

### 5.17 أدوات مساعدة (Utilities)

```python
# دوال مهمة في nn.Module
model.parameters()         # كل المعاملات القابلة للتعلم
model.named_parameters()   # المعاملات مع أسمائها
model.children()           # الوحدات الفرعية المباشرة
model.named_children()     # مسماة
model.modules()            # كل الوحدات (بشكل متكرر)
model.named_modules()      # مسماة
model.train()              # وضع التدريب
model.eval()               # وضع التقييم
model.zero_grad()          # تصفير التدرجات
model.to(device)           # نقل للجهاز المحدد
model.apply(fn)            # تطبيق دالة على كل الوحدات
model.state_dict()         # قاموس الحالة
model.load_state_dict(dict)# تحميل الحالة
model.register_forward_hook(hook)       # تسجيل خطاف أمامي
model.register_forward_pre_hook(hook)   # خطاف ما قبل الأمامي
model.register_backward_hook(hook)      # خطاف خلفي
model.register_full_backward_hook(hook) # خطاف خلفي كامل
```

---

## 6. وحدة `torch.nn.functional` - دوال الشبكات العصبية

توفر دوال وظيفية (بدون حالة) تقابل طبقات `nn`:

```python
import torch.nn.functional as F

# الالتفاف
F.conv1d(input, weight)
F.conv2d(input, weight)
F.conv3d(input, weight)
F.conv_transpose1d(input, weight)
F.conv_transpose2d(input, weight)
F.conv_transpose3d(input, weight)

# التجميع
F.max_pool1d(input, kernel_size)
F.max_pool2d(input, kernel_size)
F.max_pool3d(input, kernel_size)
F.avg_pool1d(input, kernel_size)
F.avg_pool2d(input, kernel_size)
F.avg_pool3d(input, kernel_size)
F.adaptive_avg_pool2d(input, output_size)
F.adaptive_max_pool2d(input, output_size)

# دوال التنشيط
F.relu(input)                    # ReLU
F.leaky_relu(input, 0.01)       # LeakyReLU
F.elu(input)                     # ELU
F.selu(input)                    # SELU
F.gelu(input)                    # GELU
F.silu(input)                    # SiLU/Swish
F.mish(input)                    # Mish
F.sigmoid(input)                 # Sigmoid
F.tanh(input)                    # Tanh
F.softmax(input, dim=-1)        # Softmax
F.log_softmax(input, dim=-1)    # LogSoftmax
F.softplus(input)                # Softplus
F.softsign(input)                # Softsign

# التسوية
F.batch_norm(input, running_mean, running_var)
F.layer_norm(input, normalized_shape)
F.group_norm(input, num_groups)
F.instance_norm(input)
F.rms_norm(input, normalized_shape)

# الخسارة
F.cross_entropy(input, target)          # CrossEntropy
F.binary_cross_entropy(input, target)   # BCE
F.binary_cross_entropy_with_logits(input, target)
F.mse_loss(input, target)               # MSE
F.l1_loss(input, target)                # L1 / MAE
F.smooth_l1_loss(input, target)         # Smooth L1
F.kl_div(input, target)                 # KL Divergence
F.nll_loss(input, target)               # NLL
F.cosine_embedding_loss()
F.triplet_margin_loss()

# الإسقاط
F.dropout(input, p=0.5, training=True)
F.dropout1d(input, p=0.5, training=True)
F.dropout2d(input, p=0.5, training=True)
F.dropout3d(input, p=0.5, training=True)
F.alpha_dropout(input, p=0.5, training=True)

# الحشو
F.pad(input, pad, mode='constant', value=0)
# mode: 'constant', 'reflect', 'replicate', 'circular'

# الانتباه
F.scaled_dot_product_attention(query, key, value)

# التضمين
F.embedding(input, weight)
F.embedding_bag(input, weight)

# التحويلات
F.one_hot(tensor, num_classes)
F.linear(input, weight, bias=None)
F.bilinear(input1, input2, weight, bias=None)

# الرؤية
F.pixel_shuffle(input, upscale_factor)
F.pixel_unshuffle(input, downscale_factor)
F.interpolate(input, size=None, scale_factor=None, mode='nearest')
F.grid_sample(input, grid)
F.affine_grid(theta, size)
F.upsample(input, size=None, scale_factor=None, mode='nearest')
```

---

## 7. وحدة `torch.optim` - خوارزميات التحسين

### 7.1 خوارزميات التحسين المتاحة

| المُحسِّن | الوصف |
|-----------|-------|
| `optim.SGD` | Stochastic Gradient Descent |
| `optim.ASGD` | Averaged SGD |
| `optim.Adam` | Adam (Adaptive Moment Estimation) |
| `optim.AdamW` | Adam with decoupled Weight Decay |
| `optim.NAdam` | Nesterov-accelerated Adam |
| `optim.RAdam` | Rectified Adam |
| `optim.Adadelta` | Adadelta |
| `optim.Adagrad` | Adaptive Gradient |
| `optim.Adamax` | Adamax (infinity norm) |
| `optim.RMSprop` | RMSprop |
| `optim.Rprop` | Resilient Backpropagation |
| `optim.LBFGS` | Limited-memory BFGS |
| `optim.SparseAdam` | Adam للموثرات المتفرقة |

### 7.2 طريقة الاستخدام

```python
import torch.optim as optim

# إنشاء المحسن
optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
optimizer = optim.Adam(model.parameters(), lr=0.001, betas=(0.9, 0.999))
optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)

# معدلات تعلم مختلفة لكل طبقة
optimizer = optim.SGD([
    {'params': model.base.parameters(), 'lr': 1e-2},
    {'params': model.classifier.parameters()}
], lr=1e-3, momentum=0.9)

# حلقة التدريب
for epoch in range(epochs):
    for batch in dataloader:
        optimizer.zero_grad()           # تصفير التدرجات
        loss = model(batch)             # الحساب الأمامي
        loss.backward()                 # الحساب الخلفي
        optimizer.step()                # تحديث المعاملات

# جدولة معدل التعلم
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=30, gamma=0.1)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min')
scheduler.step()  # أو scheduler.step(val_loss) لـ ReduceLROnPlateau
```

### 7.3 جدولة معدل التعلم (LR Schedulers)

| المجدول | الوصف |
|---------|-------|
| `lr_scheduler.LambdaLR` | دالة lambda مخصصة |
| `lr_scheduler.MultiplicativeLR` | ضرب المعدل بعامل |
| `lr_scheduler.StepLR` | إنقاص كل step_size حقبة |
| `lr_scheduler.MultiStepLR` | إنقاص عند حقب محددة |
| `lr_scheduler.ConstantLR` | معدل ثابت لفترة |
| `lr_scheduler.LinearLR` | تغيير خطي |
| `lr_scheduler.ExponentialLR` | إنقاص أسي |
| `lr_scheduler.PolynomialLR` | إنقاص متعدد الحدود |
| `lr_scheduler.CosineAnnealingLR` | Cosine Annealing |
| `lr_scheduler.CosineAnnealingWarmRestarts` | إعادة تشغيل دافئة |
| `lr_scheduler.CyclicLR` | معدل تعلم دوري |
| `lr_scheduler.OneCycleLR` | 1cycle policy |
| `lr_scheduler.ReduceLROnPlateau` | تقليل عند استقرار الأداء |
| `lr_scheduler.ChainedScheduler` | تسلسل المجدولات |
| `lr_scheduler.SequentialLR` | مجدولات متتابعة |

---

## 8. وحدة `torch.autograd` - التفاضل التلقائي

### 8.1 الأساسيات

```python
# تتبع العمليات للتدرجات
x = torch.tensor([1., 2., 3.], requires_grad=True)
y = x ** 2
z = y.sum()
z.backward()           # حساب التدرجات
print(x.grad)          # dz/dx = [2., 4., 6.]

# تعطيل تتبع التدرج
with torch.no_grad():
    # العمليات هنا لا تُسجل للتدرج
    y = model(x)

# استخدام torch.inference_mode() (أسرع)
with torch.inference_mode():
    y = model(x)

# فصل موتر عن الرسم البياني
y = x.detach()  # نسخة بدون تدرج
```

### 8.2 دوال متقدمة

```python
# دوال autograd
torch.autograd.grad(outputs, inputs)          # حساب التدرج مباشرة
torch.autograd.backward(tensors, grad_tensors)# خلفي مخصص

# فحص التدرج
torch.autograd.gradcheck(func, inputs)         # فحص عددي للتدرج
torch.autograd.gradgradcheck(func, inputs)     # فحص تدرج التدرج

# دوال مخصصة
class MyReLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, input):
        ctx.save_for_backward(input)
        return input.clamp(min=0)

    @staticmethod
    def backward(ctx, grad_output):
        input, = ctx.saved_tensors
        grad_input = grad_output.clone()
        grad_input[input < 0] = 0
        return grad_input
```

---

## 9. وحدة `torch.cuda` - معالجة GPU

```python
# التحقق من التوفر
torch.cuda.is_available()
torch.cuda.device_count()
torch.cuda.get_device_name(0)
torch.cuda.current_device()

# إدارة الأجهزة
torch.cuda.set_device(0)
with torch.cuda.device(1):
    # العمليات هنا على GPU 1
    pass

# نقل البيانات
tensor = tensor.cuda()           # نقل إلى GPU الافتراضي
tensor = tensor.to('cuda:0')     # نقل إلى GPU محدد
model = model.to('cuda')

# إدارة الذاكرة
torch.cuda.empty_cache()         # تفريغ الذاكرة المؤقتة المخبأة
torch.cuda.memory_allocated()    # الذاكرة المستخدمة حالياً
torch.cuda.memory_reserved()     # الذاكرة المحجوزة
torch.cuda.max_memory_allocated()
torch.cuda.reset_peak_memory_stats()

# المزامنة
torch.cuda.synchronize()         # انتظار انتهاء كل العمليات

# البذور العشوائية
torch.cuda.manual_seed(42)
torch.cuda.manual_seed_all(42)
```

### AMP (الدقة المختلطة التلقائية)

```python
# استخدام Automatic Mixed Precision
scaler = torch.cuda.amp.GradScaler()

for batch in dataloader:
    optimizer.zero_grad()
    with torch.cuda.amp.autocast():
        output = model(batch)
        loss = criterion(output, target)

    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

---

## 10. وحدة `torch.amp` - الدقة المختلطة التلقائية

```python
import torch.amp

# التدريب بالدقة المختلطة
scaler = torch.amp.GradScaler('cuda')

for batch in dataloader:
    optimizer.zero_grad()
    with torch.amp.autocast('cuda'):
        output = model(batch)
        loss = criterion(output, target)

    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()

# أنواع البيانات المدعومة: float16, bfloat16
with torch.amp.autocast('cuda', dtype=torch.bfloat16):
    output = model(batch)
```

---

## 11. وحدة `torch.distributed` - المعالجة الموزعة

### 11.1 Distributed Data Parallel (DDP)

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# التهيئة
dist.init_process_group('nccl', init_method='env://')
local_rank = int(os.environ['LOCAL_RANK'])
torch.cuda.set_device(local_rank)

# تغليف النموذج
model = model.to(local_rank)
model = DDP(model, device_ids=[local_rank])

# التدريب
for batch in dataloader:
    output = model(batch)
    loss = criterion(output, target)
    loss.backward()
    optimizer.step()
```

### 11.2 FSDP - Fully Sharded Data Parallel

```python
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy
)

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,
    mixed_precision=MixedPrecision(
        param_dtype=torch.float16,
        reduce_dtype=torch.float16,
        buffer_dtype=torch.float16
    )
)
```

### 11.3 عمليات الاتصال

```python
dist.all_reduce(tensor, op=dist.ReduceOp.SUM)
dist.all_gather(tensor_list, tensor)
dist.broadcast(tensor, src=0)
dist.reduce(tensor, dst=0, op=dist.ReduceOp.SUM)
dist.scatter(tensor, scatter_list, src=0)
dist.barrier()                     # مزامنة
dist.send(tensor, dst=1)           # إرسال
dist.recv(tensor, src=0)           # استقبال
dist.isend(tensor, dst=1)          # إرسال غير متزامن
dist.irecv(tensor, src=0)          # استقبال غير متزامن
```

### 11.4 Elastic Training

```python
from torch.distributed.elastic.multiprocessing.errors import record

@record
def main():
    dist.init_process_group('nccl')
    # ... training code

# تشغيل: torchrun --nproc_per_node=4 train.py
```

---

## 12. وحدة `torch.linalg` - الجبر الخطي

```python
# تحليل المصفوفات
torch.linalg.det(A)                  # المحدد
torch.linalg.norm(A)                 # المعيار
torch.linalg.matrix_norm(A)          # معيار مصفوفة
torch.linalg.vector_norm(v)          # معيار متجه
torch.linalg.cond(A)                 # رقم الشرط
torch.linalg.matrix_rank(A)          # رتبة المصفوفة
torch.linalg.trace(A)                # الأثر

# حل المعادلات والانعكاس
torch.linalg.solve(A, B)             # حل Ax = B
torch.linalg.inv(A)                  # معكوس المصفوفة
torch.linalg.pinv(A)                 # معكوس مور-بينروز
torch.linalg.lstsq(A, B)            # المربعات الصغرى

# تحليل القيم الذاتية والمفردة
torch.linalg.eig(A)                  # القيم والمتجهات الذاتية
torch.linalg.eigvals(A)              # القيم الذاتية فقط
torch.linalg.eigh(A)                 # للمصفوفات المتماثلة
torch.linalg.eigvalsh(A)             # قيم ذاتية لمتماثلة
torch.linalg.svd(A)                  # تحليل القيمة المفردة
torch.linalg.svdvals(A)              # قيم مفردة فقط

# التحليلات
torch.linalg.cholesky(A)             # تحليل تشوليسكي
torch.linalg.qr(A)                   # تحليل QR
torch.linalg.lu(A)                   # تحليل LU
torch.linalg.lu_factor(A)            # عوامل LU
torch.linalg.lu_solve(LU, pivots, B) # حل باستخدام LU

# ضرب المصفوفات والمتجهات
torch.linalg.matmul(A, B)            # ضرب مصفوفات
torch.linalg.multi_dot(tensors)      # ضرب متعدد
torch.linalg.matrix_power(A, n)      # قوة المصفوفة
torch.linalg.cross(a, b)             # ضرب اتجاهي
torch.linalg.outer(a, b)             # ضرب خارجي
torch.linalg.vecdot(a, b)            # ضرب نقطي على بعد
```

---

## 13. وحدة `torch.fft` - تحويل فورييه

```python
# تحويل فورييه أحادي البعد
torch.fft.fft(input)                 # FFT أمامي
torch.fft.ifft(input)                # FFT عكسي
torch.fft.rfft(input)                # FFT للإشارات الحقيقية
torch.fft.irfft(input)               # IFFT للإشارات الحقيقية

# تحويل فورييه ثنائي البعد
torch.fft.fft2(input)
torch.fft.ifft2(input)
torch.fft.rfft2(input)
torch.fft.irfft2(input)

# تحويل فورييه n-الأبعاد
torch.fft.fftn(input)
torch.fft.ifftn(input)
torch.fft.rfftn(input)
torch.fft.irfftn(input)

# إزاحة الترددات
torch.fft.fftshift(input)
torch.fft.ifftshift(input)

# ترددات العينة
torch.fft.fftfreq(n, d=1.0)         # ترددات FFT
torch.fft.rfftfreq(n, d=1.0)        # ترددات RFFT
```

---

## 14. وحدة `torch.random` - العينات العشوائية

```python
# ضبط البذرة العشوائية
torch.manual_seed(42)
torch.initial_seed()

# توزيعات العينات العشوائية
torch.rand(*size)                    # توزيع منتظم [0, 1)
torch.randn(*size)                   # توزيع طبيعي (μ=0, σ=1)
torch.randint(low, high, size)       # أعداد صحيحة عشوائية
torch.randperm(n)                    # تبديل عشوائي
torch.bernoulli(input)               # توزيع برنولي

# دوال إضافية
torch.normal(mean, std, size)        # توزيع طبيعي مخصص
torch.poisson(input)                 # توزيع بواسون
torch.multinomial(input, num_samples)# عينات متعددة الحدود
```

---

## 15. وحدة `torch.sparse` - المصفوفات المتفرقة

```python
# تنسيق COO
indices = torch.tensor([[0, 1, 1], [2, 0, 2]])
values = torch.tensor([3, 4, 5], dtype=torch.float32)
sparse_tensor = torch.sparse_coo_tensor(indices, values, (2, 3))

# تنسيق CSR
crow_indices = torch.tensor([0, 2, 4])
col_indices = torch.tensor([0, 1, 0, 1])
values = torch.tensor([1, 2, 3, 4])
csr = torch.sparse_csr_tensor(crow_indices, col_indices, values)

# تحويلات
dense = sparse_tensor.to_dense()
sparse = dense.to_sparse()           # إلى COO
sparse_csr = dense.to_sparse_csr()
```

---

## 16. وحدة `torch.utils.data` - تحميل البيانات

```python
from torch.utils.data import Dataset, DataLoader

# إنشاء Dataset مخصص
class MyDataset(Dataset):
    def __init__(self, data, labels):
        self.data = data
        self.labels = labels

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.data[idx], self.labels[idx]

# DataLoader
dataloader = DataLoader(
    dataset,
    batch_size=32,
    shuffle=True,
    num_workers=4,
    pin_memory=True,         # تسريع النقل إلى GPU
    drop_last=True,          # إسقاط الدفعة الأخيرة غير المكتملة
    collate_fn=None,         # دالة تجميع مخصصة
    persistent_workers=True  # إبقاء العمال
)

# مجموعات بيانات جاهزة (في torchvision)
from torchvision import datasets, transforms
dataset = datasets.MNIST('data/', train=True, download=True,
                         transform=transforms.ToTensor())
```

### Samplers

```python
from torch.utils.data import Sampler, SequentialSampler, RandomSampler
from torch.utils.data import WeightedRandomSampler, SubsetRandomSampler
from torch.utils.data import BatchSampler, DistributedSampler

# DistributedSampler للتدريب الموزع
sampler = DistributedSampler(dataset, shuffle=True)
dataloader = DataLoader(dataset, sampler=sampler)
sampler.set_epoch(epoch)    # استدعاء في كل حقبة
```

---

## 17. وحدة `torch.hub` - النماذج المحفوظة مسبقاً

```python
# تحميل نموذج من GitHub
model = torch.hub.load('pytorch/vision', 'resnet18', pretrained=True)
model = torch.hub.load('pytorch/vision', 'resnet50', weights='ResNet50_Weights.DEFAULT')

# استكشاف النماذج المتاحة
torch.hub.list('pytorch/vision')

# مساعدة
torch.hub.help('pytorch/vision', 'resnet18')

# مسار التحميل
torch.hub.get_dir()                    # ~/.cache/torch/hub/
torch.hub.set_dir('/custom/path')
```

---

## 18. وحدة `torch.onnx` - تصدير النماذج

```python
# تصدير نموذج إلى ONNX
torch.onnx.export(
    model,                     # النموذج
    dummy_input,               # إدخال تجريبي
    'model.onnx',              # مسار الحفظ
    export_params=True,        # تصدير الأوزان
    opset_version=17,          # إصدار opset
    input_names=['input'],     # أسماء المدخلات
    output_names=['output'],   # أسماء المخرجات
    dynamic_axes={             # أبعاد ديناميكية
        'input': {0: 'batch_size'},
        'output': {0: 'batch_size'}
    }
)

# التحقق من صحة نموذج ONNX
import onnx
onnx_model = onnx.load('model.onnx')
onnx.checker.check_model(onnx_model)
```

---

## 19. وحدة `torch.profiler` - تحليل الأداء

```python
from torch.profiler import profile, record_function, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./log')
) as prof:
    with record_function("model_inference"):
        model(input)

# عرض النتائج
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=10))

# تشغيل TensorBoard لعرض النتائج
# tensorboard --logdir=./log
```

---

## 20. وحدة `torch.export` - تصدير النماذج

```python
# تصدير النموذج إلى رسم بياني
exported_model = torch.export.export(
    model,
    args=(example_input,),
    kwargs={'key': example_kwarg}
)

# حفظ وتحميل
torch.export.save(exported_model, 'exported_model.pt2')
loaded_model = torch.export.load('exported_model.pt2')

# التشغيل
output = exported_model.module()(input_data)
```

---

## 21. وحدة `torch.compiler` - تسريع التحويل البرمجي

```python
# torch.compile - أسهل طريقة لتسريع النموذج
model = torch.compile(model)
# أو
model = torch.compile(model, mode='reduce-overhead')
# modes: 'default', 'reduce-overhead', 'max-autotune'

@torch.compile
def train_step(model, batch):
    output = model(batch)
    loss = loss_fn(output)
    loss.backward()
    return loss

# خيارات متقدمة
model = torch.compile(
    model,
    backend='inductor',       # المحرك الخلفي
    fullgraph=True,           # رسم بياني كامل
    dynamic=False,            # أشكال ديناميكية
    options={'epilogue_fusion': True}
)
```

---

## 22. وحدة `torch.distributions` - التوزيعات الاحتمالية

```python
from torch.distributions import (
    Normal, Bernoulli, Categorical, Multinomial,
    Uniform, Beta, Gamma, Dirichlet,
    MultivariateNormal, OneHotCategorical
)

# إنشاء توزيع
normal = Normal(loc=0.0, scale=1.0)
bernoulli = Bernoulli(probs=0.7)
categorical = Categorical(logits=torch.randn(5))

# عينات واحتمالات
samples = normal.sample((100,))         # عينات
log_prob = normal.log_prob(samples)     # لوغاريتم الاحتمال
entropy = normal.entropy()              # الإنتروبيا

# KL Divergence
kl = torch.distributions.kl_divergence(p, q)

# Transforms
from torch.distributions import transforms
transform = transforms.SigmoidTransform()
```

---

## 23. وحدات إضافية

### `torch.library` - تسجيل العمليات المخصصة

```python
@torch.library.custom_op("mylib::my_op", mutates_args=())
def my_op(x: torch.Tensor) -> torch.Tensor:
    return x * 2

@my_op.register_fake
def _(x):
    return torch.empty_like(x)
```

### `torch.testing` - اختبار الدوال

```python
torch.testing.assert_close(actual, expected)
torch.testing.assert_allclose(actual, expected)
```

### `torch.special` - دوال رياضية خاصة

```python
torch.special.erf(x)           # دالة الخطأ
torch.special.erfc(x)          # دالة الخطأ التكميلية
torch.special.erfinv(x)        # معكوس دالة الخطأ
torch.special.gammaln(x)       # لوغاريتم غاما
torch.special.digamma(x)       # دالة ديغاما
torch.special.entr(x)          # الإنتروبيا العنصرية
torch.special.i0e(x)           # دالة بيسل المعدلة
torch.special.log_softmax(x, dim)
torch.special.ndtr(x)          # دالة التوزيع التراكمي الطبيعي
torch.special.ndtri(x)         # معكوس دالة التوزيع التراكمي الطبيعي
```

### `torch.backends` - إعدادات المحركات الخلفية

```python
torch.backends.cudnn.benchmark = True
torch.backends.cudnn.deterministic = False
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True
torch.backends.mps.is_available()
```

### `torch.utils.checkpoint` - Checkpointing للتدرج

```python
from torch.utils.checkpoint import checkpoint

# توفير الذاكرة بإعادة حساب التنشيطات
output = checkpoint(module, input)
```

### `torch.utils.tensorboard` - تكامل TensorBoard

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter('runs/experiment')
writer.add_scalar('Loss/train', loss, epoch)
writer.add_scalar('Accuracy/train', acc, epoch)
writer.add_graph(model, input)
writer.add_histogram('conv1/weights', model.conv1.weight, epoch)
writer.close()

# للتشغيل: tensorboard --logdir=runs
```

---

## 24. متغيرات البيئة

| المتغير | الوصف |
|---------|-------|
| `TORCH_HOME` | مسار التخزين المؤقت لـ torch hub |
| `CUDA_VISIBLE_DEVICES` | تحديد أجهزة GPU المرئية |
| `TORCH_CUDA_ARCH_LIST` | قائمة معماريات CUDA |
| `PYTORCH_CUDA_ALLOC_CONF` | تكوين تخصيص ذاكرة CUDA |
| `TORCH_COMPILE_DEBUG` | تفعيل تصحيح torch.compile |
| `TORCH_LOGS` | تفعيل سجلات torch.compile |
| `TORCHINDUCTOR_CACHE_DIR` | مسار ذاكرة التخزين المؤقت لـ Inductor |
| `TORCH_DISTRIBUTED_DEBUG` | تفعيل تصحيح التوزيع |
| `OMP_NUM_THREADS` | عدد خيوط OpenMP |
| `MKL_NUM_THREADS` | عدد خيوط MKL |

---

## 25. مراجع سريعة

### تهيئة النموذج وتدريبه - مثال كامل

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

# 1. إعداد الجهاز
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 2. تعريف النموذج
class NeuralNet(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

# 3. إنشاء النموذج
model = NeuralNet(784, 128, 10).to(device)

# 4. دالة الخسارة والمحسن
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# 5. تحميل البيانات
dataset = TensorDataset(X, y)
dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

# 6. حلقة التدريب
num_epochs = 10
for epoch in range(num_epochs):
    model.train()
    for batch_idx, (data, targets) in enumerate(dataloader):
        data, targets = data.to(device), targets.to(device)

        # forward
        outputs = model(data)
        loss = criterion(outputs, targets)

        # backward
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    print(f'Epoch [{epoch+1}/{num_epochs}], Loss: {loss.item():.4f}')

# 7. التقييم
model.eval()
with torch.no_grad():
    correct = 0
    total = 0
    for data, targets in dataloader:
        data, targets = data.to(device), targets.to(device)
        outputs = model(data)
        _, predicted = torch.max(outputs.data, 1)
        total += targets.size(0)
        correct += (predicted == targets).sum().item()
    print(f'Accuracy: {100 * correct / total:.2f}%')

# 8. حفظ النموذج
torch.save(model.state_dict(), 'model.pth')
```

### أوامر سطر الأوامر المفيدة

```bash
# عرض معلومات النظام
python -c "import torch; print(torch.__version__)"
python -c "import torch; print(torch.cuda.is_available())"
python -c "import torch; print(torch.cuda.device_count())"

# تجميع البيئة (لإرسال تقارير الأخطاء)
python -m torch.utils.collect_env

# تشغيل موزع
torchrun --nproc_per_node=4 train.py
torchrun --nnodes=2 --nproc_per_node=4 --rdzv_id=123 --rdzv_backend=c10d train.py
```

### مكتبات PyTorch الإضافية

| المكتبة | الوصف | الرابط |
|---------|-------|--------|
| **torchvision** | رؤية الحاسوب | pytorch.org/vision |
| **torchaudio** | معالجة الصوت | pytorch.org/audio |
| **torchtext** | معالجة النصوص | pytorch.org/text |
| **TorchRL** | التعلم المعزز | pytorch.org/rl |
| **torchao** | Quantization وتحسين النماذج | pytorch.org/ao |
| **torchtitan** | تدريب النماذج الكبيرة | github.com/pytorch/torchtitan |
| **ExecuTorch** | النشر على الأجهزة المحمولة | pytorch.org/executorch |
| **PyTorch/XLA** | دعم TPU | pytorch.org/xla |

---

## 📚 روابط هامة

- **التوثيق الرسمي:** [pytorch.org/docs/stable](https://pytorch.org/docs/stable/)
- **منتدى PyTorch:** [discuss.pytorch.org](https://discuss.pytorch.org/)
- **GitHub:** [github.com/pytorch/pytorch](https://github.com/pytorch/pytorch)
- **دروس تعليمية:** [pytorch.org/tutorials](https://pytorch.org/tutorials/)
- **دليل المساهمة:** [github.com/pytorch/pytorch/wiki](https://github.com/pytorch/pytorch/wiki)

---

> 💡 **نصيحة:** هذا المرجع يغطي الإصدار 2.13.0 المستقر من PyTorch. بعض الميزات قد تختلف في الإصدارات الأقدم أو الأحدث. للتأكد دائماً من تحديث المعلومات، راجع [التوثيق الرسمي](https://pytorch.org/docs/stable/).
