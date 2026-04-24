import { Notice, Plugin } from "obsidian";
import type { Client } from "@atcute/client";
import type { ResolvedActor } from "@atcute/identity-resolver";
import { OAuthHandler } from "./oauth-handler";
import { ATPClient } from "./client";
import type { AtpAuthOptions, IAtpAuthManager } from "./types";

const STORAGE_KEY = "atp_auth_did";

export class AtpAuthManager implements IAtpAuthManager {
	private plugin: Plugin;
	private protocolScheme: string;
	private oauthHandler: OAuthHandler;
	private atpClient: ATPClient;
	did: string | undefined;

	constructor(options: AtpAuthOptions) {
		this.plugin = options.plugin;
		this.protocolScheme = options.protocolScheme;
		this.oauthHandler = new OAuthHandler({
			clientId: options.clientId,
			redirectUri: options.redirectUri,
			scope: options.scope,
			storageName: options.storageName,
		});
		this.atpClient = new ATPClient(this.oauthHandler);
	}

	async initialize(): Promise<void> {
		this.plugin.registerObsidianProtocolHandler(this.protocolScheme, (params) => {
			try {
				const urlParams = new URLSearchParams();
				for (const [key, value] of Object.entries(params)) {
					if (value) urlParams.set(key, String(value));
				}
				if (urlParams.has("error")) {
					const error = urlParams.get("error") || "unknown";
					const desc = urlParams.get("error_description") || error;
					new Notice(`OAuth error: ${desc}`);
					console.error("OAuth callback error:", desc);
					return;
				}
				if (!urlParams.has("code")) {
					new Notice("OAuth callback missing authorization code.");
					return;
				}
				this.atpClient.handleOAuthCallback(urlParams);
				new Notice("Finishing login...");
			} catch (error) {
				console.error("OAuth callback error:", error);
				new Notice("Authentication error: " + (error instanceof Error ? error.message : String(error)));
			}
		});

		const saved = await this.plugin.loadData();
		this.did = saved?.[STORAGE_KEY];
		if (this.did) {
			try {
				await this.atpClient.restoreSession(this.did);
			} catch (e) {
				console.warn("Failed to restore session:", e);
				this.did = undefined;
				await this._persist();
			}
		}
	}

	get client(): Client {
		return this.atpClient;
	}

	get actor(): ResolvedActor | undefined {
		return this.atpClient.actor;
	}

	get isLoggedIn(): boolean {
		return this.atpClient.loggedIn;
	}

	get handle(): string | undefined {
		return this.atpClient.actor?.handle;
	}

	async login(identifier: string): Promise<void> {
		await this.atpClient.login(identifier);
		this.did = this.atpClient.actor?.did;
		await this._persist();
	}

	async logout(): Promise<void> {
		if (this.did) {
			await this.atpClient.logout(this.did);
		}
		this.did = undefined;
		await this._persist();
	}

	async checkAuth(): Promise<boolean> {
		if (this.isLoggedIn) return true;
		if (this.did) {
			try {
				await this.atpClient.restoreSession(this.did);
				return true;
			} catch (e) {
				console.error("Failed to restore session:", e);
				this.did = undefined;
				await this._persist();
				new Notice("Session expired. Please log in via settings.");
				return false;
			}
		}
		new Notice("Please log in via plugin settings.");
		return false;
	}

	private async _persist(): Promise<void> {
		const saved = (await this.plugin.loadData()) ?? {};
		saved[STORAGE_KEY] = this.did;
		await this.plugin.saveData(saved);
	}
}
