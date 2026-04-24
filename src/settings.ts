import { App, PluginSettingTab, Setting } from "obsidian";
import type SemblagePlugin from "./main";
import { AuthSettingsSection } from "./auth";

export interface SemblageSettings {
	defaultClipType?: string;
}

export const DEFAULT_SETTINGS: SemblageSettings = {
	defaultClipType: "article",
};

export class SettingTab extends PluginSettingTab {
	plugin: SemblagePlugin;

	constructor(app: App, plugin: SemblagePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Auth section
		const authSection = new AuthSettingsSection(
			this.app,
			containerEl,
			this.plugin.auth,
			() => this.display(),
		);
		authSection.display();

		// Plugin settings
		new Setting(containerEl).setName("Semblage").setHeading();

		new Setting(containerEl)
			.setName("Default clip type")
			.setDesc("Default semantic type for new URL cards")
			.addDropdown((dropdown) => {
				dropdown.addOption("article", "article");
				dropdown.addOption("research", "research");
				dropdown.addOption("software", "software");
				dropdown.addOption("video", "video");
				dropdown.addOption("book", "book");
				dropdown.addOption("social", "social");
				dropdown.addOption("link", "link");
				dropdown.setValue(this.plugin.settings.defaultClipType || "article");
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultClipType = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
