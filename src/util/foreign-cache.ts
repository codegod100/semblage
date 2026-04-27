import type { CardWithMeta, ConnectionEdge } from "../types";

const DB_NAME = "semblage-foreign-cache";
const DB_VERSION = 1;
const STORE_NAME = "foreign-data";

export interface ForeignCacheEntry {
	did: string;
	cards: CardWithMeta[];
	connections: ConnectionEdge[];
	fetchedAt: number;
}

export class ForeignCache {
	private db: IDBDatabase | null = null;

	async open(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: "did" });
				}
			};

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result;
				resolve();
			};

			request.onerror = () => reject(request.error);
		});
	}

	async get(did: string): Promise<ForeignCacheEntry | null> {
		if (!this.db) throw new Error("Database not open");
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(STORE_NAME, "readonly");
			const request = tx.objectStore(STORE_NAME).get(did);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
	}

	async put(did: string, cards: CardWithMeta[], connections: ConnectionEdge[]): Promise<void> {
		if (!this.db) throw new Error("Database not open");
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).put({
				did,
				cards,
				connections,
				fetchedAt: Date.now(),
			});
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async getAll(): Promise<Map<string, ForeignCacheEntry>> {
		if (!this.db) throw new Error("Database not open");
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(STORE_NAME, "readonly");
			const request = tx.objectStore(STORE_NAME).getAll();
			request.onsuccess = () => {
				const map = new Map<string, ForeignCacheEntry>();
				for (const entry of request.result as ForeignCacheEntry[]) {
					map.set(entry.did, entry);
				}
				resolve(map);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async delete(did: string): Promise<void> {
		if (!this.db) throw new Error("Database not open");
		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).delete(did);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}
}
