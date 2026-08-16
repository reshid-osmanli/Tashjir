// بديل مبسط لـ localStorage
//
// بيئة الاختبار node بلا DOM، والمخازن كلها تكتب في window.localStorage.
// هذا البديل يكفي لعقد الواجهة المستعمل في المشروع، ويُشارك بين الاختبارات
// حتى لا يُعاد تعريفه في كل ملف.

export class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}
