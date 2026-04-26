import type { Client } from "@atcute/client";
import type { CardWithMeta, ConnectionEdge, InterestingNode, DiscoverCandidate } from "../types";
import {
	listForeignFollows,
	checkHasCosmikCards,
	fetchForeignCards,
	extractBareDid,
	resolveHandles,
} from "../api/cosmik-api";


/**
 * Identify the most interesting nodes in each community for discovery.
 * Scores by degree, cross-community edges, and provenance count.
 */
export function identifyInterestingNodes(
	communities: Map<string, number>,
	nodes: Array<{ id: string; degree: number; provenance: Array<{ aturi: string }> }>,
	links: Array<{ source: string | { id: string }; target: string | { id: string } }>,
	perCommunity = 5,
): InterestingNode[] {
	// Build community membership
	const communityMembers = new Map<number, Set<string>>();
	for (const [nodeId, commId] of communities) {
		if (!communityMembers.has(commId)) communityMembers.set(commId, new Set());
		communityMembers.get(commId)!.add(nodeId);
	}

	// Count cross-community edges per node
	const crossCommunityEdges = new Map<string, number>();
	for (const link of links) {
		const srcId = typeof link.source === "string" ? link.source : (link.source as any).id;
		const tgtId = typeof link.target === "string" ? link.target : (link.target as any).id;
		const srcComm = communities.get(srcId);
		const tgtComm = communities.get(tgtId);
		if (srcComm !== undefined && tgtComm !== undefined && srcComm !== tgtComm) {
			crossCommunityEdges.set(srcId, (crossCommunityEdges.get(srcId) || 0) + 1);
			crossCommunityEdges.set(tgtId, (crossCommunityEdges.get(tgtId) || 0) + 1);
		}
	}

	// Score and select per community
	const result: InterestingNode[] = [];
	for (const [commId, members] of communityMembers) {
		const scored: Array<{ nodeId: string; score: number; degree: number; crossCommunity: number; provCount: number }> = [];
		for (const nodeId of members) {
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) continue;
			const deg = node.degree;
			const cross = crossCommunityEdges.get(nodeId) || 0;
			const provCount = node.provenance.length;
			// Weighted score: degree matters most, provenance is a strong signal, cross-community is a bonus
			const score = deg * 0.4 + provCount * 0.35 + cross * 0.25;
			scored.push({ nodeId, score, degree: deg, crossCommunity: cross, provCount });
		}
		scored.sort((a, b) => b.score - a.score);
		for (const s of scored.slice(0, perCommunity)) {
			result.push({
				nodeId: s.nodeId,
				communityId: commId,
				degree: s.degree,
				crossCommunityEdges: s.crossCommunity,
				provenanceCount: s.provCount,
			});
		}
	}
	return result;
}

/**
 * Extract DIDs from provenance chains on interesting nodes.
 * Cards with originalCard or provenance.via reference another user's card.
 */
export function extractProvenanceDids(
	interestingNodes: InterestingNode[],
	nodeCards: Map<string, CardWithMeta>,
): string[] {
	const dids = new Set<string>();
	for (const node of interestingNodes) {
		const card = nodeCards.get(node.nodeId);
		if (!card) continue;
		const record = card.record;
		// Check originalCard
		if (record.originalCard?.uri) {
			const did = extractBareDid(record.originalCard.uri);
			if (did) dids.add(did);
		}
		// Check provenance.via
		if (record.provenance?.via?.uri) {
			const did = extractBareDid(record.provenance.via.uri);
			if (did) dids.add(did);
		}
	}
	return Array.from(dids);
}

/**
 * Main discovery pipeline: find candidate DIDs to follow.
 *
 * Strategy A: Walk provenance chains on interesting nodes (free)
 * Strategy B: Follow-of-follow — check who your followed users follow on Semble
 * Strategy C: Fetch cards from candidates and check URL overlap
 */
export async function discoverCandidates(
	interestingNodes: InterestingNode[],
	nodeCards: Map<string, CardWithMeta>,
	followedDids: string[],
	foreignCards: Map<string, CardWithMeta[]>,
	client: Client,
	handleCache: Record<string, string>,
	onProgress?: (phase: string, done: number, total: number) => void,
): Promise<DiscoverCandidate[]> {
	const existingDids = new Set([
		// The user's own DID is handled by the caller
		...followedDids,
		...Array.from(foreignCards.keys()),
	]);

	// --- Strategy A: Provenance chain walking ---
	onProgress?.("provenance", 0, 1);
	const provenanceDids = extractProvenanceDids(interestingNodes, nodeCards);
	const candidateDids = new Map<string, "provenance" | "follow-of-follow">();
	for (const did of provenanceDids) {
		if (!existingDids.has(did)) {
			candidateDids.set(did, "provenance");
		}
	}
	onProgress?.("provenance", 1, 1);

	// --- Strategy B: Follow-of-follow expansion ---
	// Pick followed users who have cards in interesting communities
	const followedWithCards = Array.from(foreignCards.keys()).filter((did) => existingDids.has(did));
	// Limit to top 5 followed users to avoid excessive API calls
	const followedToExpand = followedWithCards.slice(0, 5);
	onProgress?.("follow-of-follow", 0, followedToExpand.length);

	const followOfFollowDids = new Set<string>();
	let fofDone = 0;
	const fofResults = await Promise.allSettled(
		followedToExpand.map(async (did) => {
			try {
				const follows = await listForeignFollows(client, did);
				for (const fDid of follows) {
					if (!existingDids.has(fDid) && !candidateDids.has(fDid)) {
						followOfFollowDids.add(fDid);
					}
				}
			} catch (e) {
				console.warn(`[Semblage] Failed to fetch follows for ${did}:`, e);
			}
			fofDone++;
			onProgress?.("follow-of-follow", fofDone, followedToExpand.length);
		}),
	);

	// Check which follow-of-follow candidates actually have cosmik cards
	const fofCandidates = Array.from(followOfFollowDids);
	onProgress?.("checking-cards", 0, fofCandidates.length);
	let checkDone = 0;
	const hasCardsResults = await Promise.allSettled(
		fofCandidates.map(async (did) => {
			try {
				const hasCards = await checkHasCosmikCards(client, did);
				checkDone++;
				onProgress?.("checking-cards", checkDone, fofCandidates.length);
				return hasCards ? did : null;
			} catch {
				checkDone++;
				onProgress?.("checking-cards", checkDone, fofCandidates.length);
				return null;
			}
		}),
	);
	for (const result of hasCardsResults) {
		if (result.status === "fulfilled" && result.value) {
			candidateDids.set(result.value, "follow-of-follow");
		}
	}

	// --- Strategy C: Fetch cards from candidates and check URL overlap ---
	const allCandidateDids = Array.from(candidateDids.keys());
	// Cap to 30 candidates for card fetching
	const candidatesToFetch = allCandidateDids.slice(0, 30);
	onProgress?.("fetching-cards", 0, candidatesToFetch.length);

	// Build URL set of interesting nodes for overlap check
	const interestingUrls = new Set<string>();
	for (const node of interestingNodes) {
		const card = nodeCards.get(node.nodeId);
		if (card?.url) interestingUrls.add(card.url);
	}

	const candidateCards = new Map<string, CardWithMeta[]>();
	let fetchDone = 0;
	const fetchResults = await Promise.allSettled(
		candidatesToFetch.map(async (did) => {
			try {
				const { cards } = await Promise.race([
					fetchForeignCards(client, did),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error("Timeout after 1500ms")), 1500),
					),
				]);
				candidateCards.set(did, cards);
			} catch {
				// Skip timed-out or failed candidates
			}
			fetchDone++;
			onProgress?.("fetching-cards", fetchDone, candidatesToFetch.length);
		}),
	);

	// Resolve handles for all candidates
	const didsToResolve = allCandidateDids.filter((did) => !handleCache[did]);
	const updatedCache = await resolveHandles(client, didsToResolve, handleCache);

	// Build community map for overlap
	const nodeCommunityMap = new Map<string, number>();
	for (const node of interestingNodes) {
		nodeCommunityMap.set(node.nodeId, node.communityId);
	}

	// --- Rank candidates ---
	const candidates: DiscoverCandidate[] = [];
	for (const did of allCandidateDids) {
		const cards = candidateCards.get(did) || [];
		const sharedCards: CardWithMeta[] = [];
		const overlapCommunities = new Set<number>();

		for (const card of cards) {
			if (card.url && interestingUrls.has(card.url)) {
				sharedCards.push(card);
				// Find which community this URL belongs to
				for (const [nodeId, commId] of nodeCommunityMap) {
					const nodeCard = nodeCards.get(nodeId);
					if (nodeCard?.url === card.url) {
						overlapCommunities.add(commId);
					}
				}
			}
		}

		// Only include candidates with at least 1 shared card, or provenance-chain candidates
		const source = candidateDids.get(did)!;
		if (sharedCards.length > 0 || source === "provenance") {
			candidates.push({
				did,
				handle: updatedCache[did] || did.slice(0, 20) + "…",
				sharedCards,
				communityOverlap: Array.from(overlapCommunities),
				source,
			});
		}
	}

	return rankCandidates(candidates);
}

/**
 * Rank candidates by shared card count and community overlap.
 */
export function rankCandidates(candidates: DiscoverCandidate[]): DiscoverCandidate[] {
	return candidates.sort((a, b) => {
		// Provenance candidates get a bonus
		const aBonus = a.source === "provenance" ? 1 : 0;
		const bBonus = b.source === "provenance" ? 1 : 0;
		const aScore = a.sharedCards.length * 2 + a.communityOverlap.length + aBonus;
		const bScore = b.sharedCards.length * 2 + b.communityOverlap.length + bBonus;
		return bScore - aScore;
	});
}
