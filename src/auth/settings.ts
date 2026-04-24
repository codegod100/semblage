import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import type { AtpAuthManager } from "./auth-manager";

export class AuthSettingsSection {
	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private auth: AtpAuthManager,
		private onStateChange?: () => void,
	) {}

	display(): void {
		new Setting(this.containerEl).setName("AT Protocol Account").setHeading();

		if (this.auth.isLoggedIn) {
			const displayName = this.auth.handle || this.auth.did;
			new Setting(this.containerEl)
				.setName(`Logged in as @${displayName}`)
				.setDesc(this.auth.did || "")
				.addButton((button) =>
					button
						.setButtonText("Log out")
						.setCta()
						.onClick(async () => {
							await this.auth.logout();
							this.onStateChange?.();
							new Notice("Logged out successfully");
						}),
				);
		} else {
			let handleInput: HTMLInputElement;
			new Setting(this.containerEl)
				.setName("Log in")
				.setDesc("Enter your handle (e.g., user.bsky.social)")
				.addText((text) => {
					handleInput = text.inputEl;
					text.setValue("");
				})
				.addButton((button) =>
					button
						.setButtonText("Log in")
						.setCta()
						.onClick(async () => {
							const handle = handleInput.value.trim();
							if (!handle) {
								new Notice("Please enter a handle.");
								return;
							}
							if (!isActorIdentifier(handle)) {
								new Notice("Invalid handle format. Use something like user.bsky.social");
								return;
							}
							const safetyTimer = setTimeout(() => {
								button.setDisabled(false);
								button.setButtonText("Log in");
								new Notice("Login attempt timed out. Please try again.");
							}, 60_000);

							button.setDisabled(true);
							button.setButtonText("Logging in...");
							new Notice("Opening browser for authorization...");

							try {
								await this.auth.login(handle);
								this.onStateChange?.();
								new Notice(`Successfully logged in as ${this.auth.handle}`);
							} catch (error) {
								console.error("Login failed:", error);
								const errorMessage = error instanceof Error ? error.message : String(error);
								new Notice(`Authentication failed: ${errorMessage}`);
							} finally {
								clearTimeout(safetyTimer);
								button.setDisabled(false);
								button.setButtonText("Log in");
							}
						}),
				);
		}
	}
}
