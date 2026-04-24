import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type { Client } from "@atcute/client";
import type { CardWithMeta, CardConnections, ConnectionEdge } from "../types";
import { getCardDescription } from "../types";
import { listCards, listConnections, buildConnectionIndex, resolveCardReference } from "../api/cosmik-api";
import { ConnectionModal } from "../modals/connection-modal";

export const VIEW_TYPE_SEMBLAGE_GALLERY = "semblage-gallery";

const GROUP_ORDER = ["article", "research", "software", "video", "book", "social", "link", "note", "other"];

export class CardGalleryView extends ItemView {
	private client: Client;
	private did: string;
	private cards: CardWithMeta[] = [];
	private connectionIndex: Map<string, CardConnections> = new Map();
	private refreshEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, client: Client, did: string) {
		super(leaf);
		this.client = client;
		this.did = did;
	}

	getViewType(): string {
		return VIEW_TYPE_SEMBLAGE_GALLERY;
	}

	getDisplayText(): string {
		return "Semblage Gallery";
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("semblage-gallery");

		const header = this.contentEl.createDiv({ cls: "semblage-gallery-header" });
		header.createEl("h3", { text: "Semblage Cards" });

		this.refreshEl = header.createEl("span", {
			text: "Refreshing...",
			cls: "semblage-gallery-status",
		});

		const refreshBtn = header.createEl("button", { text: "Refresh", cls: "semblage-gallery-refresh-btn" });
		refreshBtn.addEventListener("click", () => this.loadData());

		await this.loadData();
	}

	setAuth(did: string) {
		this.did = did;
	}

	async loadData() {
		if (!this.did) {
			this.refreshEl.textContent = "Not logged in";
			this.contentEl.querySelectorAll(".semblage-group").forEach((el) => el.remove());
			return;
		}
		this.refreshEl.textContent = "Refreshing...";
		try {
			this.cards = await listCards(this.client, this.did);
			const connections = await listConnections(this.client, this.did);
			this.connectionIndex = buildConnectionIndex(this.cards, connections);
			this.refreshEl.textContent = `${this.cards.length} cards`;
			this.render();
		} catch (e) {
			this.refreshEl.textContent = "Error loading";
			new Notice("Failed to load gallery: " + (e instanceof Error ? e.message : String(e)));
		}
	}

	render() {
		// Remove old groups
		this.contentEl.querySelectorAll(".semblage-group").forEach((el) => el.remove());

		const grouped = new Map<string, CardWithMeta[]>();
		for (const card of this.cards) {
			const list = grouped.get(card.semanticType) || [];
			list.push(card);
			grouped.set(card.semanticType, list);
		}

		for (const type of GROUP_ORDER) {
			const groupCards = grouped.get(type);
			if (!groupCards || groupCards.length === 0) continue;
			this.renderGroup(type, groupCards);
		}
	}

	renderGroup(type: string, cards: CardWithMeta[]) {
		const groupEl = this.contentEl.createDiv({ cls: "semblage-group" });
		const heading = groupEl.createEl("h4", { cls: "semblage-group-title", text: `${type} (${cards.length})` });
		heading.addEventListener("click", () => {
			groupEl.toggleClass("collapsed", !groupEl.hasClass("collapsed"));
		});

		const listEl = groupEl.createDiv({ cls: "semblage-group-list" });
		for (const card of cards) {
			this.renderCard(listEl, card);
		}
	}

	renderCard(container: HTMLElement, card: CardWithMeta) {
		const cardEl = container.createDiv({ cls: "semblage-card", attr: { "data-uri": card.uri } });

		const headerEl = cardEl.createDiv({ cls: "semblage-card-header" });
		const titleEl = headerEl.createEl("span", { cls: "semblage-card-title", text: card.title });
		if (card.url) {
			const openBtn = headerEl.createEl("button", { cls: "semblage-card-open", text: "open" });
			openBtn.addEventListener("click", () => {
				window.open(card.url, "_blank");
			});
		}

		if (card.subtitle) {
			cardEl.createDiv({ cls: "semblage-card-subtitle", text: card.subtitle });
		}
		const desc = getCardDescription(card.record);
		if (desc) {
			cardEl.createDiv({ cls: "semblage-card-desc", text: desc });
		}

		// Connections rendered as first-class attributes
		const conns = this.connectionIndex.get(card.uri);
		if (conns && (conns.outgoing.length > 0 || conns.incoming.length > 0)) {
			const connEl = cardEl.createDiv({ cls: "semblage-card-connections" });
			for (const edge of conns.outgoing) {
				this.renderConnectionChip(connEl, edge, "out", card.uri);
			}
			for (const edge of conns.incoming) {
				this.renderConnectionChip(connEl, edge, "in", card.uri);
			}
		}

		// Utility buttons
		const actionsEl = cardEl.createDiv({ cls: "semblage-card-actions" });
		const connectBtn = actionsEl.createEl("button", { text: "+ connect", cls: "semblage-card-action-btn" });
		connectBtn.addEventListener("click", () => {
			new ConnectionModal(this.app, this.client, this.did, this.cards, card.uri, () => this.loadData()).open();
		});

		// Click title to open URL
		if (card.url) {
			titleEl.addEventListener("click", () => {
				window.open(card.url, "_blank");
			});
			titleEl.addClass("clickable");
		}
	}

	renderConnectionChip(container: HTMLElement, edge: ConnectionEdge, direction: "in" | "out", currentUri: string) {
		const chip = container.createDiv({ cls: "semblage-connection-chip" });
		const type = edge.record.connectionType || "related";

		if (direction === "out") {
			const target = resolveCardReference(edge.record.target, this.cards);
			const label = target ? target.title.slice(0, 40) : edge.record.target.slice(-20);
			chip.createEl("span", {
				cls: "semblage-connection-predicate",
				text: `${type.toLowerCase()}`,
			});
			chip.createEl("span", { text: " → " });
			const targetEl = chip.createEl("span", { cls: "semblage-connection-target", text: label });
			targetEl.addEventListener("click", () => {
				if (target) this.scrollToCard(target.uri);
			});
		} else {
			const source = resolveCardReference(edge.record.source, this.cards);
			const label = source ? source.title.slice(0, 40) : edge.record.source.slice(-20);
			const sourceEl = chip.createEl("span", { cls: "semblage-connection-target", text: label });
			sourceEl.addEventListener("click", () => {
				if (source) this.scrollToCard(source.uri);
			});
			chip.createEl("span", { text: " → " });
			chip.createEl("span", {
				cls: "semblage-connection-predicate",
				text: `${type.toLowerCase()}`,
			});
		}

		if (edge.record.note) {
			chip.createEl("span", { cls: "semblage-connection-note", text: ` "${edge.record.note}"` });
		}
	}

	scrollToCard(uri: string) {
		const el = this.contentEl.querySelector(`[data-uri="${CSS.escape(uri)}"]`);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	async onClose() {
		this.contentEl.empty();
	}
}
