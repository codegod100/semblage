// Simple handle cache stored in plugin data.json under `handleCache` key
export type HandleCache = Record<string, string>;

export function extractDidFromAtUri(aturi: string): string {
	const match = aturi.match(/^at:\/\/([^/]+)/);
	return match?.[1] || "";
}

export function extractRkeyFromAtUri(aturi: string): string {
	return aturi.split("/").pop() || "";
}

export function extractCollectionFromAtUri(aturi: string): string {
	const parts = aturi.replace(/^at:\/\//, "").split("/");
	return parts[1] || "";
}
