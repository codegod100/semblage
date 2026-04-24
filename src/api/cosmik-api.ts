import type { Client } from "@atcute/client";
import type {
	CosmikCardRecord,
	CosmikConnectionRecord,
	CosmikCollectionRecord,
	CosmikCollectionLinkRecord,
	CardWithMeta,
	ConnectionEdge,
	CardConnections,
} from "../types";
import { getSemanticType, getCardTitle, getCardSubtitle, getCardUrl } from "../types";

const CARD_COLLECTION = "network.cosmik.card";
const CONNECTION_COLLECTION = "network.cosmik.connection";
const COLLECTION_COLLECTION = "network.cosmik.collection";
const COLLECTION_LINK_COLLECTION = "network.cosmik.collectionLink";

function generateRkey(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseRkey(uri: string): string {
	return uri.split("/").pop() || "";
}

async function fetchAllRecords(
	client: Client,
	did: string,
	collection: string,
): Promise<any[]> {
	const all: any[] = [];
	let cursor: string | undefined;
	while (true) {
		const resp = await (client as any).get("com.atproto.repo.listRecords", {
			params: { repo: did, collection, limit: 100, cursor },
		});
		if (!resp.ok) {
			throw new Error(`Failed to list ${collection}: ${resp.status}`);
		}
		const records = resp.data.records as any[];
		all.push(...records);
		cursor = resp.data.cursor;
		if (!cursor || records.length === 0) break;
	}
	return all;
}

export async function listCards(client: Client, did: string): Promise<CardWithMeta[]> {
	const records = await fetchAllRecords(client, did, CARD_COLLECTION);
	return records.map((r: any) => {
		const record = r.value as CosmikCardRecord;
		return {
			uri: r.uri,
			cid: r.cid,
			rkey: parseRkey(r.uri),
			record,
			title: getCardTitle(record),
			semanticType: getSemanticType(record),
			subtitle: getCardSubtitle(record),
			url: getCardUrl(record),
		};
	});
}

export async function createCard(
	client: Client,
	did: string,
	record: CosmikCardRecord,
): Promise<{ uri: string; cid: string; rkey: string }> {
	const rkey = generateRkey();
	if (!record.createdAt) {
		record.createdAt = new Date().toISOString();
	}
	const resp = await (client as any).post("com.atproto.repo.putRecord", {
		input: {
			repo: did,
			collection: CARD_COLLECTION,
			rkey,
			record,
			validate: false,
		},
	});
	if (!resp.ok) {
		throw new Error(`Failed to create card: ${resp.status} ${resp.data?.message || ""}`);
	}
	return { uri: resp.data.uri, cid: resp.data.cid, rkey };
}

export async function deleteCard(
	client: Client,
	did: string,
	rkey: string,
): Promise<void> {
	const resp = await (client as any).post("com.atproto.repo.deleteRecord", {
		input: { repo: did, collection: CARD_COLLECTION, rkey },
	});
	if (!resp.ok) {
		throw new Error(`Failed to delete card: ${resp.status}`);
	}
}

export async function listConnections(client: Client, did: string): Promise<ConnectionEdge[]> {
	const records = await fetchAllRecords(client, did, CONNECTION_COLLECTION);
	return records.map((r: any) => ({
		record: r.value as CosmikConnectionRecord,
		uri: r.uri,
		cid: r.cid,
	}));
}

export async function createConnection(
	client: Client,
	did: string,
	record: CosmikConnectionRecord,
): Promise<{ uri: string; cid: string; rkey: string }> {
	const rkey = generateRkey();
	if (!record.createdAt) {
		record.createdAt = new Date().toISOString();
	}
	if (!record.updatedAt) {
		record.updatedAt = new Date().toISOString();
	}
	const resp = await (client as any).post("com.atproto.repo.putRecord", {
		input: {
			repo: did,
			collection: CONNECTION_COLLECTION,
			rkey,
			record,
			validate: false,
		},
	});
	if (!resp.ok) {
		throw new Error(`Failed to create connection: ${resp.status} ${resp.data?.message || ""}`);
	}
	return { uri: resp.data.uri, cid: resp.data.cid, rkey };
}

export async function listCollections(client: Client, did: string): Promise<CosmikCollectionRecord[]> {
	const resp = await (client as any).get("com.atproto.repo.listRecords", {
		params: { repo: did, collection: COLLECTION_COLLECTION, limit: 100 },
	});
	if (!resp.ok) {
		throw new Error(`Failed to list collections: ${resp.status}`);
	}
	return (resp.data.records as any[]).map((r: any) => r.value as CosmikCollectionRecord);
}

export async function listCollectionLinks(client: Client, did: string): Promise<CosmikCollectionLinkRecord[]> {
	const resp = await (client as any).get("com.atproto.repo.listRecords", {
		params: { repo: did, collection: COLLECTION_LINK_COLLECTION, limit: 100 },
	});
	if (!resp.ok) {
		throw new Error(`Failed to list collection links: ${resp.status}`);
	}
	return (resp.data.records as any[]).map((r: any) => r.value as CosmikCollectionLinkRecord);
}

const FOLLOW_COLLECTION = "network.cosmik.follow";

export async function listFollows(client: Client, did: string): Promise<string[]> {
	const records = await fetchAllRecords(client, did, FOLLOW_COLLECTION);
	return records.map((r: any) => (r.value as any).subject as string).filter(Boolean);
}

export async function fetchForeignCards(
	client: Client,
	did: string,
): Promise<{ cards: CardWithMeta[]; connections: ConnectionEdge[] }> {
	const records = await fetchAllRecords(client, did, CARD_COLLECTION);
	const cards = records.map((r: any) => {
		const record = r.value as CosmikCardRecord;
		return {
			uri: r.uri,
			cid: r.cid,
			rkey: parseRkey(r.uri),
			record,
			title: getCardTitle(record),
			semanticType: getSemanticType(record),
			subtitle: getCardSubtitle(record),
			url: getCardUrl(record),
		};
	});

	const connRecords = await fetchAllRecords(client, did, CONNECTION_COLLECTION);
	const connections = connRecords.map((r: any) => ({
		record: r.value as CosmikConnectionRecord,
		uri: r.uri,
		cid: r.cid,
	}));

	return { cards, connections };
}

export function buildConnectionIndex(
	cards: CardWithMeta[],
	connections: ConnectionEdge[],
): Map<string, CardConnections> {
	const index = new Map<string, CardConnections>();

	// Build flattened connections keyed by both URI and URL
	for (const card of cards) {
		const empty: CardConnections = { outgoing: [], incoming: [] };
		index.set(card.uri, empty);
		if (card.url) {
			index.set(card.url, empty);
		}
	}

	for (const edge of connections) {
		const source = edge.record.source;
		const target = edge.record.target;

		if (!index.has(source)) {
			index.set(source, { outgoing: [], incoming: [] });
		}
		if (!index.has(target)) {
			index.set(target, { outgoing: [], incoming: [] });
		}

		const sourceEntry = index.get(source);
		if (sourceEntry) sourceEntry.outgoing.push(edge);

		const targetEntry = index.get(target);
		if (targetEntry) targetEntry.incoming.push(edge);
	}

	return index;
}

export async function resolveHandles(
	client: Client,
	dids: string[],
	cache: Record<string, string>,
): Promise<Record<string, string>> {
	const result = { ...cache };
	const toResolve = dids.filter((did) => !result[did]);

	if (toResolve.length === 0) return result;

	for (const did of toResolve) {
		try {
			// Use Bluesky profile lookup to get handle from DID
			const profileResp = await (client as any).get("app.bsky.actor.getProfile", {
				params: { actor: did },
			});
			if (profileResp.ok && profileResp.data?.handle) {
				result[did] = profileResp.data.handle;
			} else {
				result[did] = did.slice(0, 20) + "…";
			}
		} catch {
			// Fallback for non-Bluesky PDS: truncated DID
			result[did] = did.slice(0, 20) + "…";
		}
	}

	return result;
}

export function resolveCardReference(
	ref: string,
	cards: CardWithMeta[],
): CardWithMeta | undefined {
	return cards.find((c) => c.uri === ref || c.url === ref);
}
