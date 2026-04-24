import { Modal, Notice, App, requestUrl } from "obsidian";
import type { Client } from "@atcute/client";
import type { CosmikCardRecord, UrlMetadata } from "../types";
import { createCard } from "../api/cosmik-api";

function extractUrls(text: string): string[] {
	const matches = text.match(/https?:\/\/[^\s\)\]\>\"]+/g);
	return matches ? [...new Set(matches)] : [];
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
	try {
		const resp = await requestUrl({ url, method: "GET", throw: false });
		if (resp.status !== 200) return { type: "link" };
		const html = resp.text;
		const getMeta = (prop: string) => {
			const m1 = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, "i"));
			const m2 = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, "i"));
			return m1?.[1] || m2?.[1] || "";
		};
		const getMetaName = (name: string) => {
			const m1 = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, "i"));
			const m2 = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${name}"`, "i"));
			return m1?.[1] || m2?.[1] || "";
		};
		const title = getMeta("og:title") || getMetaName("twitter:title") || getMetaName("title") || "";
		const description = getMeta("og:description") || getMetaName("twitter:description") || getMetaName("description") || "";
		const imageUrl = getMeta("og:image") || getMetaName("twitter:image") || "";
		const siteName = getMeta("og:site_name") || "";
		const type = getMeta("og:type") || "link";
		const author = getMetaName("author") || getMeta("og:article:author") || "";
		const publishedDate = getMeta("og:article:published_time") || "";

		return {
			$type: "network.cosmik.card#urlMetadata",
			type: type === "article" ? "article" : type === "video" ? "video" : type === "book" ? "book" : "link",
			title: title || undefined,
			description: description || undefined,
			siteName: siteName || undefined,
			imageUrl: imageUrl || undefined,
			author: author || undefined,
			publishedDate: publishedDate || undefined,
			retrievedAt: new Date().toISOString(),
		};
	} catch (e) {
		console.error("Metadata fetch failed:", e);
		return { type: "link" };
	}
}

export class ClipUrlModal extends Modal {
	private client: Client;
	private did: string;
	private urls: string[];
	private selectedUrl: string;
	private onSaved?: () => void;

	constructor(app: App, client: Client, did: string, selection: string, onSaved?: () => void) {
		super(app);
		this.client = client;
		this.did = did;
		this.urls = extractUrls(selection);
		this.selectedUrl = this.urls[0] || "";
		this.onSaved = onSaved;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Clip URL Card" });

		let titleInput: HTMLInputElement;
		let descInput: HTMLTextAreaElement;
		let typeSelect: HTMLSelectElement;
		let siteInput: HTMLInputElement;
		let authorInput: HTMLInputElement;
		let urlInput: HTMLInputElement;

		if (this.urls.length > 1) {
			new Notice(`Found ${this.urls.length} URLs. Using first one.`);
		}

		// URL
		contentEl.createEl("label", { text: "URL" });
		urlInput = contentEl.createEl("input", { type: "text", value: this.selectedUrl });
		urlInput.style.width = "100%";
		urlInput.addEventListener("input", () => {
			this.selectedUrl = urlInput.value;
		});

		// Type
		contentEl.createEl("label", { text: "Type", attr: { style: "display:block;margin-top:10px;" } });
		typeSelect = contentEl.createEl("select");
		const types = ["link", "article", "research", "software", "video", "book", "social"];
		for (const t of types) {
			typeSelect.createEl("option", { text: t, value: t });
		}

		// Title
		contentEl.createEl("label", { text: "Title", attr: { style: "display:block;margin-top:10px;" } });
		titleInput = contentEl.createEl("input", { type: "text" });
		titleInput.style.width = "100%";

		// Description
		contentEl.createEl("label", { text: "Description", attr: { style: "display:block;margin-top:10px;" } });
		descInput = contentEl.createEl("textarea");
		descInput.style.width = "100%";
		descInput.style.height = "60px";

		// Site
		contentEl.createEl("label", { text: "Site Name", attr: { style: "display:block;margin-top:10px;" } });
		siteInput = contentEl.createEl("input", { type: "text" });
		siteInput.style.width = "100%";

		// Author
		contentEl.createEl("label", { text: "Author", attr: { style: "display:block;margin-top:10px;" } });
		authorInput = contentEl.createEl("input", { type: "text" });
		authorInput.style.width = "100%";

		// Auto-fetch metadata button
		const fetchBtn = contentEl.createEl("button", { text: "Auto-fetch metadata", attr: { style: "margin-top:10px;" } });
		fetchBtn.addEventListener("click", async () => {
			if (!this.selectedUrl) {
				new Notice("Enter a URL first");
				return;
			}
			fetchBtn.disabled = true;
			fetchBtn.textContent = "Fetching...";
			const meta = await fetchUrlMetadata(this.selectedUrl);
			if (meta.title) titleInput.value = meta.title;
			if (meta.description) descInput.value = meta.description;
			if (meta.siteName) siteInput.value = meta.siteName;
			if (meta.author) authorInput.value = meta.author;
			if (meta.type) typeSelect.value = meta.type;
			fetchBtn.disabled = false;
			fetchBtn.textContent = "Auto-fetch metadata";
		});

		// If we already have a URL, auto-fetch immediately
		if (this.selectedUrl) {
			fetchBtn.click();
		}

		// Save
		const saveBtn = contentEl.createEl("button", {
			text: "Save Card",
			attr: { style: "margin-top:15px;display:block;" },
		});
		saveBtn.addEventListener("click", async () => {
			const record: CosmikCardRecord = {
				$type: "network.cosmik.card",
				type: "URL",
				url: this.selectedUrl,
				content: {
					$type: "network.cosmik.card#urlContent",
					url: this.selectedUrl,
					metadata: {
						$type: "network.cosmik.card#urlMetadata",
						type: typeSelect.value,
						title: titleInput.value || undefined,
						description: descInput.value || undefined,
						siteName: siteInput.value || undefined,
						author: authorInput.value || undefined,
						retrievedAt: new Date().toISOString(),
					},
				},
				createdAt: new Date().toISOString(),
			};
			try {
				await createCard(this.client, this.did, record);
				new Notice("Card saved to PDS");
				this.onSaved?.();
				this.close();
			} catch (e) {
				new Notice("Failed to save card: " + (e instanceof Error ? e.message : String(e)));
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class ClipNoteModal extends Modal {
	private client: Client;
	private did: string;
	private initialText: string;
	private cards: { uri: string; title: string }[];
	private onSaved?: () => void;

	constructor(
		app: App,
		client: Client,
		did: string,
		initialText: string,
		cards: { uri: string; title: string }[],
		onSaved?: () => void,
	) {
		super(app);
		this.client = client;
		this.did = did;
		this.initialText = initialText;
		this.cards = cards;
		this.onSaved = onSaved;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Clip Note Card" });

		// Note text
		contentEl.createEl("label", { text: "Note text" });
		const textArea = contentEl.createEl("textarea");
		textArea.value = this.initialText;
		textArea.style.width = "100%";
		textArea.style.height = "120px";

		// Parent URL card (required — notes are meta, not objects)
		contentEl.createEl("label", { text: "Attach to URL card *", attr: { style: "display:block;margin-top:10px;" } });
		const parentSelect = contentEl.createEl("select");
		parentSelect.createEl("option", { text: "— Select a card —", value: "" });
		for (const c of this.cards) {
			parentSelect.createEl("option", { text: c.title.slice(0, 60), value: c.uri });
		}

		// Optional URL attachment
		contentEl.createEl("label", { text: "Attach URL (optional)", attr: { style: "display:block;margin-top:10px;" } });
		const urlInput = contentEl.createEl("input", { type: "text" });
		urlInput.style.width = "100%";

		const saveBtn = contentEl.createEl("button", {
			text: "Save Note Card",
			attr: { style: "margin-top:15px;display:block;" },
		});
		saveBtn.addEventListener("click", async () => {
			const text = textArea.value.trim();
			if (!text) {
				new Notice("Note text is required");
				return;
			}
			if (!parentSelect.value) {
				new Notice("Please select a parent URL card — notes must be attached to an object");
				return;
			}
			const record: CosmikCardRecord = {
				$type: "network.cosmik.card",
				type: "NOTE",
				content: {
					$type: "network.cosmik.card#noteContent",
					text,
				},
				createdAt: new Date().toISOString(),
			};
			if (urlInput.value.trim()) {
				record.url = urlInput.value.trim();
			}
			const parent = this.cards.find((c) => c.uri === parentSelect.value);
			if (parent) {
				record.parentCard = { uri: parent.uri, cid: "" };
			}
			try {
				await createCard(this.client, this.did, record);
				new Notice("Note card saved to PDS");
				this.onSaved?.();
				this.close();
			} catch (e) {
				new Notice("Failed to save note card: " + (e instanceof Error ? e.message : String(e)));
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
