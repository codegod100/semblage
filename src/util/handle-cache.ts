import { extractDidFromAtUri } from "./aturi";

const CACHE_KEY = "handleCache";

export type HandleCache = Record<string, string>;

export async function loadHandleCache(context: { loadData(): Promise<any> }): Promise<HandleCache> {
	try {
		const data = await context.loadData();
		return (data?.[CACHE_KEY] as HandleCache) || {};
	} catch {
		return {};
	}
}

export async function saveHandleCache(context: { loadData(): Promise<any>; saveData(data: any): Promise<void> }, cache: HandleCache): Promise<void> {
	try {
		const data = (await context.loadData()) || {};
		data[CACHE_KEY] = cache;
		await context.saveData(data);
	} catch (e) {
		console.error("Failed to save handle cache:", e);
	}
}

export function getCachedHandle(cache: HandleCache, did: string): string | undefined {
	return cache[did];
}

export function setCachedHandle(cache: HandleCache, did: string, handle: string): HandleCache {
	return { ...cache, [did]: handle };
}

export function extractDid(aturi: string): string {
	return extractDidFromAtUri(aturi);
}
