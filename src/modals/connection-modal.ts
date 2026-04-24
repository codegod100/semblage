import { Modal, Notice, App } from "obsidian";
import type { Client } from "@atcute/client";
import type { CardWithMeta } from "../types";
import { createConnection } from "../api/cosmik-api";

const PRESET_TYPES = ["RELATED", "SUPPORTS", "SUPPLEMENT", "cites", "inspired-by", "contradicts", "extends", "references"];

export class ConnectionModal extends Modal {
	private client: Client;
	private did: string;
	private cards: CardWithMeta[];
	private preferredSource?: string;
	private preferredTarget?: string;
	private onSaved?: () => void;

	constructor(
		app: App,
		client: Client,
		did: string,
		cards: CardWithMeta[],
		preferredSource?: string,
		preferredTarget?: string,
		onSaved?: () => void,
	) {
		super(app);
		this.client = client;
		this.did = did;
		this.cards = cards;
		this.preferredSource = preferredSource;
		this.preferredTarget = preferredTarget;
		this.onSaved = onSaved;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Connect Two Cards" });

		// Source
		contentEl.createEl("label", { text: "Source card" });
		const sourceSelect = contentEl.createEl("select");
		sourceSelect.style.width = "100%";
		for (const c of this.cards) {
			sourceSelect.createEl("option", {
				text: `[${c.semanticType}] ${c.title.slice(0, 60)}`,
				value: c.uri,
			});
		}
		if (this.preferredSource) {
			sourceSelect.value = this.preferredSource;
		}

		// Target
		contentEl.createEl("label", { text: "Target card", attr: { style: "display:block;margin-top:10px;" } });
		const targetSelect = contentEl.createEl("select");
		targetSelect.style.width = "100%";
		for (const c of this.cards) {
			targetSelect.createEl("option", {
				text: `[${c.semanticType}] ${c.title.slice(0, 60)}`,
				value: c.uri,
			});
		}
		if (this.preferredTarget) {
			targetSelect.value = this.preferredTarget;
		}

		// Connection type
		contentEl.createEl("label", { text: "Connection type", attr: { style: "display:block;margin-top:10px;" } });
		const typeInput = contentEl.createEl("input", { type: "text", value: "RELATED" });
		typeInput.setAttribute("list", "connection-types");
		const datalist = contentEl.createEl("datalist", { attr: { id: "connection-types" } });
		for (const t of PRESET_TYPES) {
			datalist.createEl("option", { value: t });
		}
		typeInput.style.width = "100%";

		// Note
		contentEl.createEl("label", { text: "Note (optional)", attr: { style: "display:block;margin-top:10px;" } });
		const noteInput = contentEl.createEl("input", { type: "text" });
		noteInput.style.width = "100%";

		const saveBtn = contentEl.createEl("button", {
			text: "Create Connection",
			attr: { style: "margin-top:15px;display:block;" },
		});
		saveBtn.addEventListener("click", async () => {
			const sourceUri = sourceSelect.value;
			const targetUri = targetSelect.value;
			if (sourceUri === targetUri) {
				new Notice("Source and target must be different cards");
				return;
			}
			try {
				await createConnection(this.client, this.did, {
					$type: "network.cosmik.connection",
					source: sourceUri,
					target: targetUri,
					connectionType: typeInput.value.trim() || "RELATED",
					note: noteInput.value.trim() || undefined,
				});
				new Notice("Connection created");
				this.onSaved?.();
				this.close();
			} catch (e) {
				new Notice("Failed to create connection: " + (e instanceof Error ? e.message : String(e)));
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
