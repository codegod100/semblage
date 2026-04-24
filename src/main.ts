import { Notice, Plugin, WorkspaceLeaf, Editor } from "obsidian";
import { AtpAuthManager } from "./auth";
import { DEFAULT_SETTINGS, SettingTab, type SemblageSettings } from "./settings";
import { CardGalleryView, VIEW_TYPE_SEMBLAGE_GALLERY } from "./views/card-gallery-view";
import { CategoryGraphView, VIEW_TYPE_CATEGORY_GRAPH } from "./views/category-graph-view";
import { ClipUrlModal, ClipNoteModal } from "./modals/clip-modal";
import { ConnectionModal } from "./modals/connection-modal";
import { listCards } from "./api/cosmik-api";

const METADATA_CACHE_BUST = "v=4";

export default class SemblagePlugin extends Plugin {
	settings: SemblageSettings = DEFAULT_SETTINGS;
	auth: AtpAuthManager;

	async onload() {
		await this.loadSettings();

		this.auth = new AtpAuthManager({
			plugin: this,
			protocolScheme: "semblage-oauth",
			clientId: `https://codegod100.github.io/obsidian-callback/clients/semblage.json?${METADATA_CACHE_BUST}`,
			redirectUri: "https://codegod100.github.io/obsidian-callback/callback-semblage.html",
			scope: "atproto transition:generic",
		});
		await this.auth.initialize();

		this.registerView(VIEW_TYPE_SEMBLAGE_GALLERY, (leaf) => {
			return new CardGalleryView(leaf, this.auth.client, this.auth.did || "");
		});
		this.registerView(VIEW_TYPE_CATEGORY_GRAPH, (leaf) => {
			return new CategoryGraphView(leaf, this.auth.client, this.auth.did || "");
		});

		// Ribbon icon
		this.addRibbonIcon("network", "Open Semblage Gallery", () => {
			this.toggleGalleryView();
		});

		this.addCommand({
			id: "open-graph",
			name: "Open category graph",
			callback: () => this.toggleGraphView(),
		});

		// Commands
		this.addCommand({
			id: "open-gallery",
			name: "Open card gallery",
			callback: () => this.toggleGalleryView(),
		});

		this.addCommand({
			id: "clip-url-card-from-selection",
			name: "Clip URL card from selection",
			editorCallback: (editor: Editor) => {
				this.clipUrlFromSelection(editor.getSelection());
			},
		});

		this.addCommand({
			id: "clip-note-card-from-selection",
			name: "Clip note card from selection",
			editorCallback: (editor: Editor) => {
				this.clipNoteFromSelection(editor.getSelection());
			},
		});

		this.addCommand({
			id: "clip-active-note-as-url",
			name: "Clip active note as URL card",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					this.app.vault.read(file).then((text) => this.clipUrlFromSelection(text));
				}
				return true;
			},
		});

		this.addCommand({
			id: "clip-active-note-as-note",
			name: "Clip active note as note card",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					this.app.vault.read(file).then((text) => this.clipNoteFromSelection(text));
				}
				return true;
			},
		});

		this.addCommand({
			id: "connect-two-cards",
			name: "Connect two cards",
			callback: () => this.openConnectionModal(),
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}

	async toggleGalleryView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SEMBLAGE_GALLERY);

		if (leaves.length > 0) {
			workspace.detachLeavesOfType(VIEW_TYPE_SEMBLAGE_GALLERY);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_SEMBLAGE_GALLERY });
			workspace.revealLeaf(leaf);
			const view = leaf.view;
			if (view instanceof CardGalleryView && this.auth.did) {
				view.setAuth(this.auth.did);
				view.loadData();
			}
		}
	}

	async toggleGraphView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CATEGORY_GRAPH);

		if (leaves.length > 0) {
			workspace.detachLeavesOfType(VIEW_TYPE_CATEGORY_GRAPH);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_CATEGORY_GRAPH });
			workspace.revealLeaf(leaf);
			const view = leaf.view;
			if (view instanceof CategoryGraphView && this.auth.did) {
				view.setAuth(this.auth.did);
				view.loadData();
			}
		}
	}

	async clipUrlFromSelection(text: string) {
		if (!this.auth.isLoggedIn) {
			new Notice("Please log in first.");
			return;
		}
		new ClipUrlModal(this.app, this.auth.client, this.auth.did!, text, () => {
			this.refreshGallery();
		}).open();
	}

	async clipNoteFromSelection(text: string) {
		if (!this.auth.isLoggedIn) {
			new Notice("Please log in first.");
			return;
		}
		const cards = await listCards(this.auth.client, this.auth.did!);
		const urlCards = cards.filter((c) => c.record.type === "URL").map((c) => ({ uri: c.uri, title: c.title }));
		new ClipNoteModal(this.app, this.auth.client, this.auth.did!, text, urlCards, () => {
			this.refreshGallery();
		}).open();
	}

	async openConnectionModal() {
		if (!this.auth.isLoggedIn) {
			new Notice("Please log in first.");
			return;
		}
		const cards = await listCards(this.auth.client, this.auth.did!);
		new ConnectionModal(this.app, this.auth.client, this.auth.did!, cards, undefined, () => {
			this.refreshGallery();
		}).open();
	}

	refreshGallery() {
		const { workspace } = this.app;
		for (const leaf of workspace.getLeavesOfType(VIEW_TYPE_SEMBLAGE_GALLERY)) {
			const view = leaf.view;
			if (view instanceof CardGalleryView) {
				view.loadData();
			}
		}
		for (const leaf of workspace.getLeavesOfType(VIEW_TYPE_CATEGORY_GRAPH)) {
			const view = leaf.view;
			if (view instanceof CategoryGraphView) {
				view.loadData();
			}
		}
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<SemblageSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}
