import type { Plugin } from "obsidian";
import type { Client } from "@atcute/client";
import type { ResolvedActor } from "@atcute/identity-resolver";

export interface AtpAuthOptions {
	plugin: Plugin;
	protocolScheme: string;
	clientId: string;
	redirectUri: string;
	scope: string;
	storageName?: string;
}

export interface IAtpAuthManager {
	readonly client: Client;
	readonly actor: ResolvedActor | undefined;
	readonly isLoggedIn: boolean;
	readonly did: string | undefined;
	readonly handle: string | undefined;

	login(identifier: string): Promise<void>;
	logout(): Promise<void>;
	checkAuth(): Promise<boolean>;
}
