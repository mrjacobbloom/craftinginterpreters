// No longer used, in the last chapter (30: optimization) I ended up switching to a native JS Map
// zoo.benchmark.lox runtimes:
// - Original: 50.843 secs
// - After replacing modulo w/ bit-mask: 46.137 secs
// - After switching to native Maps: 34.981 secs

import { boolValue, nilValue } from './value';

export class Table {
  private count = 0;
  private capacity = 0;
  private entries: Entry[] = Array(0);

  private static MAX_LOAD = 0.75;

  public set(key: string, value: Value): boolean {
    if (this.count + 1 > this.capacity * Table.MAX_LOAD) {
      const capacity = this.capacity < 8 ? 8 : this.capacity * 2;
      this.adjustCapacity(capacity);
    }
  
    const entry = this.findEntry(key);
    const isNewKey = entry.key === null;
    if (isNewKey && entry.value === nilValue) this.count++;

    entry.key = key;
    entry.value = value;
    return isNewKey;
  }

  public get(key: string): Value | null {
    if (this.count === 0) return null;

    const entry = this.findEntry(key);
    if (entry.key === null) return null;
    return entry.value;
  }

  public delete(key: string): boolean {
    if (this.count === 0) return false;
  
    // Find the entry.
    const entry = this.findEntry(key);
    if (entry.key === null) return false;
  
    // Place a tombstone in the entry.
    entry.key = null;
    entry.value = boolValue(true);
    return true;
  }

  public static addAll(from: Table, to: Table): void {
    for (let i = 0; i < from.capacity; i++) {
      const entry = from.entries[i];
      if (entry.key !== null) {
        to.set(entry.key, entry.value);
      }
    }
  }

  private findEntry(key: string, entries = this.entries, capacity = this.capacity): Entry {
    let index = this.hashString(key) % capacity;
    let tombstone: Entry | null = null;
    while (true) {
      const entry = entries[index];
      if (entry.key === null) {
        if (entry.value === nilValue) {
          // Empty entry.
          return tombstone !== null ? tombstone : entry;
        } else {
          // We found a tombstone.
          if (tombstone === null) tombstone = entry;
        }
      } else if (entry.key === key) {
        // We found the key.
        return entry;
      }

      index = (index + 1) & (capacity - 1);
    }
  }

  private hashString(key: string): number {
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash *= 16777619;
    }
    return Math.abs(hash);
  }

  private adjustCapacity(capacity: number): void {
    const entries: Entry[] = Array(capacity);
    for (let i = 0; i < capacity; i++) {
      entries[i] = {
        key: null,
        value: nilValue,
      };
    }

    this.count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const entry = this.entries[i];
      if (entry.key === null) continue;
  
      const dest = this.findEntry(entry.key, entries, capacity);
      dest.key = entry.key;
      dest.value = entry.value;
      this.count++;
    }
  
    this.entries = entries;
    this.capacity = capacity;
  }
}