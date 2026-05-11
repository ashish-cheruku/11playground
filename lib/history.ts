"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { HistoryEntry } from "./types";

const DB_NAME = "elevenlabs-playground";
const STORE = "history";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("history requires browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("createdAt", "createdAt");
          s.createIndex("kind", "kind");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE, entry);
}

export async function listHistory(limit = 200): Promise<HistoryEntry[]> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readonly");
  const idx = tx.store.index("createdAt");
  const items: HistoryEntry[] = [];
  let cursor = await idx.openCursor(null, "prev");
  while (cursor && items.length < limit) {
    items.push(cursor.value as HistoryEntry);
    cursor = await cursor.continue();
  }
  return items;
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

export async function getHistory(id: string): Promise<HistoryEntry | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
