"use client";
import type { MediaItem } from "../_lib/schema";

type Listener = (items: MediaItem[]) => void;

const KEY = "mulligan:favorites";
function readLS(): MediaItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeLS(items: MediaItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

class Store {
  private items: MediaItem[] = readLS();
  private listeners = new Set<Listener>();

  read() { return this.items; }
  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const fn of this.listeners) fn(this.items); }

  add(item: MediaItem) {
    if (this.items.find(i => i.id === item.id)) return;
    this.items = [item, ...this.items];
    writeLS(this.items); this.emit();
  }
  remove(id: string) {
    this.items = this.items.filter(i => i.id !== id);
    writeLS(this.items); this.emit();
  }
}

export const FavoritesStore = new Store();
