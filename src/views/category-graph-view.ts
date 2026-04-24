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
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
	source: string | GraphNode;
	target: string | GraphNode;
	type: string;
	isSuggestion: boolean;
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

export class CategoryGraphView extends ItemView {
	private client: Client;
	private did: string;
	private cards: CardWithMeta[] = [];
	private connections: ConnectionEdge[] = [];
	private candidates: MorphismCandidate[] = [];
	private refreshEl: HTMLElement;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
	private showSuggestions = true;
	private activeFilter: string | null = null;
	private width = 800;
	private height = 600;

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
		this.width = this.contentEl.clientWidth || 800;
		this.height = this.contentEl.clientHeight || 600;

		const header = this.contentEl.createDiv({ cls: "semblage-graph-header" });
		header.createEl("h3", { text: "Category Graph" });

		this.refreshEl = header.createEl("span", {
			text: "Loading...",
			cls: "semblage-graph-status",
		});

		const controls = header.createDiv({ cls: "semblage-graph-controls" });
		this.renderControls(controls);

		const container = this.contentEl.createDiv({ cls: "semblage-graph-container" });
		this.svg = d3
			.select(container)
			.append("svg")
			.attr("width", this.width)
			.attr("height", this.height)
			.attr("viewBox", [0, 0, this.width, this.height]);

		await this.loadData();
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
			const { listCards, listConnections } = await import("../api/cosmik-api");
			this.cards = await listCards(this.client, this.did);
			this.connections = await listConnections(this.client, this.did);
			this.candidates = discoverMorphismCandidates(this.cards, this.connections, 0.35, 3);
			this.refreshEl.textContent = `${this.cards.length} cards · ${this.connections.length} morphisms · ${this.candidates.length} suggestions`;
			this.renderGraph();
		} catch (e) {
			this.refreshEl.textContent = "Error loading";
			new Notice("Failed to load graph: " + (e instanceof Error ? e.message : String(e)));
		}
	}

	renderGraph() {
		if (!this.svg) return;
		this.svg.selectAll("*").remove();

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

		// Build nodes
		const degreeMap = new Map<string, number>();
		for (const c of this.connections) {
			const s = resolveNodeId(c.record.source);
			const t = resolveNodeId(c.record.target);
			degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
			degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
		}

		const cardMap = new Map(this.cards.map((c) => [c.uri, c]));
		const maxScore = this.candidates.length > 0 ? Math.max(...this.candidates.map((c) => c.score)) : 1;

		const nodes: GraphNode[] = this.cards.map((card) => {
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
			};
		});

		// Build links with resolved node IDs
		const existingLinks: GraphLink[] = this.connections
			.filter((c) => !this.activeFilter || (c.record.connectionType || "related") === this.activeFilter)
			.map((c) => ({
				source: resolveNodeId(c.record.source),
				target: resolveNodeId(c.record.target),
				type: c.record.connectionType || "related",
				isSuggestion: false,
			}));

		const suggestedLinks: GraphLink[] = this.showSuggestions
			? this.candidates
					.filter((c) => !this.activeFilter || c.proposedType === this.activeFilter)
					.map((c) => ({
						source: c.source,
						target: c.target,
						type: c.proposedType,
						isSuggestion: true,
						candidate: c,
					}))
			: [];

		const links = [...existingLinks, ...suggestedLinks];

		// Filter links to only those where both endpoints exist as nodes
		const nodeIds = new Set(nodes.map((n) => n.id));
		const validLinks = links.filter((l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

		// Arrow marker
		this.svg
			.append("defs")
			.selectAll("marker")
			.data(["arrow", "arrow-suggested"])
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
			.attr("fill", (d) => (d === "arrow-suggested" ? "#f39c12" : "#999"));

		// Simulation
		this.simulation = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				"link",
				d3
					.forceLink<GraphNode, GraphLink>(validLinks)
					.id((d) => d.id)
					.distance((d) => (d.isSuggestion ? 120 : 80)),
			)
			.force("charge", d3.forceManyBody().strength(-300))
			.force("center", d3.forceCenter(this.width / 2, this.height / 2))
			.force("collide", d3.forceCollide<GraphNode>().radius((d) => this.nodeRadius(d) + 5));

		// Links
		const linkGroup = g
			.append("g")
			.selectAll("line")
			.data(validLinks)
			.enter()
			.append("line")
			.attr("stroke", (d) => (d.isSuggestion ? "#f39c12" : PREDICATE_COLORS[d.type] || "#999"))
			.attr("stroke-width", (d) => (d.isSuggestion ? 1.5 : 2))
			.attr("stroke-dasharray", (d) => (d.isSuggestion ? "5,5" : "none"))
			.attr("stroke-opacity", (d) => (d.isSuggestion ? 0.7 : 0.6))
			.attr("marker-end", (d) => (d.isSuggestion ? "url(#arrow-suggested)" : "url(#arrow)"))
			.style("cursor", (d) => (d.isSuggestion ? "pointer" : "default"))
			.on("click", (event, d) => {
				if (d.isSuggestion && d.candidate) {
					this.createSuggestion(d.candidate);
				}
			});

		// Link labels
		const labelGroup = g
			.append("g")
			.selectAll("text")
			.data(validLinks.filter((d) => !d.isSuggestion))
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
					.on("start", (event, d) => {
						if (!event.active) this.simulation?.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on("drag", (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on("end", (event, d) => {
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
			.attr("fill", (d) => TYPE_COLORS[d.card.semanticType] || "#7f8c8d")
			.attr("stroke", (d) => (d.isIsolated ? (d.morphicScore > 0.3 ? "#e74c3c" : "#bdc3c7") : "#fff"))
			.attr("stroke-width", (d) => (d.isIsolated ? 2 : 1.5))
			.attr("opacity", (d) => (d.isIsolated && d.morphicScore < 0.3 ? 0.4 : 1));

		// Node labels
		nodeGroup
			.append("text")
			.attr("dy", (d) => this.nodeRadius(d) + 12)
			.attr("text-anchor", "middle")
			.attr("font-size", "10px")
			.attr("fill", "var(--text-normal)")
			.text((d) => d.card.title.slice(0, 20) + (d.card.title.length > 20 ? "…" : ""));

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
			.on("mouseover", (event, d) => {
				tooltip
					.style("visibility", "visible")
					.html(this.nodeTooltip(d));
			})
			.on("mousemove", (event) => {
				tooltip.style("top", event.pageY - 10 + "px").style("left", event.pageX + 10 + "px");
			})
			.on("mouseout", () => {
				tooltip.style("visibility", "hidden");
			})
			.on("click", (event, d) => {
				this.highlightChains(d.id);
			});

		// Tick
		this.simulation.on("tick", () => {
			linkGroup
				.attr("x1", (d) => (d.source as GraphNode).x!)
				.attr("y1", (d) => (d.source as GraphNode).y!)
				.attr("x2", (d) => (d.target as GraphNode).x!)
				.attr("y2", (d) => (d.target as GraphNode).y!);

			labelGroup
				.attr("x", (d) => (((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2))
				.attr("y", (d) => (((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2));

			nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
		});
	}

	nodeRadius(d: GraphNode): number {
		if (d.isIsolated) return 6 + d.morphicScore * 8;
		return 6 + Math.sqrt(d.degree) * 3;
	}

	nodeTooltip(d: GraphNode): string {
		let html = `<strong>${d.card.title}</strong><br>`;
		html += `Type: ${d.card.semanticType}<br>`;
		html += `Degree: ${d.degree}<br>`;
		if (d.isIsolated) {
			html += `<span style="color:#e74c3c">Isolated</span>`;
			if (d.morphicScore > 0) {
				html += ` · Morphic potential: ${(d.morphicScore * 100).toFixed(0)}%`;
			}
		}
		return html;
	}

	createSuggestion(candidate: MorphismCandidate) {
		const source = this.cards.find((c) => c.uri === candidate.source);
		const target = this.cards.find((c) => c.uri === candidate.target);
		if (!source || !target) return;

		new ConnectionModal(this.app, this.client, this.did, this.cards, candidate.source, () => {
			this.loadData();
		}).open();
	}

	highlightChains(nodeId: string, depth = 2) {
		if (!this.svg) return;

		// Reset styles
		this.svg.selectAll("line").attr("stroke-opacity", 0.15).attr("stroke-width", 1);
		this.svg.selectAll("circle").attr("opacity", 0.3);

		// BFS to find reachable nodes
		const reachable = new Set<string>([nodeId]);
		const frontier = [nodeId];
		for (let i = 0; i < depth && frontier.length > 0; i++) {
			const next: string[] = [];
			for (const id of frontier) {
				for (const c of this.connections) {
					if (c.record.source === id && !reachable.has(c.record.target)) {
						reachable.add(c.record.target);
						next.push(c.record.target);
					}
				}
			}
			frontier.push(...next);
		}

		// Highlight
		this.svg
			.selectAll<SVGLineElement, GraphLink>("line")
			.filter((d) => reachable.has((d.source as GraphNode).id) && reachable.has((d.target as GraphNode).id))
			.attr("stroke-opacity", 0.8)
			.attr("stroke-width", 2.5);

		this.svg
			.selectAll<SVGCircleElement, GraphNode>("circle")
			.filter((d) => reachable.has(d.id))
			.attr("opacity", 1);
	}

	async onClose() {
		this.simulation?.stop();
		this.contentEl.empty();
	}
}
