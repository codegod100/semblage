import { ItemView, WorkspaceLeaf, Notice, App } from "obsidian";
import type { Client } from "@atcute/client";
import type { CardWithMeta, ConnectionEdge } from "../types";
import { resolveCardReference } from "../api/cosmik-api";
import { discoverMorphismCandidates, type MorphismCandidate } from "../engine/morphism-heuristics";
import { ConnectionModal } from "../modals/connection-modal";
import * as d3 from "d3";

export const VIEW_TYPE_CATEGORY_GRAPH = "semblage-category-graph";

interface GraphNode extends d3.SimulationNodeDatum {
	id: string;
	card: CardWithMeta;
	degree: number;
	isIsolated: boolean;
	morphicScore: number;
	noteCount: number;
	isForeign: boolean;
	sourceDid?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
	source: string | GraphNode;
	target: string | GraphNode;
	type: string;
	isSuggestion: boolean;
	isForeign: boolean;
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

	constructor(leaf: WorkspaceLeaf, client: Client, did: string) {
		super(leaf);
		this.client = client;
		this.did = did;
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
		this.refreshEl.textContent = "Computing morphisms...";
		try {
			const { listCards, listConnections, listFollows, fetchForeignCards } = await import("../api/cosmik-api");
			this.cards = await listCards(this.client, this.did);
			this.connections = await listConnections(this.client, this.did);
			this.candidates = discoverMorphismCandidates(this.cards, this.connections, 0.35, 3);

			// Fetch followed users' data (functors)
			const follows = await listFollows(this.client, this.did);
			this.foreignCards.clear();
			this.foreignConnections.clear();
			for (const foreignDid of follows.slice(0, 5)) { // Limit to 5 followed users
				try {
					const foreign = await fetchForeignCards(this.client, foreignDid);
					this.foreignCards.set(foreignDid, foreign.cards);
					this.foreignConnections.set(foreignDid, foreign.connections);
				} catch (e) {
					console.warn(`Failed to fetch cards from ${foreignDid}:`, e);
				}
			}

			const urlCount = this.cards.filter((c) => c.record.type === "URL").length;
			const noteCount = this.cards.filter((c) => c.record.type === "NOTE").length;
			const foreignCount = Array.from(this.foreignCards.values()).reduce((sum, cards) => sum + cards.length, 0);
			this.refreshEl.textContent = `${urlCount} objects · ${noteCount} notes · ${this.connections.length} morphisms · ${this.candidates.length} suggestions · ${follows.length} followed · ${foreignCount} imported`;
			this.renderGraph();
		} catch (e) {
			this.refreshEl.textContent = "Error loading";
			new Notice("Failed to load graph: " + (e instanceof Error ? e.message : String(e)));
		}
	}

	renderGraph() {
		if (!this.svg || !this.graphContainer) return;
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

		// Build URL → URI map so connections referencing URLs resolve to graph nodes
		const urlToUri = new Map<string, string>();
		for (const card of this.cards) {
			if (card.url) urlToUri.set(card.url, card.uri);
		}
		const resolveNodeId = (ref: string) => urlToUri.get(ref) || ref;

		// Separate URL cards (objects) from NOTE cards (meta/annotations)
		const urlCards = this.cards.filter((c) => c.record.type === "URL");
		const noteCards = this.cards.filter((c) => c.record.type === "NOTE");

		// Count notes per URL card (by parentCard or by url match)
		const noteCountMap = new Map<string, number>();
		for (const note of noteCards) {
			// Link by parentCard if available
			if (note.record.parentCard?.uri) {
				const uri = note.record.parentCard.uri;
				noteCountMap.set(uri, (noteCountMap.get(uri) || 0) + 1);
			}
			// Also link by url field match
			if (note.url) {
				const uri = urlToUri.get(note.url);
				if (uri) {
					noteCountMap.set(uri, (noteCountMap.get(uri) || 0) + 1);
				}
			}
		}

		// Build nodes (only URL cards are objects in the category)
		const degreeMap = new Map<string, number>();
		for (const c of this.connections) {
			const s = resolveNodeId(c.record.source);
			const t = resolveNodeId(c.record.target);
			degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
			degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
		}

		const maxScore = this.candidates.length > 0 ? Math.max(...this.candidates.map((c) => c.score)) : 1;

		let nodes: GraphNode[] = urlCards.map((card) => {
			const deg = degreeMap.get(card.uri) || 0;
			const bestCandidate = this.candidates
				.filter((c) => c.source === card.uri || c.target === card.uri)
				.sort((a, b) => b.score - a.score)[0];
			return {
				id: card.uri,
				card,
				degree: deg,
				isIsolated: deg === 0,
				morphicScore: bestCandidate ? bestCandidate.score / maxScore : 0,
				noteCount: noteCountMap.get(card.uri) || 0,
				isForeign: false,
			};
		});

		// Hide degree-0 nodes unless they have high morphic potential
		nodes = nodes.filter((n) => n.degree > 0 || n.morphicScore > 0.3);

		// Add foreign cards (functors) if enabled
		if (this.showImports) {
			for (const [foreignDid, foreignCards] of this.foreignCards) {
				const foreignConn = this.foreignConnections.get(foreignDid) || [];
				for (const card of foreignCards) {
					// Compute foreign degree from their connections
					const fd = foreignConn.filter(
						(c) => c.record.source === card.uri || c.record.target === card.uri
					).length;
					nodes.push({
						id: card.uri,
						card,
						degree: fd,
						isIsolated: fd === 0,
						morphicScore: 0,
						noteCount: 0,
						isForeign: true,
						sourceDid: foreignDid,
					});
				}
			}
		}

		// Build local links with resolved node IDs
		const existingLinks: GraphLink[] = this.connections
			.filter((c) => !this.activeFilter || (c.record.connectionType || "related") === this.activeFilter)
			.map((c) => ({
				source: resolveNodeId(c.record.source),
				target: resolveNodeId(c.record.target),
				type: c.record.connectionType || "related",
				isSuggestion: false,
				isForeign: false,
			}));

		const suggestedLinks: GraphLink[] = this.showSuggestions
			? this.candidates
					.filter((c) => !this.activeFilter || c.proposedType === this.activeFilter)
					.map((c) => ({
						source: c.source,
						target: c.target,
						type: c.proposedType,
						isSuggestion: true,
						isForeign: false,
						candidate: c,
					}))
			: [];

		// Build foreign links (functor morphisms)
		const foreignLinks: GraphLink[] = [];
		if (this.showImports) {
			for (const [foreignDid, foreignConn] of this.foreignConnections) {
				for (const c of foreignConn) {
					foreignLinks.push({
						source: resolveNodeId(c.record.source),
						target: resolveNodeId(c.record.target),
						type: c.record.connectionType || "related",
						isSuggestion: false,
						isForeign: true,
					});
				}
			}
		}

		// Filter links to only those where both endpoints exist as nodes
		const nodeIds = new Set(nodes.map((n) => n.id));
		const links = [...existingLinks, ...suggestedLinks, ...foreignLinks].filter(
			(l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string),
		);

		// Arrow markers (add foreign arrow)
		this.svg
			.append("defs")
			.selectAll("marker")
			.data(["arrow", "arrow-suggested", "arrow-foreign"])
			.enter()
			.append("marker")
			.attr("id", (d) => d)
			.attr("viewBox", "0 -5 10 10")
			.attr("refX", 28)
			.attr("refY", 0)
			.attr("markerWidth", 6)
			.attr("markerHeight", 6)
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M0,-5L10,0L0,5")
			.attr("fill", (d) =>
				d === "arrow-suggested" ? "#f39c12" : d === "arrow-foreign" ? "#95a5a6" : "#999",
			);

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
			.force("collide", d3.forceCollide<GraphNode>().radius((d) => this.nodeRadius(d) + 8));

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
			.attr("stroke-width", (d) => (d.isForeign ? 1 : d.isSuggestion ? 1.5 : 2))
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
			.filter((d) => d.isIsolated && d.morphicScore > 0.5)
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
					// Desaturate foreign nodes
					return base + "60"; // Add alpha for desaturation
				}
				return base;
			})
			.attr("stroke", (d) => {
				if (d.isForeign) return "#95a5a6";
				if (d.isIsolated) return d.morphicScore > 0.3 ? "#e74c3c" : "#bdc3c7";
				return "#fff";
			})
			.attr("stroke-width", (d) => (d.isForeign ? 1.5 : d.isIsolated ? 2 : 1.5))
			.attr("stroke-dasharray", (d) => (d.isForeign ? "4,2" : "none"))
			.attr("opacity", (d) => (d.isForeign ? 0.7 : d.isIsolated && d.morphicScore < 0.3 ? 0.4 : 1));

		// Note count badge (only for local URL cards with annotations)
		nodeGroup
			.filter((d) => !d.isForeign && d.noteCount > 0)
			.append("circle")
			.attr("cx", (d) => this.nodeRadius(d) - 2)
			.attr("cy", (d) => -this.nodeRadius(d) + 2)
			.attr("r", 7)
			.attr("fill", "#f39c12")
			.attr("stroke", "#fff")
			.attr("stroke-width", 1);

		nodeGroup
			.filter((d) => d.noteCount > 0)
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
				if (d.isForeign && d.sourceDid) {
					const shortDid = d.sourceDid.split(":").pop()?.slice(0, 12) || "";
					return `[${shortDid}…] ${label}`;
				}
				return label;
			});

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
		});
	}

	nodeRadius(d: GraphNode): number {
		if (d.isIsolated) return 6 + d.morphicScore * 8;
		return 6 + Math.sqrt(d.degree) * 3;
	}

	nodeTooltip(d: GraphNode): string {
		let html = `<strong>${d.card.title}</strong><br>`;
		if (d.isForeign && d.sourceDid) {
			html += `<span style="color:#95a5a6;font-style:italic">Imported from ${d.sourceDid}</span><br>`;
		}
		html += `Type: ${d.card.semanticType}<br>`;
		html += `Degree: ${d.degree}`;
		if (!d.isForeign && d.noteCount > 0) {
			html += ` · Notes: ${d.noteCount}`;
		}
		html += `<br>`;
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
