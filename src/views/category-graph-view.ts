import { ItemView, WorkspaceLeaf, Notice, App } from "obsidian";
import type { Client } from "@atcute/client";
import type { CardWithMeta, ConnectionEdge } from "../types";
import { resolveCardReference } from "../api/cosmik-api";
import { discoverMorphismCandidates, type MorphismCandidate } from "../engine/morphism-heuristics";
import { ConnectionModal } from "../modals/connection-modal";
import * as d3 from "d3";

import { loadHandleCache, saveHandleCache, extractDid } from "../util/handle-cache";

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
	private width = 800;
	private height = 600;
	private sidePanel: HTMLElement | null = null;
	private graphContainer: HTMLElement | null = null;
	private selectedCardUri: string | null = null;
	private handleCache: Record<string, string> = {};
	private plugin: any;

	private computingCandidates = false;

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

		await this.loadData();

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
		refreshBtn.addEventListener("click", () => this.loadData());

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
	}

	setAuth(did: string) {
		this.did = did;
	}

	async loadData() {
		if (!this.did) {
			this.refreshEl.textContent = "Not logged in";
			return;
		}
		this.refreshEl.textContent = "Loading...";
		this.candidates = []; // reset
		this.computingCandidates = false;
		console.log("[Semblage] ========== loadData() start ==========");
		console.time("[Semblage] loadData: total");

		try {
			const { listCards, listConnections, listFollows, fetchForeignCards, resolveHandles } = await import("../api/cosmik-api");

			// 1. Parallel local data fetch
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

			// 2. Render local graph immediately (fast!)
			console.time("[Semblage] RENDER: local first paint");
			this.updateStatus(follows.length, 0, 0);
			this.renderGraph();
			console.timeEnd("[Semblage] RENDER: local first paint");

			// 3. Background: compute morphism candidates after first paint
			this.computeCandidatesInBackground();

			// 4. Background: fetch ALL follows in parallel
			this.foreignCards.clear();
			this.foreignConnections.clear();

			const handleCache = await loadHandleCache(this.plugin);

			console.time("[Semblage] API: foreign fetch");
			const foreignResults = await Promise.allSettled(
				follows.map(async (foreignDid) => {
					try {
						const foreign = await fetchForeignCards(this.client, foreignDid);
						return { did: foreignDid, ...foreign };
					} catch (e) {
						console.warn(`Failed to fetch from ${foreignDid}:`, e);
						return null;
					}
				}),
			);
			console.timeEnd("[Semblage] API: foreign fetch");

			let importedCount = 0;
			const allForeignDids: string[] = [];
			let successCount = 0;
			for (const result of foreignResults) {
				if (result.status === "fulfilled" && result.value) {
					const { did, cards, connections } = result.value;
					this.foreignCards.set(did, cards);
					this.foreignConnections.set(did, connections);
					importedCount += cards.length;
					allForeignDids.push(did);
					successCount++;
				}
			}
			console.log(`[Semblage]   → ${successCount}/${follows.length} follows imported, ${importedCount} cards total`);

			// 5. Parallel handle resolution for all imported DIDs
			console.time("[Semblage] handle resolution");
			if (allForeignDids.length > 0) {
				this.handleCache = await resolveHandles(this.client, allForeignDids, handleCache);
				await saveHandleCache(this.plugin, this.handleCache);
			}
			console.timeEnd("[Semblage] handle resolution");

			// 6. Re-render with foreign data
			console.time("[Semblage] RENDER: with foreign data");
			this.updateStatus(follows.length, importedCount, successCount);
			this.renderGraph();
			console.timeEnd("[Semblage] RENDER: with foreign data");

			// 7. Re-compute candidates now that foreign data is loaded
			this.computeCandidatesInBackground();
		} catch (e) {
			this.refreshEl.textContent = "Error loading";
			new Notice("Failed to load graph: " + (e instanceof Error ? e.message : String(e)));
		} finally {
			console.timeEnd("[Semblage] loadData: total");
			console.log("[Semblage] ========== loadData() end ==========");
		}
	}

	private computeCandidatesInBackground() {
		if (this.computingCandidates) return;
		this.computingCandidates = true;

		// Defer to next tick so UI isn't blocked
		setTimeout(() => {
			try {
				console.time("[Semblage] HEURISTICS: discoverMorphismCandidates");
				this.candidates = discoverMorphismCandidates(this.cards, this.connections, 0.35, 3);
				console.timeEnd("[Semblage] HEURISTICS: discoverMorphismCandidates");
				console.log(`[Semblage]   → ${this.candidates.length} candidates found`);
				// Re-render to show suggestion edges and morphic scores
				console.time("[Semblage] RENDER: post-candidates update");
				this.renderGraph();
				console.timeEnd("[Semblage] RENDER: post-candidates update");
			} catch (e) {
				console.error("Failed to compute morphism candidates:", e);
			} finally {
				this.computingCandidates = false;
			}
		}, 0);
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
		console.time("[Semblage] renderGraph: total");
		this.svg.selectAll("*").remove();
		this.updateDimensions();

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

		// Filter: keep foreign cards with degree > 0 only
		// Keep local cards with degree > 0, or isolated ones with candidate score >= 0.35
		nodes = nodes.filter((n) => {
			if (n.isForeign) return n.degree > 0;
			if (n.degree > 0) return true;
			// Show isolated local nodes if they have candidate score >= 0.35
			return n.morphicScore >= 0.35;
		});

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
		// Simulation
		this.simulation = d3
			.forceSimulation<GraphNode>(nodes)
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

		// Community foam hulls & labels
		const communityGroup = g.insert("g", ":first-child").attr("class", "semblage-communities");
		const communityIds = Array.from(new Set(communities.values()));

		for (const cid of communityIds) {
			const label = communityLabels.get(cid);
			if (!label || label.length === 0) continue;

			const hullData = { cid, label: label.join(", ") };
			const color = FOAM_COLORS[cid % FOAM_COLORS.length];

			// Hull path (will be updated on tick)
			const hull = communityGroup
				.append("path")
				.attr("fill", color)
				.attr("fill-opacity", 0.06)
				.attr("stroke", color)
				.attr("stroke-opacity", 0.15)
				.attr("stroke-width", 1)
				.attr("stroke-dasharray", "4,3");

			// Community label at centroid
			const labelG = communityGroup.append("g").attr("class", "semblage-community-label");

			const text = labelG
				.append("text")
				.attr("font-size", "11px")
				.attr("font-weight", "600")
				.attr("fill", color)
				.attr("fill-opacity", 0.75)
				.attr("text-anchor", "middle")
				.text(hullData.label);

			// Background pill for readability
			const bbox = (text.node() as SVGTextElement)?.getBBox();
			if (bbox) {
				labelG
					.insert("rect", "text")
					.attr("x", bbox.x - 6)
					.attr("y", bbox.y - 2)
					.attr("width", bbox.width + 12)
					.attr("height", bbox.height + 4)
					.attr("rx", 4)
					.attr("fill", "var(--background-primary)")
					.attr("fill-opacity", 0.85)
					.attr("stroke", color)
					.attr("stroke-opacity", 0.2)
					.attr("stroke-width", 0.5);
			}
		}

		// Hover tooltip
		const tooltip = d3
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
				const hullSelection = communityGroup.selectAll<SVGPathElement, unknown>("path");
				// Match by data index. Simpler: just use nth-of-kind matching
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

				// Update label position
				const labels = communityGroup.selectAll<SVGGElement, unknown>("g.semblage-community-label").nodes();
				if (labels[cid]) {
					d3.select(labels[cid]).attr("transform", `translate(${cx},${cy - 20})`);
				}
			}

			// Reheat clustering force with updated centroids
			this.simulation!.force(
				"cluster",
				d3
					.forceX<GraphNode>((d) => {
						const c = communities.get(d.id);
						if (c === undefined) return this.width / 2;
						const cen = communityCentroids.get(c);
						return cen ? cen.x : this.width / 2;
					})
					.strength(0.02),
			);
			this.simulation!.force(
				"clusterY",
				d3
					.forceY<GraphNode>((d) => {
						const c = communities.get(d.id);
						if (c === undefined) return this.height / 2;
						const cen = communityCentroids.get(c);
						return cen ? cen.y : this.height / 2;
					})
					.strength(0.02),
			);
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
			const urlBtn = identity.createEl("button", { text: "Open URL", cls: "semblage-sidepanel-btn" });
			urlBtn.addEventListener("click", () => window.open(d.card.url, "_blank"));
		}

		// Provenance
		if (d.provenance.length > 0) {
			const prov = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
			prov.createEl("h5", { text: "Provenance" });
			for (const entry of d.provenance) {
				const row = prov.createDiv({ cls: "semblage-sidepanel-provenance" });
				const handleEl = row.createEl("span", { text: entry.handle, cls: "semblage-sidepanel-handle-link" });
				handleEl.addEventListener("click", () => {
					window.open(`https://semble.so/profile/${entry.handle}`, "_blank");
				});
				row.createEl("span", { text: " " });
				const aturiEl = row.createEl("code", { text: entry.aturi.slice(0, 40) + "…", cls: "semblage-sidepanel-aturi" });
				aturiEl.style.fontSize = "0.75em";
				aturiEl.style.color = "var(--text-faint)";
			}
		}

		// Existing morphisms
		const existing = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
		existing.createEl("h5", { text: "Morphisms" });

		const outgoing = this.connections.filter((c) => c.record.source === d.card.uri || c.record.source === d.card.url);
		const incoming = this.connections.filter((c) => c.record.target === d.card.uri || c.record.target === d.card.url);

		if (outgoing.length === 0 && incoming.length === 0) {
			existing.createEl("div", { text: "No morphisms yet.", cls: "semblage-sidepanel-empty" });
		} else {
			for (const edge of outgoing) {
				const target = resolveCardReference(edge.record.target, this.cards);
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
				const source = resolveCardReference(edge.record.source, this.cards);
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
		this.simulation?.stop();
		this.contentEl.empty();
	}
}
