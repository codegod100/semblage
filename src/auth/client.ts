import { Client, FetchHandlerObject, simpleFetchHandler } from "@atcute/client";
import { OAuthUserAgent } from "@atcute/oauth-browser-client";
import type { ResolvedActor } from "@atcute/identity-resolver";
import { OAuthHandler } from "./oauth-handler";
import { compositeResolver } from "./resolver";
import { Notice } from "obsidian";

const ACTOR_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	]);
}

class CacheEntry<T> {
	value: T;
	timestamp: number;
	constructor(value: T) {
		this.value = value;
		this.timestamp = Date.now();
	}
}

class Cache {
	#store = new Map<string, CacheEntry<unknown>>();
	#ttl: number;

	constructor(ttlMillis: number) {
		this.#ttl = ttlMillis;
	}

	get<T>(key: string): T | undefined {
		const entry = this.#store.get(key);
		if (entry) {
			if (Date.now() - entry.timestamp < this.#ttl) {
				return entry.value as T;
			} else {
				this.#store.delete(key);
			}
		}
		return undefined;
	}

	set<T>(key: string, value: T): void {
		this.#store.set(key, new CacheEntry(value));
	}

	clear(): void {
		this.#store.clear();
	}
}

export class Handler implements FetchHandlerObject {
	cache: Cache;
	agent?: OAuthUserAgent;

	constructor() {
		this.cache = new Cache(5 * 60 * 1000);
	}

	async getActor(identifier: string): Promise<ResolvedActor> {
		const key = `actor:${identifier}`;
		const cached = this.cache.get<ResolvedActor>(key);
		if (cached) return cached;
		try {
			const res = await withTimeout(
				(compositeResolver as any).resolve(identifier) as Promise<ResolvedActor>,
				ACTOR_TIMEOUT_MS,
				"Actor resolution",
			);
			this.cache.set(key, res);
			return res;
		} catch (e) {
			throw new Error(`Failed to resolve actor ${identifier}: ${JSON.stringify(e)}`);
		}
	}

	async getPDS(pathname: string): Promise<string | null> {
		const url = new URL(pathname, "https://placeholder");
		const repo = url.searchParams.get("repo");
		if (!repo) return null;
		const own = repo === this.agent?.session.info.sub;
		if (!own) {
			const actor = await this.getActor(repo);
			return actor.pds;
		}
		return null;
	}

	clearCache(): void {
		this.cache.clear();
	}

	async handle(pathname: string, init: RequestInit): Promise<Response> {
		const cacheKey = `${init?.method || "GET"}:${pathname}`;
		if (init?.method?.toLowerCase() === "get") {
			const cached = this.cache.get<Response>(cacheKey);
			if (cached) return cached.clone();
		}

		let resp: Response;
		const pds = await this.getPDS(pathname);
		if (pds) {
			const sfh = simpleFetchHandler({ service: pds });
			resp = await sfh(pathname, init);
		} else if (this.agent) {
			resp = await this.agent.handle(pathname, init);
		} else {
			const sfh = simpleFetchHandler({ service: "https://bsky.social" });
			resp = await sfh(pathname, init);
		}

		if (init?.method?.toLowerCase() === "get" && resp.ok) {
			this.cache.set(cacheKey, resp.clone());
		}
		return resp;
	}
}

export class ATPClient extends Client {
	private hh: Handler;
	private oauth: OAuthHandler;
	actor?: ResolvedActor;

	constructor(oauth: OAuthHandler) {
		const hh = new Handler();
		super({ handler: hh });
		this.oauth = oauth;
		this.hh = hh;
	}

	get loggedIn(): boolean {
		return !!this.hh.agent && !!this.actor;
	}

	async login(identifier: string): Promise<void> {
		const session = await this.oauth.authorize(identifier);
		this.hh.agent = new OAuthUserAgent(session);
		const did = this.hh.agent?.session.info.sub;
		if (did) {
			new Notice("Tokens received. Resolving identity...");
			this.actor = await this.hh.getActor(did);
			new Notice(`Logged in as @${this.actor.handle ?? this.actor.did}`);
		}
	}

	async restoreSession(did: string): Promise<void> {
		const session = await this.oauth.restore(did);
		this.hh.agent = new OAuthUserAgent(session);
		this.actor = await this.hh.getActor(did);
	}

	async logout(identifier: string): Promise<void> {
		await this.oauth.revoke(identifier);
		this.hh.agent = undefined;
		this.actor = undefined;
	}

	async getActor(identifier: string): Promise<ResolvedActor> {
		return this.hh.getActor(identifier);
	}

	clearCache(): void {
		this.hh.clearCache();
	}

	handleOAuthCallback(params: URLSearchParams): void {
		this.oauth.handleCallback(params);
	}
}
