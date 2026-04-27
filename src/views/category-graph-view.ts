import { ItemView, WorkspaceLeaf, Notice, App } from "obsidian";
import type { Client } from "@atcute/client";
import type { CardWithMeta, ConnectionEdge, DiscoverCandidate } from "../types";
import { resolveCardReference, createFollow } from "../api/cosmik-api";
import { discoverMorphismCandidatesChunked, type MorphismCandidate } from "../engine/morphism-heuristics";
import { identifyInterestingNodes, discoverCandidates } from "../engine/discover";
import { ConnectionModal } from "../modals/connection-modal";
import * as d3 from "d3";

import { loadHandleCache, saveHandleCache, extractDid } from "../util/handle-cache";
import { ForeignCache } from "../util/foreign-cache";

import { louvainCommunities } from "../engine/louvain";
import { generateCommunityLabels } from "../engine/community-labels";

export const VIEW_TYPE_CATEGORY_GRAPH = "semblage-category-graph";

interface ProvenanceEntry {
	aturi: string;
	handle: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
	id: string;
	card: CardWithMeta;
	degree: number;
	isIsolated: boolean;
	morphicScore: number;
	noteCount: number;
	isForeign: boolean;
	provenance: ProvenanceEntry[];
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
	source: string | GraphNode;
	target: string | GraphNode;
	type: string;
	isSuggestion: boolean;
	isForeign: boolean;
	count: number;
	candidate?: MorphismCandidate;
}

const TYPE_COLORS: Record<string, string> = {
	article: "#e74c3c",
	research: "#9b59b6",
	software: "#3498db",
	video: "#e67e22",
	book: "#27ae60",
	social: "#1abc9c",
	link: "#95a5a6",
	note: "#f39c12",
	other: "#7f8c8d",
};

const PREDICATE_COLORS: Record<string, string> = {
	cites: "#e74c3c",
	"inspired-by": "#9b59b6",
	"contradicts": "#e67e22",
	"extends": "#3498db",
	"references": "#27ae60",
	"supports": "#1abc9c",
	"supplement": "#f39c12",
	"related": "#95a5a6",
};

const HEURISTIC_LABELS: Record<string, string> = {
	coref: "Co-reference",
	domain: "Domain affinity",
	lexical: "Lexical overlap",
	temporal: "Temporal proximity",
	typeAdj: "Type adjacency",
	graphProx: "Graph proximity",
	hub: "Hub attachment",
};

function roundedHullPath(points: [number, number][], radius: number): string {
	if (points.length < 3) return "";
	// Move along hull points and create arcs between them
	const segments: string[] = [];
	for (let i = 0; i < points.length; i++) {
		const p0 = points[(i - 1 + points.length) % points.length];
		const p1 = points[i];
		const p2 = points[(i + 1) % points.length];

		// Incoming vector
		const vin = [p1[0] - p0[0], p1[1] - p0[1]];
		const lin = Math.hypot(vin[0], vin[1]);
		const nin = lin > 0 ? [vin[0] / lin, vin[1] / lin] : [0, 0];

		// Outgoing vector
		const vout = [p2[0] - p1[0], p2[1] - p1[1]];
		const lout = Math.hypot(vout[0], vout[1]);
		const nout = lout > 0 ? [vout[0] / lout, vout[1] / lout] : [0, 0];

		// Shorten the incoming and outgoing segments by radius
		const start = [p1[0] - nin[0] * radius, p1[1] - nin[1] * radius];
		const end = [p1[0] + nout[0] * radius, p1[1] + nout[1] * radius];

		if (i === 0) {
			segments.push(`M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`);
		} else {
			segments.push(`L ${start[0].toFixed(1)} ${start[1].toFixed(1)}`);
		}
		segments.push(`Q ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`);
	}
	segments.push("Z");
	return segments.join(" ");
}

export class CategoryGraphView extends ItemView {
	private client: Client;
	private did: string;
	private cards: CardWithMeta[] = [];
	private connections: ConnectionEdge[] = [];
	private candidates: MorphismCandidate[] = [];
	private foreignCards: Map<string, CardWithMeta[]> = new Map(); // did -> cards
	private foreignConnections: Map<string, ConnectionEdge[]> = new Map(); // did -> connections
	private refreshEl: HTMLElement;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
	private showSuggestions = true;
	private showImports = true;
	private activeFilter: string | null = null;
	private semanticTypeFilter: string | null = null;
	private width = 800;
	private height = 600;
	private sidePanel: HTMLElement | null = null;
	private graphContainer: HTMLElement | null = null;
	private selectedCardUri: string | null = null;
	private handleCache: Record<string, string> = {};
	private plugin: any;

	private computingCandidates = false;
	private isLoading = false;
	private discoveringPeople = false;
	private discoveredCandidates: DiscoverCandidate[] = [];
	private lastCommunities: Map<string, number> = new Map();
	private lastCommunityLabels: Map<number, string[]> = new Map();
	private followedDids: Set<string> = new Set();
	private lastRenderTime = 0;
	private foreignCache: ForeignCache = new ForeignCache();

	constructor(leaf: WorkspaceLeaf, client: Client, did: string, plugin: any) {
		super(leaf);
		this.client = client;
		this.did = did;
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CATEGORY_GRAPH;
	}

	getDisplayText(): string {
		return "Category Graph";
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("semblage-category-graph");

		const header = this.contentEl.createDiv({ cls: "semblage-graph-header" });
		header.createEl("h3", { text: "Category Graph" });

		this.refreshEl = header.createEl("span", {
			text: "Loading...",
			cls: "semblage-graph-status",
		});

		const controls = header.createDiv({ cls: "semblage-graph-controls" });
		this.renderControls(controls);

		const mainContainer = this.contentEl.createDiv({ cls: "semblage-graph-main" });

		this.graphContainer = mainContainer.createDiv({ cls: "semblage-graph-container" });
		this.svg = d3
			.select(this.graphContainer)
			.append("svg")
			.attr("width", "100%")
			.attr("height", "100%");

		// Side panel for card details
		this.sidePanel = mainContainer.createDiv({ cls: "semblage-graph-sidepanel hidden" });
		const closeBtn = this.sidePanel.createEl("button", {
			text: "×",
			cls: "semblage-graph-sidepanel-close",
		});
		closeBtn.addEventListener("click", () => this.closeSidePanel());

		// Open IndexedDB cache for foreign card data
		try {
			await this.foreignCache.open();
		} catch (e) {
			console.warn("[Semblage] Failed to open foreign cache:", e);
		}

		// Load data asynchronously so view opens immediately
		this.loadData();

		// Handle resize
		this.registerDomEvent(window, "resize", () => {
			this.updateDimensions();
		});
	}

	updateDimensions() {
		if (!this.graphContainer || !this.svg) return;
		const rect = this.graphContainer.getBoundingClientRect();
		this.width = rect.width;
		this.height = rect.height;
		this.svg.attr("viewBox", [0, 0, this.width, this.height]);
		if (this.simulation) {
			this.simulation.force("center", d3.forceCenter(this.width / 2, this.height / 2));
			this.simulation.alpha(0.3).restart();
		}
	}

	renderControls(container: HTMLElement) {
		const refreshBtn = container.createEl("button", { text: "Refresh" });
		refreshBtn.addEventListener("click", () => this.loadData({ useCache: false }));

		const toggleBtn = container.createEl("button", { text: "Hide Suggestions" });
		toggleBtn.addEventListener("click", () => {
			this.showSuggestions = !this.showSuggestions;
			toggleBtn.textContent = this.showSuggestions ? "Hide Suggestions" : "Show Suggestions";
			this.renderGraph();
		});

		const importBtn = container.createEl("button", { text: "Hide Imports" });
		importBtn.addEventListener("click", () => {
			this.showImports = !this.showImports;
			importBtn.textContent = this.showImports ? "Hide Imports" : "Show Imports";
			this.renderGraph();
		});

		const discoverBtn = container.createEl("button", { text: "Discover People" });
		discoverBtn.addEventListener("click", () => this.discoverPeople());

		const filterSelect = container.createEl("select");
		filterSelect.createEl("option", { text: "All morphisms", value: "" });
		const types = [...new Set(this.connections.map((c) => c.record.connectionType || "related"))].sort();
		for (const t of types) {
			filterSelect.createEl("option", { text: t, value: t });
		}
		filterSelect.addEventListener("change", (e) => {
			this.activeFilter = (e.target as HTMLSelectElement).value || null;
			this.renderGraph();
		});

		const typeSelect = container.createEl("select");
		typeSelect.createEl("option", { text: "All types", value: "" });
		for (const t of Object.keys(TYPE_COLORS)) {
			typeSelect.createEl("option", { text: t.charAt(0).toUpperCase() + t.slice(1), value: t });
		}
		typeSelect.createEl("option", { text: "Note", value: "note" });
		typeSelect.createEl("option", { text: "Other", value: "other" });
		typeSelect.addEventListener("change", (e) => {
			this.semanticTypeFilter = (e.target as HTMLSelectElement).value || null;
			this.renderGraph();
		});
	}

	setAuth(did: string) {
		this.did = did;
	}

	async loadData(opts: { useCache?: boolean } = {}) {
		const useCache = opts.useCache !== false; // default true
		if (this.isLoading) {
			console.log("[Semblage] loadData() already running, skipping");
			return;
		}
		if (!this.did) {
			this.refreshEl.textContent = "Not logged in";
			return;
		}
		this.isLoading = true;
		this.refreshEl.textContent = "Loading...";
		this.candidates = []; // reset
		this.computingCandidates = false;
		console.log(`[Semblage] ========== loadData() start (useCache=${useCache}) ==========`);
		console.time("[Semblage] loadData: total");

		try {
			const { listCards, listConnections, listFollows, resolveHandles } = await import("../api/cosmik-api");

			// 1. Parallel local data fetch (always from PDS — fast)
			console.time("[Semblage] API: local fetch");
			const [cards, connections, follows] = await Promise.all([
				listCards(this.client, this.did),
				listConnections(this.client, this.did),
				listFollows(this.client, this.did),
			]);
			console.timeEnd("[Semblage] API: local fetch");
			console.log(`[Semblage]   → ${cards.length} cards, ${connections.length} connections, ${follows.length} follows`);

			this.cards = cards;
			this.connections = connections;
			this.followedDids = new Set(follows);
			console.log(`[Semblage] follows list (${follows.length}):`, follows);

			// 2. Render local graph immediately (fast!)
			console.time("[Semblage] RENDER: local first paint");
			this.updateStatus(follows.length, 0, 0);
			this.renderGraph();
			console.timeEnd("[Semblage] RENDER: local first paint");

			// 3. Background heuristics: skip if dataset is very large to prevent CPU spike
			if (this.cards.length <= 200) {
				this.computeCandidatesInBackground();
			} else {
				console.log("[Semblage] Dataset >200 cards; skipping auto heuristics to keep UI responsive.");
			}

			// 4. Load foreign data — from cache or PDS
			this.foreignCards.clear();
			this.foreignConnections.clear();

			const handleCache = await loadHandleCache(this.plugin);

			if (useCache) {
				// Load from IndexedDB cache
				console.time("[Semblage] cache: load foreign data");
				try {
					const cached = await this.foreignCache.getAll();
					let importedCount = 0;
					const allForeignDids: string[] = [];
					for (const [did, entry] of cached) {
						if (this.followedDids.has(did)) {
							this.foreignCards.set(did, entry.cards);
							this.foreignConnections.set(did, entry.connections);
							importedCount += entry.cards.length;
							allForeignDids.push(did);
						}
					}
					console.timeEnd("[Semblage] cache: load foreign data");
					console.log(`[Semblage]   → ${cached.size} cached accounts, ${importedCount} cards`);

					// Resolve handles for cached DIDs
					if (allForeignDids.length > 0) {
						this.handleCache = await resolveHandles(this.client, allForeignDids, handleCache);
						const resolvedOnly: Record<string, string> = {};
						for (const [did, handle] of Object.entries(this.handleCache)) {
							if (!handle.startsWith("did:")) resolvedOnly[did] = handle;
						}
						await saveHandleCache(this.plugin, resolvedOnly);
					}

					this.updateStatus(follows.length, importedCount, allForeignDids.length);
					this.renderGraph();

					if (this.cards.length <= 200) {
						this.computeCandidatesInBackground();
					}
				} catch (e) {
					console.warn("[Semblage] Cache read failed, falling back to PDS fetch:", e);
					await this.fetchForeignFromPDS(follows, handleCache);
				}
			} else {
				await this.fetchForeignFromPDS(follows, handleCache);
			}
		} catch (e) {
			this.refreshEl.textContent = "Error loading";
			new Notice("Failed to load graph: " + (e instanceof Error ? e.message : String(e)));
		} finally {
			this.isLoading = false;
			console.timeEnd("[Semblage] loadData: total");
			console.log("[Semblage] ========== loadData() end ==========");
		}
	}

	private async fetchForeignFromPDS(follows: string[], handleCache: Record<string, string>) {
		const { resolveHandles } = await import("../api/cosmik-api");

		// Prune cache entries for unfollowed DIDs
		const followedSet = new Set(follows);
		try {
			const cached = await this.foreignCache.getAll();
			for (const did of cached.keys()) {
				if (!followedSet.has(did)) {
					this.foreignCache.delete(did).catch(() => {});
				}
			}
		} catch {
			// Cache may not be open; ignore
		}

		console.time("[Semblage] API: foreign fetch");
		let importedCount = 0;
		const allForeignDids: string[] = [];
		let successCount = 0;
		const BATCH_SIZE = 5;
		for (let i = 0; i < follows.length; i += BATCH_SIZE) {
			const batch = follows.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.allSettled(
				batch.map(async (foreignDid) => {
					try {
						const foreign = await this.fetchForeignCardsWithTimeout(this.client, foreignDid, 3000);
						return { did: foreignDid, ...foreign };
					} catch (e) {
						console.warn(`[Semblage] Skipped ${foreignDid}:`, e instanceof Error ? e.message : e);
						return null;
					}
				}),
			);
			for (const result of batchResults) {
				if (result.status === "fulfilled" && result.value) {
					const { did, cards, connections } = result.value;
					this.foreignCards.set(did, cards);
					this.foreignConnections.set(did, connections);
					importedCount += cards.length;
					allForeignDids.push(did);
					successCount++;
					// Write to IndexedDB cache
					this.foreignCache.put(did, cards, connections).catch((e) =>
						console.warn(`[Semblage] Cache write failed for ${did}:`, e),
					);
				}
			}
			// Render after each batch so user sees progress
			this.updateStatus(follows.length, importedCount, successCount);
			this.renderGraph();
		}
		console.timeEnd("[Semblage] API: foreign fetch");
		console.log(`[Semblage]   → ${successCount}/${follows.length} follows imported, ${importedCount} cards total`);

		// Parallel handle resolution for all imported DIDs
		console.time("[Semblage] handle resolution");
		if (allForeignDids.length > 0) {
			this.handleCache = await resolveHandles(this.client, allForeignDids, handleCache);
			// Only persist resolved handles to cache; drop failed lookups
			const resolvedOnly: Record<string, string> = {};
			for (const [did, handle] of Object.entries(this.handleCache)) {
				if (!handle.startsWith("did:")) resolvedOnly[did] = handle;
			}
			await saveHandleCache(this.plugin, resolvedOnly);
		}
		console.timeEnd("[Semblage] handle resolution");

		// Final render with handles resolved
		this.updateStatus(follows.length, importedCount, successCount);
		this.renderGraph();

		// Re-compute candidates now that foreign data is loaded
		if (this.cards.length <= 200) {
			this.computeCandidatesInBackground();
		}
	}

	private async computeCandidatesInBackground() {
		if (this.computingCandidates) return;
		this.computingCandidates = true;
		this.refreshEl.textContent += " · Computing suggestions...";

		try {
			console.time("[Semblage] HEURISTICS: discoverMorphismCandidates");
			this.candidates = await discoverMorphismCandidatesChunked(
				this.cards,
				this.connections,
				0.35,
				3,
				(done, total) => {
					if (done % 25 === 0 || done === total) {
						console.log(`[Semblage] heuristics: ${done}/${total} cards processed`);
					}
				},
			);
			console.timeEnd("[Semblage] HEURISTICS: discoverMorphismCandidates");
			console.log(`[Semblage]   → ${this.candidates.length} candidates found`);
			// Re-render to show suggestion edges and morphic scores
			// Skip if the graph was just rendered (avoid clobbering batch foreign renders)
			if (Date.now() - this.lastRenderTime > 500) {
				console.time("[Semblage] RENDER: post-candidates update");
				this.renderGraph();
				console.timeEnd("[Semblage] RENDER: post-candidates update");
			}
		} catch (e) {
			console.error("Failed to compute morphism candidates:", e);
		} finally {
			this.computingCandidates = false;
		}
	}

	private async fetchForeignCardsWithTimeout(client: Client, did: string, ms: number) {
		const { fetchForeignCards } = await import("../api/cosmik-api");
		return Promise.race([
			fetchForeignCards(client, did),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
			),
		]);
	}

	private updateStatus(totalFollows: number, importedCards: number, importedUsers: number) {
		const urlCount = this.cards.filter((c) => c.record.type === "URL").length;
		const noteCount = this.cards.filter((c) => c.record.type === "NOTE").length;
		let text = `${urlCount} objects · ${noteCount} notes · ${this.connections.length} morphisms`;
		if (this.candidates.length > 0) {
			text += ` · ${this.candidates.length} suggestions`;
		}
		text += ` · ${totalFollows} followed`;
		if (importedUsers > 0) {
			text += ` · ${importedUsers} imported (${importedCards} cards)`;
		}
		this.refreshEl.textContent = text;
	}

	renderGraph() {
		if (!this.svg || !this.graphContainer) return;
		this.lastRenderTime = Date.now();
		console.time("[Semblage] renderGraph: total");
		this.simulation?.stop();
		this.svg.selectAll("*").remove();
		this.updateDimensions();

		// Don't create a simulation if the container has no valid size yet.
		if (this.width < 10 || this.height < 10) {
			console.log("[Semblage] renderGraph: container too small, deferring render");
			requestAnimationFrame(() => this.renderGraph());
			return;
		}

		const g = this.svg.append("g");

		// Zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on("zoom", (event) => {
				g.attr("transform", event.transform);
			});
		this.svg.call(zoom as any);

		// Separate URL cards from NOTE cards
		console.time("[Semblage] render: build data structures");
		const localUrlCards = this.cards.filter((c) => c.record.type === "URL");
		const noteCards = this.cards.filter((c) => c.record.type === "NOTE");
		const allForeignCards: CardWithMeta[] = [];
		for (const cards of this.foreignCards.values()) {
			allForeignCards.push(...cards);
		}
		const allForeignUrlCards = allForeignCards.filter((c) => c.record.type === "URL");

		// Build unified URL map with provenance
		const urlMap = new Map<string, { card: CardWithMeta; provenance: ProvenanceEntry[] }>();

		// Helper to add card to URL map
		const addToUrlMap = (card: CardWithMeta, aturi: string, handle: string) => {
			const key = card.url || card.uri;
			const existing = urlMap.get(key);
			if (existing) {
				existing.provenance.push({ aturi, handle });
			} else {
				urlMap.set(key, { card, provenance: [{ aturi, handle }] });
			}
		};

		// Add local cards
		const localHandle = this.handleCache[this.did] || "you";
		for (const card of localUrlCards) {
			addToUrlMap(card, card.uri, localHandle);
		}

		// Add foreign cards
		for (const card of allForeignUrlCards) {
			const foreignDid = extractDid(card.uri);
			const handle = this.handleCache[foreignDid] || foreignDid.slice(0, 15) + "…";
			addToUrlMap(card, card.uri, handle);
		}

		// Build URI→URL reverse map for connection resolution
		const uriToUrl = new Map<string, string>();
		for (const [url, { card }] of urlMap) {
			uriToUrl.set(card.uri, url);
			if (card.url && card.url !== url) uriToUrl.set(card.url, url);
		}

		const resolveUrl = (ref: string): string => {
			return uriToUrl.get(ref) || (urlMap.has(ref) ? ref : ref);
		};

		// Count notes per URL card
		const noteCountMap = new Map<string, number>();
		for (const note of noteCards) {
			if (note.record.parentCard?.uri) {
				const url = uriToUrl.get(note.record.parentCard.uri) || note.record.parentCard.uri;
				noteCountMap.set(url, (noteCountMap.get(url) || 0) + 1);
			}
			if (note.url) {
				const url = uriToUrl.get(note.url) || note.url;
				noteCountMap.set(url, (noteCountMap.get(url) || 0) + 1);
			}
		}

		// Compute degrees per URL across all connections
		const degreeMap = new Map<string, number>();
		for (const c of this.connections) {
			const s = resolveUrl(c.record.source);
			const t = resolveUrl(c.record.target);
			degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
			degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
		}
		if (this.showImports) {
			for (const connections of this.foreignConnections.values()) {
				for (const c of connections) {
					const s = resolveUrl(c.record.source);
					const t = resolveUrl(c.record.target);
					degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
					degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
				}
			}
		}

		// Remove maxScore normalization - use absolute candidate score
		// Candidates are computed in background, so filter is conditional
		let nodes: GraphNode[] = [];
		for (const [url, { card, provenance }] of urlMap) {
			const deg = degreeMap.get(url) || 0;
			const bestCandidate = this.candidates
				.filter((c) => c.source === card.uri || c.target === card.uri)
				.sort((a, b) => b.score - a.score)[0];

			// Determine if this is a foreign node (no local provenance)
			const hasLocal = provenance.some((p) => p.handle === localHandle);
			const isForeign = !hasLocal;

			nodes.push({
				id: url,
				card,
				degree: deg,
				isIsolated: deg === 0,
				morphicScore: bestCandidate ? bestCandidate.score : 0,
				noteCount: noteCountMap.get(url) || 0,
				isForeign,
				provenance,
			});
		}

		// Filter: only show cards that are connected or have morphism candidates
		nodes = nodes.filter((n) => {
			if (n.degree > 0) return true;
			// Isolated nodes: only show if they have a morphism candidate
			return n.morphicScore > 0;
		});

		// Filter by semantic type
		if (this.semanticTypeFilter) {
			nodes = nodes.filter((n) => n.card.semanticType === this.semanticTypeFilter);
		}

		// Build local links
		const existingLinks: GraphLink[] = this.connections
			.filter((c) => !this.activeFilter || (c.record.connectionType || "related") === this.activeFilter)
			.map((c) => ({
				source: resolveUrl(c.record.source),
				target: resolveUrl(c.record.target),
				type: c.record.connectionType || "related",
				isSuggestion: false,
				isForeign: false,
				count: 1,
			}));

		const suggestedLinks: GraphLink[] = this.showSuggestions
			? this.candidates
					.filter((c) => !this.activeFilter || c.proposedType === this.activeFilter)
					.map((c) => ({
						source: resolveUrl(c.source),
						target: resolveUrl(c.target),
						type: c.proposedType,
						isSuggestion: true,
						isForeign: false,
						count: 1,
						candidate: c,
					}))
			: [];

		// Build foreign links
		const foreignLinks: GraphLink[] = [];
		if (this.showImports) {
			for (const connections of this.foreignConnections.values()) {
				for (const c of connections) {
					foreignLinks.push({
						source: resolveUrl(c.record.source),
						target: resolveUrl(c.record.target),
						type: c.record.connectionType || "related",
						isSuggestion: false,
						isForeign: true,
						count: 1,
					});
				}
			}
		}

		// Filter links to only those where both endpoints exist as nodes
		const nodeIds = new Set(nodes.map((n) => n.id));
		const rawLinks = [...existingLinks, ...suggestedLinks, ...foreignLinks].filter(
			(l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string),
		);

		// Deduplicate links by (source, target, type) and count occurrences
		const linkMap = new Map<string, GraphLink>();
		for (const link of rawLinks) {
			const key = `${link.source as string}|${link.target as string}|${link.type}`;
			const existing = linkMap.get(key);
			if (existing) {
				existing.count += link.count;
				// If any instance is a suggestion, keep candidate info
				if (link.isSuggestion && link.candidate) {
					existing.isSuggestion = true;
					existing.candidate = link.candidate;
				}
				// If any instance is local (not foreign), mark as local
				if (!link.isForeign) {
					existing.isForeign = false;
				}
			} else {
				linkMap.set(key, { ...link });
			}
		}
		const links = Array.from(linkMap.values());
		console.timeEnd("[Semblage] render: build data structures");
		console.log(`[Semblage]   → ${nodes.length} nodes, ${links.length} links`);

		// Community detection & labeling
		console.time("[Semblage] render: communities");
		const nodeCardMap = new Map<string, CardWithMeta>();
		for (const n of nodes) nodeCardMap.set(n.id, n.card);

		const rawLinksForCommunities = links
			.filter((l) => !l.isSuggestion)
			.map((l) => ({
				source: l.source as string,
				target: l.target as string,
				weight: l.count,
			}));

		const communities = louvainCommunities(
			nodes.map((n) => n.id),
			rawLinksForCommunities,
		);
		const communityLabels = generateCommunityLabels(communities, nodeCardMap);

		// Stash for discovery
		this.lastCommunities = communities;
		this.lastCommunityLabels = communityLabels;

		// Compute community centroids for clustering force
		const communityCentroids = new Map<number, { x: number; y: number }>();
		for (const n of nodes) {
			const cid = communities.get(n.id);
			if (cid === undefined) continue;
			if (!communityCentroids.has(cid)) {
				communityCentroids.set(cid, { x: 0, y: 0 });
			}
		}

		// Foam color palette (pastel, distinct hues)
		const FOAM_COLORS = ["#e74c3c", "#9b59b6", "#3498db", "#e67e22", "#27ae60", "#1abc9c", "#f39c12", "#2c3e50"];
		console.timeEnd("[Semblage] render: communities");
		console.log(`[Semblage]   → ${new Set(communities.values()).size} communities`);

		console.time("[Semblage] render: D3 setup + DOM insertion");
		// Simulation — faster alpha decay so layout stabilizes quickly (~100 ticks)
		const ALPHA_DECAY_FAST = 1 - Math.pow(0.001, 1 / 100);
		this.simulation = d3
			.forceSimulation<GraphNode>(nodes)
			.alphaDecay(ALPHA_DECAY_FAST)
			.velocityDecay(0.3)
			.force(
				"link",
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((d) => d.id)
					.distance((d) => (d.isSuggestion ? 120 : d.isForeign ? 100 : 80)),
			)
			.force("charge", d3.forceManyBody().strength(-400))
			.force("center", d3.forceCenter(this.width / 2, this.height / 2))
			.force("collide", d3.forceCollide<GraphNode>().radius((d) => this.nodeRadius(d) + 8))
			.force(
				"cluster",
				d3
					.forceX<GraphNode>((d) => {
						const cid = communities.get(d.id);
						if (cid === undefined) return this.width / 2;
						const c = communityCentroids.get(cid);
						return c ? c.x : this.width / 2;
					})
					.strength(0.02),
			)
			.force(
				"clusterY",
				d3
					.forceY<GraphNode>((d) => {
						const cid = communities.get(d.id);
						if (cid === undefined) return this.height / 2;
						const c = communityCentroids.get(cid);
						return c ? c.y : this.height / 2;
					})
					.strength(0.02),
			);

		// Links
		const linkGroup = g
			.append("g")
			.selectAll("line")
			.data(links)
			.enter()
			.append("line")
			.attr("stroke", (d) => {
				if (d.isForeign) return "#95a5a6";
				if (d.isSuggestion) return "#f39c12";
				return PREDICATE_COLORS[d.type] || "#999";
			})
			.attr("stroke-width", (d) => {
				const base = d.isForeign ? 1 : d.isSuggestion ? 1.5 : 2;
				return base + (d.count - 1) * 0.8;
			})
			.attr("stroke-dasharray", (d) => (d.isForeign ? "3,3" : d.isSuggestion ? "5,5" : "none"))
			.attr("stroke-opacity", (d) => (d.isForeign ? 0.5 : d.isSuggestion ? 0.7 : 0.6))
			.attr("marker-end", (d) => {
				if (d.isForeign) return "url(#arrow-foreign)";
				if (d.isSuggestion) return "url(#arrow-suggested)";
				return "url(#arrow)";
			})
			.style("cursor", (d) => (d.isSuggestion ? "pointer" : "default"))
			.on("click", (event, d) => {
				if (d.isSuggestion && d.candidate) {
					this.createSuggestion(d.candidate);
				}
			});

		// Link labels (skip foreign for cleaner look)
		const labelGroup = g
			.append("g")
			.selectAll("text")
			.data(links.filter((d) => !d.isSuggestion && !d.isForeign))
			.enter()
			.append("text")
			.attr("font-size", "9px")
			.attr("fill", "#666")
			.attr("text-anchor", "middle")
			.attr("dy", -3)
			.text((d) => d.type);

		// Nodes
		const nodeGroup = g
			.append("g")
			.selectAll("g")
			.data(nodes)
			.enter()
			.append("g")
			.style("cursor", "pointer")
			.call(
				d3
					.drag<SVGGElement, GraphNode>()
					.on("start", (event: any, d) => {
						if (!event.active) this.simulation?.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on("drag", (event: any, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on("end", (event: any, d) => {
						if (!event.active) this.simulation?.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					}) as any,
			);

		// Isolated high-potential glow
		nodeGroup
			.filter((d) => d.isIsolated && d.morphicScore >= 0.35)
			.append("circle")
			.attr("r", (d) => this.nodeRadius(d) + 10)
			.attr("fill", "none")
			.attr("stroke", "#e74c3c")
			.attr("stroke-width", 2)
			.attr("stroke-opacity", 0.3)
			.append("animate")
			.attr("attributeName", "stroke-opacity")
			.attr("values", "0.1;0.5;0.1")
			.attr("dur", "2s")
			.attr("repeatCount", "indefinite");

		// Node circles
		nodeGroup
			.append("circle")
			.attr("r", (d) => this.nodeRadius(d))
			.attr("fill", (d) => {
				const base = TYPE_COLORS[d.card.semanticType] || "#7f8c8d";
				if (d.isForeign) {
					return base + "60"; // Alpha desaturation for foreign-only nodes
				}
				return base;
			})
			.attr("stroke", (d) => {
				if (d.isForeign) return "#95a5a6";
				if (d.isIsolated) return d.morphicScore >= 0.35 ? "#e74c3c" : "#bdc3c7";
				return "#fff";
			})
			.attr("stroke-width", (d) => {
				if (d.provenance.length > 1) return 2.5; // Multi-user: thicker
				return d.isForeign ? 1.5 : d.isIsolated ? 2 : 1.5;
			})
			.attr("stroke-dasharray", (d) => {
				if (d.isForeign) return "4,2";
				if (d.provenance.length > 1) return "6,2"; // Multi-user: larger dashes
				return "none";
			})
			.attr("opacity", (d) => (d.isForeign ? 0.7 : d.isIsolated && d.morphicScore < 0.35 ? 0.4 : 1));

		// Provenance badge: show count of users who have this URL
		nodeGroup
			.filter((d) => d.provenance.length > 1)
			.append("circle")
			.attr("cx", (d) => this.nodeRadius(d) - 2)
			.attr("cy", (d) => -this.nodeRadius(d) + 2)
			.attr("r", 7)
			.attr("fill", "#3498db")
			.attr("stroke", "#fff")
			.attr("stroke-width", 1);

		nodeGroup
			.filter((d) => d.provenance.length > 1)
			.append("text")
			.attr("x", (d) => this.nodeRadius(d) - 2)
			.attr("y", (d) => -this.nodeRadius(d) + 5)
			.attr("text-anchor", "middle")
			.attr("font-size", "8px")
			.attr("fill", "#fff")
			.attr("font-weight", "bold")
			.text((d) => String(d.provenance.length));

		// Note count badge (only for local URL cards with annotations)
		nodeGroup
			.filter((d) => !d.isForeign && d.noteCount > 0 && d.provenance.length <= 1)
			.append("circle")
			.attr("cx", (d) => this.nodeRadius(d) - 2)
			.attr("cy", (d) => -this.nodeRadius(d) + 2)
			.attr("r", 7)
			.attr("fill", "#f39c12")
			.attr("stroke", "#fff")
			.attr("stroke-width", 1);

		nodeGroup
			.filter((d) => d.provenance.length <= 1 && d.noteCount > 0)
			.append("text")
			.attr("x", (d) => this.nodeRadius(d) - 2)
			.attr("y", (d) => -this.nodeRadius(d) + 5)
			.attr("text-anchor", "middle")
			.attr("font-size", "8px")
			.attr("fill", "#fff")
			.attr("font-weight", "bold")
			.text((d) => (d.noteCount > 9 ? "9+" : String(d.noteCount)));

		// Node labels
		nodeGroup
			.append("text")
			.attr("dy", (d) => this.nodeRadius(d) + 12)
			.attr("text-anchor", "middle")
			.attr("font-size", (d) => (d.isForeign ? "9px" : "10px"))
			.attr("fill", (d) => (d.isForeign ? "var(--text-faint)" : "var(--text-normal)"))
			.attr("font-style", (d) => (d.isForeign ? "italic" : "normal"))
			.text((d) => {
				const label = d.card.title.slice(0, 20) + (d.card.title.length > 20 ? "…" : "");
				if (d.isForeign && d.provenance.length > 0) {
					const handle = d.provenance[0].handle;
					return `[${handle}] ${label}`;
				}
				return label;
			});

		// Community foam hulls (no floating labels — they overlap nodes on small graphs)
		const communityGroup = g.insert("g", ":first-child").attr("class", "semblage-communities");
		const communityIds = Array.from(new Set(communities.values()));

		for (const cid of communityIds) {
			const label = communityLabels.get(cid);
			if (!label || label.length === 0) continue;

			const color = FOAM_COLORS[cid % FOAM_COLORS.length];

			// Hull path (will be updated on tick)
			communityGroup
				.append("path")
				.attr("fill", color)
				.attr("fill-opacity", 0.06)
				.attr("stroke", color)
				.attr("stroke-opacity", 0.15)
				.attr("stroke-width", 1)
				.attr("stroke-dasharray", "4,3");
		}

		// Hover tooltip — reuse existing one if present
		let tooltip = d3.select(this.contentEl).select<HTMLDivElement>("div.semblage-graph-tooltip");
		if (tooltip.empty()) {
			tooltip = d3
				.select(this.contentEl)
				.append("div")
				.attr("class", "semblage-graph-tooltip")
				.style("position", "absolute")
				.style("visibility", "hidden")
				.style("background", "var(--background-primary)")
				.style("border", "1px solid var(--background-modifier-border)")
				.style("border-radius", "4px")
				.style("padding", "8px")
				.style("font-size", "11px")
				.style("pointer-events", "none")
				.style("z-index", "100");
		}

		nodeGroup
			.on("mouseover", (event: any, d: GraphNode) => {
				tooltip
					.style("visibility", "visible")
					.html(this.nodeTooltip(d));
			})
			.on("mousemove", (event: any) => {
				tooltip.style("top", event.pageY - 10 + "px").style("left", event.pageX + 10 + "px");
			})
			.on("mouseout", () => {
				tooltip.style("visibility", "hidden");
			})
			.on("click", (event: any, d: GraphNode) => {
				this.openSidePanel(d);
			});

		// Tick
		let tickCount = 0;
		this.simulation.on("tick", () => {
			linkGroup
				.attr("x1", (d: any) => (d.source as GraphNode).x!)
				.attr("y1", (d: any) => (d.source as GraphNode).y!)
				.attr("x2", (d: any) => (d.target as GraphNode).x!)
				.attr("y2", (d: any) => (d.target as GraphNode).y!);

			labelGroup
				.attr("x", (d: any) => (((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2))
				.attr("y", (d: any) => (((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2));

			nodeGroup.attr("transform", (d: GraphNode) => `translate(${d.x},${d.y})`);

			tickCount++;
			// Throttle expensive hull/centroid updates to every 10 ticks to keep frame rate healthy
			if (tickCount % 10 !== 0) return;

			// Update community hulls & labels
			for (const cid of communityIds) {
				const members = nodes.filter((n) => communities.get(n.id) === cid);
				if (members.length < 2) continue;

				// Update centroid for clustering force
				const cx = members.reduce((sum, n) => sum + n.x!, 0) / members.length;
				const cy = members.reduce((sum, n) => sum + n.y!, 0) / members.length;
				communityCentroids.set(cid, { x: cx, y: cy });

				// Compute convex hull
				const points = members.map((n) => [n.x!, n.y!] as [number, number]);
				const hull = d3.polygonHull(points);

				// Update hull path
				const paths = communityGroup.selectAll<SVGPathElement, unknown>("path").nodes();
				if (paths[cid]) {
					const padded = hull
						? d3.polygonHull(hull.map((p) => [p[0], p[1]]))
						: points;
					if (padded && padded.length > 2) {
						// Smooth rounded hull using circle approximation
						const radius = 40;
						const pathData = roundedHullPath(padded, radius);
						d3.select(paths[cid]).attr("d", pathData);
					}
				}
			}
		});
		console.timeEnd("[Semblage] render: D3 setup + DOM insertion");
		console.timeEnd("[Semblage] renderGraph: total");
	}

	nodeRadius(d: GraphNode): number {
		if (d.isIsolated) return 6 + d.morphicScore * 8;
		return 6 + Math.sqrt(d.degree) * 3;
	}

	nodeTooltip(d: GraphNode): string {
		let html = `<strong>${d.card.title}</strong><br>`;
		html += `Type: ${d.card.semanticType}<br>`;
		html += `Degree: ${d.degree}`;
		if (d.noteCount > 0) {
			html += ` · Notes: ${d.noteCount}`;
		}
		html += `<br>`;
		if (d.provenance.length > 1) {
			const handles = d.provenance.map((p) => p.handle).join(", ");
			html += `<span style="color:#3498db">Clipped by: ${handles}</span><br>`;
		} else if (d.isForeign) {
			html += `<span style="color:#95a5a6;font-style:italic">Imported from ${d.provenance[0]?.handle || "unknown"}</span><br>`;
		}
		if (d.isIsolated) {
			html += `<span style="color:#e74c3c">Isolated</span>`;
			if (d.morphicScore > 0) {
				html += ` · Morphic potential: ${(d.morphicScore * 100).toFixed(0)}%`;
			}
		}
		return html;
	}

	openSidePanel(d: GraphNode) {
		this.selectedCardUri = d.card.uri;
		if (!this.sidePanel) return;

		this.sidePanel.removeClass("hidden");
		this.sidePanel.empty();

		const closeBtn = this.sidePanel.createEl("button", {
			text: "×",
			cls: "semblage-graph-sidepanel-close",
		});
		closeBtn.addEventListener("click", () => this.closeSidePanel());

		// Card identity
		const identity = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
		identity.createEl("h4", { text: d.card.title, cls: "semblage-sidepanel-title" });
		identity.createEl("span", {
			text: d.card.semanticType,
			cls: "semblage-sidepanel-type",
		});
		if (d.card.subtitle) {
			identity.createEl("div", { text: d.card.subtitle, cls: "semblage-sidepanel-subtitle" });
		}
		const desc = d.card.record.content;
		if ((desc as any)?.metadata?.description) {
			identity.createEl("div", {
				text: (desc as any).metadata.description,
				cls: "semblage-sidepanel-desc",
			});
		}
		if (d.card.url) {
			const btnRow = identity.createDiv({ cls: "semblage-sidepanel-btn-row" });
			const urlBtn = btnRow.createEl("button", { text: "Open URL", cls: "semblage-sidepanel-btn" });
			urlBtn.addEventListener("click", () => window.open(d.card.url, "_blank"));
			const copyBtn = btnRow.createEl("button", { text: "Copy URL", cls: "semblage-sidepanel-btn" });
			copyBtn.addEventListener("click", () => {
				navigator.clipboard.writeText(d.card.url!).then(() => {
					copyBtn.textContent = "Copied ✓";
					setTimeout(() => { copyBtn.textContent = "Copy URL"; }, 1500);
				});
			});
		}

		// Provenance — segmented by follow status
		if (d.provenance.length > 0) {
			const following: ProvenanceEntry[] = [];
			const notFollowing: ProvenanceEntry[] = [];
			console.log(`[Semblage] Provenance segmentation for "${d.card.url || d.card.uri}":`);
			console.log(`[Semblage]   foreignCards keys:`, [...this.foreignCards.keys()]);
			for (const entry of d.provenance) {
				const entryDid = extractDid(entry.aturi);
				const isSelf = entryDid === this.did;
				const isImported = this.foreignCards.has(entryDid);
				console.log(`[Semblage]   entry: handle=${entry.handle}, did=${entryDid}, isSelf=${isSelf}, isImported=${isImported}`);
				// Use foreignCards as ground truth — if their cards were imported, they're followed
				if (isSelf || isImported) {
					following.push(entry);
				} else {
					notFollowing.push(entry);
				}
			}

			const prov = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			prov.createEl("h5", { text: "Provenance" });

			if (following.length > 0) {
				const fSection = prov.createDiv({ cls: "semblage-sidepanel-provenance-group" });
				fSection.createEl("div", { text: "Following", cls: "semblage-sidepanel-empty" });
				for (const entry of following) {
					const row = fSection.createDiv({ cls: "semblage-sidepanel-provenance" });
					const handleEl = row.createEl("span", { text: entry.handle, cls: "semblage-sidepanel-handle-link" });
					handleEl.addEventListener("click", () => {
						window.open(`https://semble.so/profile/${entry.handle}`, "_blank");
					});
					const didEl = row.createEl("code", { text: extractDid(entry.aturi).slice(0, 24) + "…", cls: "semblage-sidepanel-aturi" });
					didEl.style.fontSize = "0.75em";
					didEl.style.color = "var(--text-faint)";
				}
			}

			if (notFollowing.length > 0) {
				const nfSection = prov.createDiv({ cls: "semblage-sidepanel-provenance-group" });
				nfSection.createEl("div", { text: "Not following", cls: "semblage-sidepanel-empty" });
				for (const entry of notFollowing) {
					const entryDid = extractDid(entry.aturi);
					const row = nfSection.createDiv({ cls: "semblage-sidepanel-provenance" });
					const handleEl = row.createEl("span", { text: entry.handle, cls: "semblage-sidepanel-handle-link" });
					handleEl.addEventListener("click", () => {
						window.open(`https://semble.so/profile/${entry.handle}`, "_blank");
					});
					const followBtn = row.createEl("button", { text: "Follow", cls: "semblage-sidepanel-btn" });
					followBtn.style.marginLeft = "6px";
					followBtn.addEventListener("click", async () => {
						followBtn.textContent = "Following...";
						followBtn.setAttribute("disabled", "true");
						try {
							await createFollow(this.client, this.did, entryDid);
							new Notice(`Now following ${entry.handle}`);
							followBtn.textContent = "Followed ✓";
							this.loadData();
						} catch (e) {
							new Notice("Failed to follow: " + (e instanceof Error ? e.message : String(e)));
							followBtn.textContent = "Follow";
							followBtn.removeAttribute("disabled");
						}
					});
				}
			}
		}

		// Existing morphisms (local + foreign)
		const existing = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
		existing.createEl("h5", { text: "Morphisms" });

		// Gather all connections (local + foreign)
		const allConnections = [...this.connections];
		for (const conns of this.foreignConnections.values()) {
			allConnections.push(...conns);
		}
		// Build a lookup for resolving card references across local + foreign
		const allCards: CardWithMeta[] = [...this.cards];
		for (const cards of this.foreignCards.values()) {
			allCards.push(...cards);
		}

		const outgoing = allConnections.filter((c) => c.record.source === d.card.uri || c.record.source === d.card.url);
		const incoming = allConnections.filter((c) => c.record.target === d.card.uri || c.record.target === d.card.url);

		if (outgoing.length === 0 && incoming.length === 0) {
			existing.createEl("div", { text: "No morphisms yet.", cls: "semblage-sidepanel-empty" });
		} else {
			for (const edge of outgoing) {
				const target = resolveCardReference(edge.record.target, allCards);
				const row = existing.createDiv({ cls: "semblage-sidepanel-morphism" });
				row.createEl("span", { text: `${edge.record.connectionType || "related"} → ` });
				const targetEl = row.createEl("span", { text: target?.title || edge.record.target, cls: "semblage-sidepanel-link" });
				targetEl.addEventListener("click", () => {
					if (target) this.scrollToCard(target.uri);
				});
				if (edge.record.note) {
					row.createEl("span", { text: ` "${edge.record.note}"`, cls: "semblage-sidepanel-note" });
				}
			}
			for (const edge of incoming) {
				const source = resolveCardReference(edge.record.source, allCards);
				const row = existing.createDiv({ cls: "semblage-sidepanel-morphism" });
				const sourceEl = row.createEl("span", { text: source?.title || edge.record.source, cls: "semblage-sidepanel-link" });
				sourceEl.addEventListener("click", () => {
					if (source) this.scrollToCard(source.uri);
				});
				row.createEl("span", { text: ` → ${edge.record.connectionType || "related"}` });
				if (edge.record.note) {
					row.createEl("span", { text: ` "${edge.record.note}"`, cls: "semblage-sidepanel-note" });
				}
			}
		}

		// Morphic potential (for isolated cards)
		if (d.isIsolated) {
			const cardCandidates = this.candidates
				.filter((c) => c.source === d.card.uri)
				.sort((a, b) => b.score - a.score);

			if (cardCandidates.length > 0) {
				const potential = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
				potential.createEl("h5", { text: "Morphic Potential" });

				for (const candidate of cardCandidates.slice(0, 3)) {
					const otherUri = candidate.source === d.card.uri ? candidate.target : candidate.source;
					const otherCard = this.cards.find((c) => c.uri === otherUri);
					const scorePCT = (candidate.score * 100).toFixed(0);

					const candidateEl = potential.createDiv({ cls: "semblage-sidepanel-candidate" });
					candidateEl.createEl("div", {
						text: `${scorePCT}% match with ${otherCard?.title || otherUri.slice(-20)}`,
						cls: "semblage-sidepanel-candidate-title",
					});

					// Heuristic breakdown bars
					const bars = candidateEl.createDiv({ cls: "semblage-sidepanel-heuristics" });
					for (const [key, value] of Object.entries(candidate.heuristics)) {
						if (value <= 0) continue;
						const label = HEURISTIC_LABELS[key] || key;
						const row = bars.createDiv({ cls: "semblage-sidepanel-heuristic" });
						row.createEl("span", { text: label, cls: "semblage-sidepanel-heuristic-label" });
						const barBg = row.createDiv({ cls: "semblage-sidepanel-heuristic-bar-bg" });
						const barFill = barBg.createDiv({ cls: "semblage-sidepanel-heuristic-bar-fill" });
						barFill.style.width = `${(value * 100).toFixed(0)}%`;
						row.createEl("span", { text: value.toFixed(2), cls: "semblage-sidepanel-heuristic-value" });
					}

					const connectBtn = candidateEl.createEl("button", { text: "Create morphism", cls: "semblage-sidepanel-btn" });
					connectBtn.addEventListener("click", () => {
						this.createConnectionFromCandidate(candidate);
					});
				}
			}
		}

		// Actions
		if (!d.isForeign) {
			const actions = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			const connectBtn = actions.createEl("button", { text: "+ Connect to another card", cls: "semblage-sidepanel-btn primary" });
			connectBtn.addEventListener("click", () => {
				new ConnectionModal(this.app, this.client, this.did, this.cards, d.card.uri, undefined, () => this.loadData()).open();
			});
		} else {
			const actions = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			actions.createEl("div", {
				text: "Imported card — create morphisms from your own cards to this one.",
				cls: "semblage-sidepanel-empty",
			});
			const connectBtn = actions.createEl("button", { text: "+ Connect from my card", cls: "semblage-sidepanel-btn primary" });
			connectBtn.addEventListener("click", () => {
				new ConnectionModal(this.app, this.client, this.did, this.cards, undefined, d.card.uri, () => this.loadData()).open();
			});
		}
	}

	async discoverPeople() {
		if (this.discoveringPeople) {
			new Notice("Discovery already running...");
			return;
		}
		if (this.lastCommunities.size === 0) {
			new Notice("Load the graph first before discovering people.");
			return;
		}

		this.discoveringPeople = true;
		this.refreshEl.textContent += " · Discovering...";

		try {
			// Build node data for interesting node identification
			const nodeData = Array.from(this.lastCommunities.entries()).map(([nodeId]) => {
				// Find degree and provenance from the graph data
				const degree = 0; // Will be computed inside identifyInterestingNodes
				// We need to reconstruct provenance from the urlMap — but that's local to renderGraph
				// Instead, use the cards we have
				const card = this.cards.find((c) => c.uri === nodeId || c.url === nodeId);
				const foreignCard = Array.from(this.foreignCards.values()).flat().find((c) => c.uri === nodeId || c.url === nodeId);
				const provenance: ProvenanceEntry[] = [];
				if (card) {
					const localHandle = this.handleCache[this.did] || "you";
					provenance.push({ aturi: card.uri, handle: localHandle });
				}
				if (foreignCard) {
					const foreignDid = extractDid(foreignCard.uri);
					const handle = this.handleCache[foreignDid] || foreignDid.slice(0, 15) + "…";
					provenance.push({ aturi: foreignCard.uri, handle });
				}
				return { id: nodeId, degree: 0, provenance };
			});

			// Build links for cross-community edge counting
			const linksData = this.connections
				.map((c) => ({ source: c.record.source, target: c.record.target }))
				.concat(
					Array.from(this.foreignConnections.values()).flat().map((c) => ({
						source: c.record.source,
						target: c.record.target,
					})),
				);

			// Identify interesting nodes
			const interestingNodes = identifyInterestingNodes(
				this.lastCommunities,
				nodeData,
				linksData,
			);

			console.log(`[Semblage] Discovery: ${interestingNodes.length} interesting nodes identified`);

			// Build nodeCardMap for discovery
			const nodeCardMap = new Map<string, CardWithMeta>();
			for (const card of this.cards) {
				if (card.url) nodeCardMap.set(card.url, card);
				nodeCardMap.set(card.uri, card);
			}
			for (const cards of this.foreignCards.values()) {
				for (const card of cards) {
					if (card.url) nodeCardMap.set(card.url, card);
					nodeCardMap.set(card.uri, card);
				}
			}

			// Get current follows
			const { listFollows } = await import("../api/cosmik-api");
			const follows = await listFollows(this.client, this.did);

			// Run discovery pipeline
			const candidates = await discoverCandidates(
				interestingNodes,
				nodeCardMap,
				[this.did, ...follows],
				this.foreignCards,
				this.client,
				this.handleCache,
				(phase, done, total) => {
					if (done % 5 === 0 || done === total) {
						console.log(`[Semblage] Discovery ${phase}: ${done}/${total}`);
					}
				},
			);

			this.discoveredCandidates = candidates;
			console.log(`[Semblage] Discovery: ${candidates.length} candidates found`);

			// Show results in side panel
			this.renderDiscoverPanel(candidates);

			if (candidates.length === 0) {
				new Notice("No new people discovered — your network is already well-connected!");
			}
		} catch (e) {
			console.error("[Semblage] Discovery failed:", e);
			new Notice("Discovery failed: " + (e instanceof Error ? e.message : String(e)));
		} finally {
			this.discoveringPeople = false;
			// Re-render status without the "Discovering..." text
			this.renderGraph();
		}
	}

	renderDiscoverPanel(candidates: DiscoverCandidate[]) {
		if (!this.sidePanel) return;

		this.sidePanel.removeClass("hidden");
		this.sidePanel.empty();

		const closeBtn = this.sidePanel.createEl("button", {
			text: "×",
			cls: "semblage-graph-sidepanel-close",
		});
		closeBtn.addEventListener("click", () => this.closeSidePanel());

		const header = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
		header.createEl("h4", { text: "Discover People", cls: "semblage-sidepanel-title" });

		if (candidates.length === 0) {
			header.createEl("div", {
				text: "No new people found. Try following more users or adding more cards.",
				cls: "semblage-sidepanel-empty",
			});
			return;
		}

		header.createEl("div", {
			text: `${candidates.length} people share cards with your communities`,
			cls: "semblage-sidepanel-empty",
		});

		// Group by community overlap
		const byCommunity = new Map<number, DiscoverCandidate[]>();
		for (const c of candidates) {
			for (const commId of c.communityOverlap) {
				if (!byCommunity.has(commId)) byCommunity.set(commId, []);
				byCommunity.get(commId)!.push(c);
			}
		}
		// Also add candidates with no community overlap
		const ungrouped = candidates.filter((c) => c.communityOverlap.length === 0);

		for (const [commId, commCandidates] of byCommunity) {
			const labels = this.lastCommunityLabels.get(commId) || [];
			const section = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			section.createEl("h5", {
				text: labels.length > 0 ? labels.join(", ") : `Community ${commId}`,
			});

			for (const candidate of commCandidates) {
				this.renderCandidateRow(section, candidate);
			}
		}

		if (ungrouped.length > 0) {
			const section = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			section.createEl("h5", { text: "Other shared cards" });
			for (const candidate of ungrouped) {
				this.renderCandidateRow(section, candidate);
			}
		}
	}

	private renderCandidateRow(container: HTMLElement, candidate: DiscoverCandidate) {
		const row = container.createDiv({ cls: "semblage-sidepanel-provenance" });

		// Handle link
		const handleEl = row.createEl("span", {
			text: candidate.handle,
			cls: "semblage-sidepanel-handle-link",
		});
		handleEl.addEventListener("click", () => {
			window.open(`https://semble.so/profile/${candidate.handle}`, "_blank");
		});

		// Source badge
		const sourceLabel = candidate.source === "provenance" ? "via provenance" : "follow-of-follow";
		row.createEl("span", {
			text: ` · ${sourceLabel}`,
			cls: "semblage-sidepanel-empty",
		});

		// Shared cards count
		if (candidate.sharedCards.length > 0) {
			const sharedEl = row.createEl("div", { cls: "semblage-sidepanel-empty" });
			sharedEl.style.fontSize = "0.85em";
			sharedEl.createEl("span", { text: `${candidate.sharedCards.length} shared card${candidate.sharedCards.length !== 1 ? "s" : ""}: ` });
			const titles = candidate.sharedCards.slice(0, 3).map((c) => c.title.slice(0, 25) + (c.title.length > 25 ? "…" : ""));
			sharedEl.createEl("span", { text: titles.join(", ") });
		}

		// Follow button
		const followBtn = row.createEl("button", {
			text: "Follow",
			cls: "semblage-sidepanel-btn primary",
		});
		followBtn.style.marginTop = "4px";
		followBtn.addEventListener("click", async () => {
			followBtn.textContent = "Following...";
			followBtn.setAttribute("disabled", "true");
			try {
				await createFollow(this.client, this.did, candidate.did);
				new Notice(`Now following ${candidate.handle}`);
				followBtn.textContent = "Followed ✓";
				// Refresh graph to pull in the new follow's cards
				this.loadData();
			} catch (e) {
				new Notice("Failed to follow: " + (e instanceof Error ? e.message : String(e)));
				followBtn.textContent = "Follow";
				followBtn.removeAttribute("disabled");
			}
		});
	}

	closeSidePanel() {
		this.selectedCardUri = null;
		if (this.sidePanel) {
			this.sidePanel.addClass("hidden");
			this.sidePanel.empty();
		}
	}

	createConnectionFromCandidate(candidate: MorphismCandidate) {
		new ConnectionModal(this.app, this.client, this.did, this.cards, candidate.source, candidate.target, () => {
			this.loadData();
		}).open();
	}

	createSuggestion(candidate: MorphismCandidate) {
		new ConnectionModal(this.app, this.client, this.did, this.cards, candidate.source, candidate.target, () => {
			this.loadData();
		}).open();
	}

	scrollToCard(uri: string) {
		const el = this.contentEl.querySelector(`[data-uri="${CSS.escape(uri)}"]`);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	async onClose() {
		this.foreignCache.close();
		this.simulation?.stop();
		this.contentEl.empty();
	}
}
