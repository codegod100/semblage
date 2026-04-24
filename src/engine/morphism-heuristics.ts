import type { CardWithMeta, ConnectionEdge } from "../types";

export interface MorphismCandidate {
	source: string;
	target: string;
	score: number;
	heuristics: Record<string, number>;
	proposedType: string;
}

class TokenCache {
	#store = new Map<string, Set<string>>();
	tokenize(text: string): Set<string> {
		const cached = this.#store.get(text);
		if (cached) return cached;
		const tokens = new Set(
			text
				.toLowerCase()
				.replace(/[^\w\s]/g, " ")
				.split(/\s+/)
				.filter((t) => t.length > 2),
		);
		this.#store.set(text, tokens);
		return tokens;
	}
}

function parseDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

function parseDate(iso: string | undefined): number {
	if (!iso) return 0;
	const ts = Date.parse(iso);
	return isNaN(ts) ? 0 : ts;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
	const intersection = new Set([...a].filter((x) => b.has(x)));
	const union = new Set([...a, ...b]);
	return union.size === 0 ? 0 : intersection.size / union.size;
}

function adamicAdar(
	commonNeighbors: Set<string>,
	degrees: Map<string, number>,
): number {
	let score = 0;
	for (const n of commonNeighbors) {
		const d = degrees.get(n) || 1;
		if (d > 1) score += 1 / Math.log(d);
	}
	return score;
}

export function discoverMorphismCandidates(
	cards: CardWithMeta[],
	connections: ConnectionEdge[],
	threshold = 0.35,
	maxSuggestionsPerCard = 3,
): MorphismCandidate[] {
	const tokenCache = new TokenCache();
	const candidates: MorphismCandidate[] = [];

	// Precompute adjacency and degrees
	const outgoing = new Map<string, Set<string>>();
	const incoming = new Map<string, Set<string>>();
	const degrees = new Map<string, number>();
	const existingPairs = new Set<string>();

	for (const card of cards) {
		outgoing.set(card.uri, new Set());
		incoming.set(card.uri, new Set());
		degrees.set(card.uri, 0);
	}

	for (const edge of connections) {
		const s = edge.record.source;
		const t = edge.record.target;
		outgoing.get(s)?.add(t);
		incoming.get(t)?.add(s);
		existingPairs.add(`${s}|${t}`);
		degrees.set(s, (degrees.get(s) || 0) + 1);
		degrees.set(t, (degrees.get(t) || 0) + 1);
	}

	const allUris = cards.map((c) => c.uri);
	const typeFreq = new Map<string, number>();
	for (const edge of connections) {
		const type = edge.record.connectionType || "related";
		typeFreq.set(type, (typeFreq.get(type) || 0) + 1);
	}
	const dominantType =
		Array.from(typeFreq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
		"related";

	// For each card, find best candidates
	for (let i = 0; i < cards.length; i++) {
		const cardA = cards[i];
		const degA = degrees.get(cardA.uri) || 0;
		const tokensA = tokenCache.tokenize(
			cardA.title + " " + (cardA.record.content as any)?.metadata?.description || "",
		);
		const domainA = cardA.url ? parseDomain(cardA.url) : "";
		const createdA = parseDate(cardA.record.createdAt);

		const scores: Array<{ target: string; score: number; heuristics: Record<string, number>; type: string }> = [];

		for (let j = 0; j < cards.length; j++) {
			if (i === j) continue;
			const cardB = cards[j];
			const pairKey = `${cardA.uri}|${cardB.uri}`;
			if (existingPairs.has(pairKey)) continue;

			const heuristics: Record<string, number> = {};

			// 1. Co-reference (highest weight)
			let coref = 0;
			const metaA = (cardA.record.content as any)?.metadata;
			const metaB = (cardB.record.content as any)?.metadata;
			if (metaA?.doi && metaA.doi === metaB?.doi) coref = 1;
			if (metaA?.isbn && metaA.isbn === metaB?.isbn) coref = 1;
			if (cardA.url && cardA.url === cardB.url) coref = 1;
			heuristics.coref = coref;

			// 2. Domain affinity
			const domainB = cardB.url ? parseDomain(cardB.url) : "";
			heuristics.domain = domainA && domainA === domainB ? 0.8 : 0;

			// 3. Lexical overlap
			const tokensB = tokenCache.tokenize(
				cardB.title + " " + (metaB?.description || ""),
			);
			heuristics.lexical = jaccard(tokensA, tokensB);

			// 4. Temporal clustering (within 5 minutes)
			const createdB = parseDate(cardB.record.createdAt);
			const deltaMin = Math.abs(createdA - createdB) / 60000;
			heuristics.temporal = deltaMin < 5 ? 1 - deltaMin / 5 : 0;

			// 5. Semantic type adjacency
			const typePair = `${cardA.semanticType}|${cardB.semanticType}`;
			const typeEdgeFreq = new Map<string, number>();
			for (const edge of connections) {
				const src = cards.find((c) => c.uri === edge.record.source);
				const tgt = cards.find((c) => c.uri === edge.record.target);
				if (src && tgt) {
					const key = `${src.semanticType}|${tgt.semanticType}`;
					typeEdgeFreq.set(key, (typeEdgeFreq.get(key) || 0) + 1);
				}
			}
			const maxTypeFreq = Math.max(...typeEdgeFreq.values(), 1);
			heuristics.typeAdj = (typeEdgeFreq.get(typePair) || 0) / maxTypeFreq;

			// 6. Graph proximity (common neighbors / Adamic-Adar)
			const outA = outgoing.get(cardA.uri) || new Set();
			const outB = outgoing.get(cardB.uri) || new Set();
			const inA = incoming.get(cardA.uri) || new Set();
			const inB = incoming.get(cardB.uri) || new Set();
			const commonOut = new Set([...outA].filter((x) => outB.has(x)));
			const commonIn = new Set([...inA].filter((x) => inB.has(x)));
			const commonAll = new Set([...commonOut, ...commonIn]);

			const jaccardOut = jaccard(outA, outB);
			const jaccardIn = jaccard(inA, inB);
			const aa = adamicAdar(commonAll, degrees);
			const maxAA = Math.log(cards.length + 1);
			heuristics.graphProx = (jaccardOut + jaccardIn) / 2 + (maxAA > 0 ? aa / maxAA : 0) * 0.5;

			// 7. Preferential attachment (hub preference)
			const degB = degrees.get(cardB.uri) || 0;
			const maxDeg = Math.max(...degrees.values(), 1);
			heuristics.hub = degA === 0 && degB > 0 ? degB / maxDeg : 0;

			// Weighted composite score (normalize to 0-1)
			const MAX_WEIGHT = 1.0 + 0.7 + 0.5 + 0.3 + 0.4 + 0.6 + 0.2; // = 3.7
			const rawScore =
				heuristics.coref * 1.0 +
				heuristics.domain * 0.7 +
				heuristics.lexical * 0.5 +
				heuristics.temporal * 0.3 +
				heuristics.typeAdj * 0.4 +
				heuristics.graphProx * 0.6 +
				heuristics.hub * 0.2;
			const score = rawScore / MAX_WEIGHT;

			if (score >= threshold) {
				// Infer type from semantic pair if known, else dominant
				const inferredType =
					Array.from(typeEdgeFreq.entries())
						.filter(([k]) => k === typePair)
						.sort((a, b) => b[1] - a[1])[0]?.[0] || dominantType;

				scores.push({
					target: cardB.uri,
					score,
					heuristics,
					type: inferredType,
				});
			}
		}

		scores.sort((a, b) => b.score - a.score);
		for (const s of scores.slice(0, maxSuggestionsPerCard)) {
			candidates.push({
				source: cardA.uri,
				target: s.target,
				score: s.score,
				heuristics: s.heuristics,
				proposedType: s.type,
			});
		}
	}

	return candidates;
}
