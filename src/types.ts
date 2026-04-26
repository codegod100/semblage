// Types matching network.cosmik.* lexicons from the cosmik-network/semble repo

export interface StrongRef {
	cid: string;
	uri: string;
}

export interface UrlMetadata {
	$type?: "network.cosmik.card#urlMetadata";
	title?: string;
	description?: string;
	author?: string;
	publishedDate?: string;
	siteName?: string;
	imageUrl?: string;
	type?: string;
	retrievedAt?: string;
	doi?: string;
	isbn?: string;
}

export interface UrlContent {
	$type?: "network.cosmik.card#urlContent";
	url: string;
	metadata?: UrlMetadata;
}

export interface NoteContent {
	$type?: "network.cosmik.card#noteContent";
	text: string;
}

export interface CosmikCardRecord {
	$type: "network.cosmik.card";
	type: "URL" | "NOTE" | string;
	content: UrlContent | NoteContent;
	url?: string;
	parentCard?: StrongRef;
	originalCard?: StrongRef;
	createdAt?: string;
	provenance?: { via?: StrongRef };
}

export interface CosmikConnectionRecord {
	$type: "network.cosmik.connection";
	source: string;
	target: string;
	connectionType?: string;
	note?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface CosmikCollectionRecord {
	$type: "network.cosmik.collection";
	name: string;
	description?: string;
	accessType: "OPEN" | "CLOSED" | string;
	collaborators?: string[];
	createdAt?: string;
	updatedAt?: string;
}

export interface CosmikCollectionLinkRecord {
	$type: "network.cosmik.collectionLink";
	collection: StrongRef;
	card: StrongRef;
	originalCard?: StrongRef;
	addedBy: string;
	addedAt: string;
	createdAt?: string;
	provenance?: { via?: StrongRef };
}

export interface CosmikFollowRecord {
	$type: "network.cosmik.follow";
	subject: string;
	createdAt?: string;
}

// Enriched types for local use
export interface CardWithMeta {
	uri: string;
	cid: string;
	rkey: string;
	record: CosmikCardRecord;
	title: string;
	semanticType: string;
	subtitle: string;
	url?: string;
}

export interface ConnectionEdge {
	record: CosmikConnectionRecord;
	uri: string;
	cid: string;
}

export interface CardConnections {
	outgoing: ConnectionEdge[];
	incoming: ConnectionEdge[];
}

// Semantic type buckets
export const SEMANTIC_TYPES = [
	"article",
	"research",
	"software",
	"video",
	"book",
	"social",
	"link",
] as const;

export type SemanticType = (typeof SEMANTIC_TYPES)[number];

export function getSemanticType(card: CosmikCardRecord): SemanticType | "note" | "other" {
	if (card.type === "NOTE") return "note";
	if (card.type === "URL") {
		const metaType = (card.content as UrlContent)?.metadata?.type?.toLowerCase() || "";
		if (SEMANTIC_TYPES.includes(metaType as SemanticType)) return metaType as SemanticType;
		return "link";
	}
	return "other";
}

export function getCardTitle(card: CosmikCardRecord): string {
	if (card.type === "URL") {
		const meta = (card.content as UrlContent)?.metadata;
		return meta?.title || card.url || "Untitled URL";
	}
	if (card.type === "NOTE") {
		const text = (card.content as NoteContent)?.text || "";
		return text.split("\n")[0].slice(0, 80) || "Untitled Note";
	}
	return "Untitled";
}

export function getCardSubtitle(card: CosmikCardRecord): string {
	if (card.type === "URL") {
		const meta = (card.content as UrlContent)?.metadata;
		return meta?.siteName || meta?.author || card.url || "";
	}
	return "";
}

export function getCardUrl(card: CosmikCardRecord): string | undefined {
	if (card.type === "URL") {
		return (card.content as UrlContent)?.url || card.url;
	}
	return card.url;
}

// Discovery types

export interface InterestingNode {
	nodeId: string;
	communityId: number;
	degree: number;
	crossCommunityEdges: number;
	provenanceCount: number;
}

export interface DiscoverCandidate {
	did: string;
	handle: string;
	sharedCards: CardWithMeta[];
	communityOverlap: number[];
	source: "provenance" | "follow-of-follow";
}

export function getCardDescription(card: CosmikCardRecord): string {
	if (card.type === "URL") {
		return (card.content as UrlContent)?.metadata?.description || "";
	}
	if (card.type === "NOTE") {
		const text = (card.content as NoteContent)?.text || "";
		return text.slice(0, 200);
	}
	return "";
}
