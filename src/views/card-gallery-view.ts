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
		this.contentEl.querySelectorAll(".semblage-orphan-notes").forEach((el) => el.remove());

		// Separate objects (URL cards) from meta (NOTE cards)
		const urlCards = this.cards.filter((c) => c.record.type === "URL");
		const noteCards = this.cards.filter((c) => c.record.type === "NOTE");

		// Index notes by parent
		const notesByParent = new Map<string, CardWithMeta[]>();
		const orphanNotes: CardWithMeta[] = [];

		for (const note of noteCards) {
			let parentUri: string | undefined;

			// Link by parentCard
			if (note.record.parentCard?.uri) {
				parentUri = note.record.parentCard.uri;
			}
			// Or by url match
			else if (note.url) {
				const parent = urlCards.find((c) => c.url === note.url);
				if (parent) parentUri = parent.uri;
			}

			if (parentUri) {
				const list = notesByParent.get(parentUri) || [];
				list.push(note);
				notesByParent.set(parentUri, list);
			} else {
				orphanNotes.push(note);
			}
		}

		// Group URL cards by semantic type
		const grouped = new Map<string, CardWithMeta[]>();
		for (const card of urlCards) {
			const list = grouped.get(card.semanticType) || [];
			list.push(card);
			grouped.set(card.semanticType, list);
		}

		for (const type of GROUP_ORDER) {
			const groupCards = grouped.get(type);
			if (!groupCards || groupCards.length === 0) continue;
			this.renderGroup(type, groupCards, notesByParent);
		}

		// Render orphan notes section if any
		if (orphanNotes.length > 0) {
			this.renderOrphanNotes(orphanNotes);
		}
	}

	renderGroup(type: string, cards: CardWithMeta[], notesByParent: Map<string, CardWithMeta[]>) {
		const groupEl = this.contentEl.createDiv({ cls: "semblage-group collapsed" });
		const heading = groupEl.createEl("h4", { cls: "semblage-group-title", text: `${type} (${cards.length})` });
		heading.addEventListener("click", () => {
			groupEl.toggleClass("collapsed", !groupEl.hasClass("collapsed"));
		});

		const listEl = groupEl.createDiv({ cls: "semblage-group-list" });
		for (const card of cards) {
			this.renderCard(listEl, card);
			const notes = notesByParent.get(card.uri);
			if (notes && notes.length > 0) {
				this.renderNotes(listEl, card.uri, notes);
			}
		}
	}

	renderNotes(container: HTMLElement, parentUri: string, notes: CardWithMeta[]) {
		const notesEl = container.createDiv({ cls: "semblage-card-notes" });
		const toggle = notesEl.createEl("button", {
			text: `${notes.length} note${notes.length > 1 ? "s" : ""}`,
			cls: "semblage-card-notes-toggle",
		});
		const listEl = notesEl.createDiv({ cls: "semblage-card-notes-list hidden" });

		toggle.addEventListener("click", () => {
			listEl.toggleClass("hidden", !listEl.hasClass("hidden"));
			toggle.textContent = listEl.hasClass("hidden")
				? `${notes.length} note${notes.length > 1 ? "s" : ""}`
				: "Hide notes";
		});

		for (const note of notes) {
			const noteEl = listEl.createDiv({ cls: "semblage-note" });
			const text = (note.record.content as any)?.text || "";
			noteEl.createEl("div", { text, cls: "semblage-note-text" });
			if (note.record.createdAt) {
				const date = new Date(note.record.createdAt).toLocaleDateString();
				noteEl.createEl("span", { text: date, cls: "semblage-note-date" });
			}
		}
	}

	renderOrphanNotes(notes: CardWithMeta[]) {
		const section = this.contentEl.createDiv({ cls: "semblage-orphan-notes" });
		section.createEl("h4", {
			text: `⚠ Unattached Notes (${notes.length})`,
			cls: "semblage-orphan-title",
		});
		const desc = section.createEl("div", {
			text: "These notes have no parent card. Attach them to a URL card.",
			cls: "semblage-orphan-desc",
		});
		for (const note of notes) {
			const noteEl = section.createDiv({ cls: "semblage-note orphaned" });
			const text = (note.record.content as any)?.text || "";
			noteEl.createEl("div", { text, cls: "semblage-note-text" });
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
		// Merge lookups from both URI and URL since connections may reference either
		const byUri = this.connectionIndex.get(card.uri);
		const byUrl = card.url ? this.connectionIndex.get(card.url) : undefined;
		const outgoing = new Map<string, ConnectionEdge>();
		const incoming = new Map<string, ConnectionEdge>();
		for (const edge of byUri?.outgoing || []) outgoing.set(edge.uri, edge);
		for (const edge of byUri?.incoming || []) incoming.set(edge.uri, edge);
		for (const edge of byUrl?.outgoing || []) outgoing.set(edge.uri, edge);
		for (const edge of byUrl?.incoming || []) incoming.set(edge.uri, edge);

		if (outgoing.size > 0 || incoming.size > 0) {
			const connEl = cardEl.createDiv({ cls: "semblage-card-connections" });
			for (const edge of outgoing.values()) {
				this.renderConnectionChip(connEl, edge, "out", card.uri);
			}
			for (const edge of incoming.values()) {
				this.renderConnectionChip(connEl, edge, "in", card.uri);
			}
		}

		// Utility buttons
		const actionsEl = cardEl.createDiv({ cls: "semblage-card-actions" });
		const connectBtn = actionsEl.createEl("button", { text: "+ connect", cls: "semblage-card-action-btn" });
		connectBtn.addEventListener("click", () => {
			new ConnectionModal(this.app, this.client, this.did, this.cards, card.uri, undefined, () => this.loadData()).open();
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
