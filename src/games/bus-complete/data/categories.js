// التصنيفات الافتراضية (أسماء فقط — آمنة للعميل). الأدمن يقدر يضيف ويعدّل ويحذف.
// الـid الثابت للتصنيفات الأصلية بيربطها بقاموس التحقق على الخادم. التصنيفات المضافة يدويًا ليها id جديد
// وبتتصحح بمساعدة الأدمن (وبتتعلّم من اعتماداته خلال الجولة).

export const DEFAULT_CATEGORIES = [
  { id: 'boy', name: 'ولد', enabled: true, builtin: true },
  { id: 'girl', name: 'بنت', enabled: true, builtin: true },
  { id: 'animal', name: 'حيوان', enabled: true, builtin: true },
  { id: 'plant', name: 'نبات', enabled: true, builtin: true },
  { id: 'object', name: 'جماد', enabled: true, builtin: true },
  { id: 'country', name: 'بلاد', enabled: true, builtin: true },
  { id: 'food', name: 'أكلة', enabled: true, builtin: true },
  { id: 'job', name: 'مهنة', enabled: true, builtin: true },
];

export const MAX_CATEGORIES = 30;
export const MAX_CATEGORY_NAME = 24;
