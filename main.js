/* semblage-obsidian */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/types.ts
function getSemanticType(card) {
  if (card.type === "NOTE") return "note";
  if (card.type === "URL") {
    const metaType = card.content?.metadata?.type?.toLowerCase() || "";
    if (SEMANTIC_TYPES.includes(metaType)) return metaType;
    return "link";
  }
  return "other";
}
function getCardTitle(card) {
  if (card.type === "URL") {
    const meta = card.content?.metadata;
    return meta?.title || card.url || "Untitled URL";
  }
  if (card.type === "NOTE") {
    const text = card.content?.text || "";
    return text.split("\n")[0].slice(0, 80) || "Untitled Note";
  }
  return "Untitled";
}
function getCardSubtitle(card) {
  if (card.type === "URL") {
    const meta = card.content?.metadata;
    return meta?.siteName || meta?.author || card.url || "";
  }
  return "";
}
function getCardUrl(card) {
  if (card.type === "URL") {
    return card.content?.url || card.url;
  }
  return card.url;
}
function getCardDescription(card) {
  if (card.type === "URL") {
    return card.content?.metadata?.description || "";
  }
  if (card.type === "NOTE") {
    const text = card.content?.text || "";
    return text.slice(0, 200);
  }
  return "";
}
var SEMANTIC_TYPES;
var init_types = __esm({
  "src/types.ts"() {
    SEMANTIC_TYPES = [
      "article",
      "research",
      "software",
      "video",
      "book",
      "social",
      "link"
    ];
  }
});

// src/api/cosmik-api.ts
var cosmik_api_exports = {};
__export(cosmik_api_exports, {
  buildConnectionIndex: () => buildConnectionIndex,
  createCard: () => createCard,
  createConnection: () => createConnection,
  deleteCard: () => deleteCard,
  fetchForeignCards: () => fetchForeignCards,
  listCards: () => listCards,
  listCollectionLinks: () => listCollectionLinks,
  listCollections: () => listCollections,
  listConnections: () => listConnections,
  listFollows: () => listFollows,
  resolveCardReference: () => resolveCardReference,
  resolveHandles: () => resolveHandles
});
function generateRkey() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function parseRkey(uri) {
  return uri.split("/").pop() || "";
}
async function fetchAllRecords(client, did, collection) {
  const all = [];
  let cursor;
  while (true) {
    const resp = await client.get("com.atproto.repo.listRecords", {
      params: { repo: did, collection, limit: 100, cursor }
    });
    if (!resp.ok) {
      throw new Error(`Failed to list ${collection}: ${resp.status}`);
    }
    const records = resp.data.records;
    all.push(...records);
    cursor = resp.data.cursor;
    if (!cursor || records.length === 0) break;
  }
  return all;
}
async function listCards(client, did) {
  const records = await fetchAllRecords(client, did, CARD_COLLECTION);
  return records.map((r) => {
    const record2 = r.value;
    return {
      uri: r.uri,
      cid: r.cid,
      rkey: parseRkey(r.uri),
      record: record2,
      title: getCardTitle(record2),
      semanticType: getSemanticType(record2),
      subtitle: getCardSubtitle(record2),
      url: getCardUrl(record2)
    };
  });
}
async function createCard(client, did, record2) {
  const rkey = generateRkey();
  if (!record2.createdAt) {
    record2.createdAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  const resp = await client.post("com.atproto.repo.putRecord", {
    input: {
      repo: did,
      collection: CARD_COLLECTION,
      rkey,
      record: record2,
      validate: false
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to create card: ${resp.status} ${resp.data?.message || ""}`);
  }
  return { uri: resp.data.uri, cid: resp.data.cid, rkey };
}
async function deleteCard(client, did, rkey) {
  const resp = await client.post("com.atproto.repo.deleteRecord", {
    input: { repo: did, collection: CARD_COLLECTION, rkey }
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete card: ${resp.status}`);
  }
}
async function listConnections(client, did) {
  const records = await fetchAllRecords(client, did, CONNECTION_COLLECTION);
  return records.map((r) => ({
    record: r.value,
    uri: r.uri,
    cid: r.cid
  }));
}
async function createConnection(client, did, record2) {
  const rkey = generateRkey();
  if (!record2.createdAt) {
    record2.createdAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (!record2.updatedAt) {
    record2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  const resp = await client.post("com.atproto.repo.putRecord", {
    input: {
      repo: did,
      collection: CONNECTION_COLLECTION,
      rkey,
      record: record2,
      validate: false
    }
  });
  if (!resp.ok) {
    throw new Error(`Failed to create connection: ${resp.status} ${resp.data?.message || ""}`);
  }
  return { uri: resp.data.uri, cid: resp.data.cid, rkey };
}
async function listCollections(client, did) {
  const resp = await client.get("com.atproto.repo.listRecords", {
    params: { repo: did, collection: COLLECTION_COLLECTION, limit: 100 }
  });
  if (!resp.ok) {
    throw new Error(`Failed to list collections: ${resp.status}`);
  }
  return resp.data.records.map((r) => r.value);
}
async function listCollectionLinks(client, did) {
  const resp = await client.get("com.atproto.repo.listRecords", {
    params: { repo: did, collection: COLLECTION_LINK_COLLECTION, limit: 100 }
  });
  if (!resp.ok) {
    throw new Error(`Failed to list collection links: ${resp.status}`);
  }
  return resp.data.records.map((r) => r.value);
}
async function listFollows(client, did) {
  const records = await fetchAllRecords(client, did, FOLLOW_COLLECTION);
  return records.map((r) => r.value.subject).filter(Boolean);
}
async function fetchForeignCards(client, did) {
  const records = await fetchAllRecords(client, did, CARD_COLLECTION);
  const cards = records.map((r) => {
    const record2 = r.value;
    return {
      uri: r.uri,
      cid: r.cid,
      rkey: parseRkey(r.uri),
      record: record2,
      title: getCardTitle(record2),
      semanticType: getSemanticType(record2),
      subtitle: getCardSubtitle(record2),
      url: getCardUrl(record2)
    };
  });
  const connRecords = await fetchAllRecords(client, did, CONNECTION_COLLECTION);
  const connections = connRecords.map((r) => ({
    record: r.value,
    uri: r.uri,
    cid: r.cid
  }));
  return { cards, connections };
}
function buildConnectionIndex(cards, connections) {
  const index2 = /* @__PURE__ */ new Map();
  for (const card of cards) {
    const empty2 = { outgoing: [], incoming: [] };
    index2.set(card.uri, empty2);
    if (card.url) {
      index2.set(card.url, empty2);
    }
  }
  for (const edge of connections) {
    const source = edge.record.source;
    const target = edge.record.target;
    if (!index2.has(source)) {
      index2.set(source, { outgoing: [], incoming: [] });
    }
    if (!index2.has(target)) {
      index2.set(target, { outgoing: [], incoming: [] });
    }
    const sourceEntry = index2.get(source);
    if (sourceEntry) sourceEntry.outgoing.push(edge);
    const targetEntry = index2.get(target);
    if (targetEntry) targetEntry.incoming.push(edge);
  }
  return index2;
}
async function resolveHandles(client, dids, cache) {
  const result = { ...cache };
  const toResolve = dids.filter((did) => !result[did]);
  if (toResolve.length === 0) return result;
  for (const did of toResolve) {
    try {
      const profileResp = await client.get("app.bsky.actor.getProfile", {
        params: { actor: did }
      });
      if (profileResp.ok && profileResp.data?.handle) {
        result[did] = profileResp.data.handle;
      } else {
        result[did] = did.slice(0, 20) + "\u2026";
      }
    } catch {
      result[did] = did.slice(0, 20) + "\u2026";
    }
  }
  return result;
}
function resolveCardReference(ref, cards) {
  return cards.find((c2) => c2.uri === ref || c2.url === ref);
}
var CARD_COLLECTION, CONNECTION_COLLECTION, COLLECTION_COLLECTION, COLLECTION_LINK_COLLECTION, FOLLOW_COLLECTION;
var init_cosmik_api = __esm({
  "src/api/cosmik-api.ts"() {
    init_types();
    CARD_COLLECTION = "network.cosmik.card";
    CONNECTION_COLLECTION = "network.cosmik.connection";
    COLLECTION_COLLECTION = "network.cosmik.collection";
    COLLECTION_LINK_COLLECTION = "network.cosmik.collectionLink";
    FOLLOW_COLLECTION = "network.cosmik.follow";
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SemblagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian10 = require("obsidian");

// src/auth/auth-manager.ts
var import_obsidian3 = require("obsidian");

// node_modules/@atcute/oauth-browser-client/dist/utils/runtime.js
var locks = typeof navigator !== "undefined" ? navigator.locks : void 0;

// node_modules/@atcute/oauth-browser-client/dist/store/db.js
var parse = (raw) => {
  if (raw != null) {
    const parsed = JSON.parse(raw);
    if (parsed != null) {
      return parsed;
    }
  }
  return {};
};
var createOAuthDatabase = ({ name }) => {
  const controller = new AbortController();
  const signal = controller.signal;
  const createStore = (subname, expiresAt, persistUpdatedAt = false) => {
    let store;
    const storageKey = `${name}:${subname}`;
    const persist = () => store && localStorage.setItem(storageKey, JSON.stringify(store));
    const read = () => {
      if (signal.aborted) {
        throw new Error(`store closed`);
      }
      return store ??= parse(localStorage.getItem(storageKey));
    };
    {
      const listener = (ev) => {
        if (ev.key === storageKey) {
          store = void 0;
        }
      };
      globalThis.addEventListener("storage", listener, { signal });
    }
    {
      const cleanup = async (lock) => {
        if (!lock || signal.aborted) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1e4));
        if (signal.aborted) {
          return;
        }
        let now2 = Date.now();
        let changed = false;
        read();
        for (const key in store) {
          const item = store[key];
          const expiresAt2 = item.expiresAt;
          if (expiresAt2 !== null && now2 > expiresAt2) {
            changed = true;
            delete store[key];
          }
        }
        if (changed) {
          persist();
        }
      };
      if (locks) {
        locks.request(`${storageKey}:cleanup`, { ifAvailable: true }, cleanup);
      } else {
        cleanup(true);
      }
    }
    return {
      get(key) {
        read();
        const item = store[key];
        if (!item) {
          return;
        }
        const expiresAt2 = item.expiresAt;
        if (expiresAt2 !== null && Date.now() > expiresAt2) {
          delete store[key];
          persist();
          return;
        }
        return item.value;
      },
      getWithLapsed(key) {
        read();
        const item = store[key];
        const now2 = Date.now();
        if (!item) {
          return [void 0, Infinity];
        }
        const updatedAt = item.updatedAt;
        if (updatedAt === void 0) {
          return [item.value, Infinity];
        }
        return [item.value, now2 - updatedAt];
      },
      set(key, value) {
        read();
        const item = {
          value,
          expiresAt: expiresAt(value),
          updatedAt: persistUpdatedAt ? Date.now() : void 0
        };
        store[key] = item;
        persist();
      },
      delete(key) {
        read();
        if (store[key] !== void 0) {
          delete store[key];
          persist();
        }
      },
      keys() {
        read();
        return Object.keys(store);
      }
    };
  };
  return {
    dispose: () => {
      controller.abort();
    },
    sessions: createStore("sessions", ({ token }) => {
      if (token.refresh) {
        return null;
      }
      return token.expires_at ?? null;
    }),
    states: createStore("states", (_item) => Date.now() + 10 * 60 * 1e3),
    // 10 minutes
    // The reference PDS have nonces that expire after 3 minutes, while other
    // implementations can have varying expiration times.
    // Stored for 24 hours.
    dpopNonces: createStore("dpopNonces", (_item) => Date.now() + 24 * 60 * 60 * 1e3, true),
    inflightDpop: /* @__PURE__ */ new Map()
  };
};

// node_modules/@atcute/oauth-browser-client/dist/environment.js
var CLIENT_ID;
var REDIRECT_URI;
var fetchClientAssertion;
var database;
var identityResolver;
var configureOAuth = (options) => {
  ({ identityResolver, fetchClientAssertion } = options);
  ({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI } = options.metadata);
  database = createOAuthDatabase({ name: options.storageName ?? "atcute-oauth" });
};

// node_modules/@atcute/oauth-browser-client/dist/errors.js
var LoginError = class extends Error {
  name = "LoginError";
};
var AuthorizationError = class extends Error {
  name = "AuthorizationError";
};
var ResolverError = class extends Error {
  name = "ResolverError";
};
var TokenRefreshError = class extends Error {
  sub;
  name = "TokenRefreshError";
  constructor(sub, message, options) {
    super(message, options);
    this.sub = sub;
  }
};
var OAuthResponseError = class extends Error {
  response;
  data;
  name = "OAuthResponseError";
  error;
  description;
  constructor(response, data) {
    const error = ifString(ifObject(data)?.["error"]);
    const errorDescription = ifString(ifObject(data)?.["error_description"]);
    const messageError = error ? `"${error}"` : "unknown";
    const messageDesc = errorDescription ? `: ${errorDescription}` : "";
    const message = `OAuth ${messageError} error${messageDesc}`;
    super(message);
    this.response = response;
    this.data = data;
    this.error = error;
    this.description = errorDescription;
  }
  get status() {
    return this.response.status;
  }
  get headers() {
    return this.response.headers;
  }
};
var FetchResponseError = class extends Error {
  response;
  status;
  name = "FetchResponseError";
  constructor(response, status, message) {
    super(message);
    this.response = response;
    this.status = status;
  }
};
var ifString = (v) => {
  return typeof v === "string" ? v : void 0;
};
var ifObject = (v) => {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? v : void 0;
};

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => {
  let id2 = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id2 += urlAlphabet[bytes[size] & 63];
  }
  return id2;
};

// node_modules/@atcute/uint8array/dist/index.js
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
var subtle = crypto.subtle;
var alloc = (size) => {
  return new Uint8Array(size);
};
var allocUnsafe = alloc;
var encodeUtf8 = (str) => {
  return textEncoder.encode(str);
};
var _fromCharCode = String.fromCharCode;
var toSha256 = async (buffer) => {
  return new Uint8Array(await subtle.digest("SHA-256", buffer));
};

// node_modules/@atcute/multibase/dist/utils.js
var createRfc4648Encode = (alphabet, bitsPerChar, pad) => {
  return (bytes) => {
    const mask = (1 << bitsPerChar) - 1;
    let str = "";
    let bits = 0;
    let buffer = 0;
    for (let i = 0; i < bytes.length; ++i) {
      buffer = buffer << 8 | bytes[i];
      bits += 8;
      while (bits > bitsPerChar) {
        bits -= bitsPerChar;
        str += alphabet[mask & buffer >> bits];
      }
    }
    if (bits !== 0) {
      str += alphabet[mask & buffer << bitsPerChar - bits];
    }
    if (pad) {
      while ((str.length * bitsPerChar & 7) !== 0) {
        str += "=";
      }
    }
    return str;
  };
};
var createRfc4648Decode = (alphabet, bitsPerChar, pad) => {
  const codes = {};
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i;
  }
  return (str) => {
    let end = str.length;
    while (pad && str[end - 1] === "=") {
      --end;
    }
    const bytes = allocUnsafe(end * bitsPerChar / 8 | 0);
    let bits = 0;
    let buffer = 0;
    let written = 0;
    for (let i = 0; i < end; ++i) {
      const value = codes[str[i]];
      if (value === void 0) {
        throw new SyntaxError(`invalid base string`);
      }
      buffer = buffer << bitsPerChar | value;
      bits += bitsPerChar;
      if (bits >= 8) {
        bits -= 8;
        bytes[written++] = 255 & buffer >> bits;
      }
    }
    if (bits >= bitsPerChar || (255 & buffer << 8 - bits) !== 0) {
      throw new SyntaxError("unexpected end of data");
    }
    return bytes;
  };
};

// node_modules/@atcute/multibase/dist/bases/base64-web-native.js
var fromBase64Url = (str) => {
  return Uint8Array.fromBase64(str, {
    alphabet: "base64url",
    lastChunkHandling: "loose"
  });
};
var toBase64Url = (bytes) => {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
};

// node_modules/@atcute/multibase/dist/bases/base64-web-polyfill.js
var BASE64URL_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
var fromBase64Url2 = /* @__PURE__ */ createRfc4648Decode(BASE64URL_CHARSET, 6, false);
var toBase64Url2 = /* @__PURE__ */ createRfc4648Encode(BASE64URL_CHARSET, 6, false);

// node_modules/@atcute/multibase/dist/bases/base64-web.js
var HAS_NATIVE_SUPPORT = "fromBase64" in Uint8Array;
var fromBase64Url3 = !HAS_NATIVE_SUPPORT ? fromBase64Url2 : fromBase64Url;
var toBase64Url3 = !HAS_NATIVE_SUPPORT ? toBase64Url2 : toBase64Url;

// node_modules/@atcute/oauth-crypto/dist/internal/crypto.js
var HASH_BY_ALG = {
  ES256: "SHA-256",
  ES384: "SHA-384",
  ES512: "SHA-512",
  PS256: "SHA-256",
  PS384: "SHA-384",
  PS512: "SHA-512",
  RS256: "SHA-256",
  RS384: "SHA-384",
  RS512: "SHA-512"
};
var CURVE_BY_ALG = {
  ES256: "P-256",
  ES384: "P-384",
  ES512: "P-521",
  PS256: null,
  PS384: null,
  PS512: null,
  RS256: null,
  RS384: null,
  RS512: null
};
var getHashName = (alg) => {
  return HASH_BY_ALG[alg];
};
var getNamedCurve = (alg) => {
  return CURVE_BY_ALG[alg];
};
var getSignAlgorithm = (alg) => {
  if (alg.startsWith("ES")) {
    return { name: "ECDSA", hash: { name: getHashName(alg) } };
  }
  if (alg.startsWith("PS")) {
    return {
      name: "RSA-PSS",
      hash: { name: getHashName(alg) },
      saltLength: getHashLength(getHashName(alg))
    };
  }
  return { name: "RSASSA-PKCS1-v1_5" };
};
var getImportAlgorithm = (alg, curve) => {
  if (alg.startsWith("ES")) {
    const namedCurve = curve ?? getNamedCurve(alg);
    if (!namedCurve) {
      throw new Error(`unable to determine curve for ${alg}`);
    }
    return { name: "ECDSA", namedCurve };
  }
  if (alg.startsWith("PS")) {
    return { name: "RSA-PSS", hash: { name: getHashName(alg) } };
  }
  return { name: "RSASSA-PKCS1-v1_5", hash: { name: getHashName(alg) } };
};
var getGenerateAlgorithm = (alg) => {
  const curve = getNamedCurve(alg);
  if (curve) {
    return { name: "ECDSA", namedCurve: curve };
  }
  const hash = { name: getHashName(alg) };
  return {
    name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
    hash,
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1])
  };
};
var getHashLength = (hash) => {
  switch (hash) {
    case "SHA-256":
      return 32;
    case "SHA-384":
      return 48;
    case "SHA-512":
      return 64;
  }
};

// node_modules/@atcute/oauth-crypto/dist/internal/jwk.js
var SIGNING_ALGORITHMS = [
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
  "RS256",
  "RS384",
  "RS512"
];
var isSigningAlgorithm = (alg) => {
  return SIGNING_ALGORITHMS.includes(alg);
};
var derivePublicJwk = (privateJwk, kid, alg) => {
  if (privateJwk.kty === "EC") {
    const { crv, x: x3, y: y3 } = privateJwk;
    return { kty: "EC", crv, x: x3, y: y3, kid, alg, use: "sig" };
  }
  if (privateJwk.kty === "RSA") {
    const { n, e } = privateJwk;
    return { kty: "RSA", n, e, kid, alg, use: "sig" };
  }
  throw new Error(`unsupported key type`);
};
var importPrivateKeyFromJwk = async (jwk, alg) => {
  if (!("d" in jwk) || !jwk.d) {
    throw new Error(`expected a private key (missing 'd' parameter)`);
  }
  if (jwk.kty === "EC" && !alg.startsWith("ES")) {
    throw new Error(`algorithm ${alg} does not match ec key`);
  }
  if (jwk.kty === "RSA" && alg.startsWith("ES")) {
    throw new Error(`algorithm ${alg} does not match rsa key`);
  }
  const algorithm = getImportAlgorithm(alg, jwk.kty === "EC" ? jwk.crv : void 0);
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, true, ["sign"]);
  if (!(key instanceof CryptoKey)) {
    throw new Error(`expected asymmetric key, got symmetric`);
  }
  return key;
};
var exportPrivateJwkFromKey = async (key, alg, kid) => {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  jwk.alg = alg;
  if (kid) {
    jwk.kid = kid;
  }
  return jwk;
};

// node_modules/@atcute/oauth-crypto/dist/internal/key-cache.js
var keyCache = /* @__PURE__ */ new WeakMap();
var getCachedKeyMaterial = async (jwk) => {
  const cached = keyCache.get(jwk);
  if (cached) {
    return cached;
  }
  const { alg } = jwk;
  const cryptoKey = await importPrivateKeyFromJwk(jwk, alg);
  const publicJwk = derivePublicJwk(jwk, jwk.kid, alg);
  const material = { cryptoKey, publicJwk };
  keyCache.set(jwk, material);
  return material;
};
var setCachedKeyMaterial = (jwk, cryptoKey) => {
  const publicJwk = derivePublicJwk(jwk, jwk.kid, jwk.alg);
  keyCache.set(jwk, { cryptoKey, publicJwk });
};

// node_modules/@atcute/oauth-crypto/dist/jwt/index.js
var signJwt = async (params) => {
  const { header, payload, key, alg } = params;
  const fullHeader = { ...header, alg };
  const headerSegment = encodeSegment(fullHeader);
  const payloadSegment = encodeSegment(payload);
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = await crypto.subtle.sign(getSignAlgorithm(alg), key, encodeUtf8(signingInput));
  const signatureSegment = toBase64Url3(new Uint8Array(signature));
  return `${signingInput}.${signatureSegment}`;
};
var encodeSegment = (value) => {
  return toBase64Url3(encodeUtf8(JSON.stringify(value)));
};

// node_modules/@atcute/oauth-crypto/dist/hash/sha256.js
var sha256Base64Url = async (input) => {
  const bytes = encodeUtf8(input);
  const digest = await toSha256(bytes);
  return toBase64Url3(digest);
};

// node_modules/@atcute/oauth-crypto/dist/dpop/proof.js
var createDpopProofSigner = (jwk) => {
  const alg = jwk.alg;
  let materialPromise;
  return async (htm, htu, nonce, ath) => {
    materialPromise ||= getCachedKeyMaterial(jwk);
    const { cryptoKey, publicJwk } = await materialPromise;
    const now2 = Math.floor(Date.now() / 1e3);
    return signJwt({
      header: {
        typ: "dpop+jwt",
        jwk: publicJwk
      },
      payload: {
        htm,
        htu,
        iat: now2,
        jti: nanoid(24),
        nonce,
        ath
      },
      key: cryptoKey,
      alg
    });
  };
};

// node_modules/@atcute/oauth-crypto/dist/dpop/generate-key.js
var PREFERRED_ALGORITHMS = [
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
  "RS256",
  "RS384",
  "RS512"
];
var sortAlgorithms = (algs) => {
  return [...algs].sort((a2, b) => {
    const aIdx = PREFERRED_ALGORITHMS.indexOf(a2);
    const bIdx = PREFERRED_ALGORITHMS.indexOf(b);
    if (aIdx === -1 && bIdx === -1) {
      return 0;
    }
    if (aIdx === -1) {
      return 1;
    }
    if (bIdx === -1) {
      return -1;
    }
    return aIdx - bIdx;
  });
};
var generateDpopKey = async (supportedAlgs) => {
  const normalized = supportedAlgs?.filter(isSigningAlgorithm) ?? [];
  if (supportedAlgs?.length && normalized.length === 0) {
    throw new Error(`no supported algorithms provided`);
  }
  const algs = normalized.length ? sortAlgorithms(normalized) : ["ES256"];
  const errors = [];
  for (const alg of algs) {
    try {
      const pair = await crypto.subtle.generateKey(getGenerateAlgorithm(alg), true, ["sign", "verify"]);
      const jwk = await exportPrivateJwkFromKey(pair.privateKey, alg);
      setCachedKeyMaterial(jwk, pair.privateKey);
      return jwk;
    } catch (err2) {
      errors.push(err2);
    }
  }
  throw new AggregateError(errors, `failed to generate DPoP key for any of: ${algs.join(", ")}`);
};

// node_modules/@badrap/valita/dist/mjs/index.mjs
function expectedType(expected) {
  return {
    ok: false,
    code: "invalid_type",
    expected
  };
}
var ISSUE_EXPECTED_NOTHING = expectedType([]);
var ISSUE_EXPECTED_STRING = expectedType(["string"]);
var ISSUE_EXPECTED_NUMBER = expectedType(["number"]);
var ISSUE_EXPECTED_BIGINT = expectedType(["bigint"]);
var ISSUE_EXPECTED_BOOLEAN = expectedType(["boolean"]);
var ISSUE_EXPECTED_UNDEFINED = expectedType(["undefined"]);
var ISSUE_EXPECTED_NULL = expectedType(["null"]);
var ISSUE_EXPECTED_OBJECT = expectedType(["object"]);
var ISSUE_EXPECTED_ARRAY = expectedType(["array"]);
var ISSUE_MISSING_VALUE = {
  ok: false,
  code: "missing_value"
};
function joinIssues(left, right) {
  return left ? { ok: false, code: "join", left, right } : right;
}
function prependPath(key, tree) {
  return { ok: false, code: "prepend", key, tree };
}
function cloneIssueWithPath(tree, path) {
  var _a;
  const code = tree.code;
  switch (code) {
    case "invalid_type":
      return { code, path, expected: tree.expected };
    case "invalid_literal":
      return { code, path, expected: tree.expected };
    case "missing_value":
      return { code, path };
    case "invalid_length":
      return {
        code,
        path,
        minLength: tree.minLength,
        maxLength: tree.maxLength
      };
    case "unrecognized_keys":
      return { code, path, keys: tree.keys };
    case "invalid_union":
      return { code, path, tree: tree.tree, issues: collectIssues(tree.tree) };
    case "custom_error":
      if (typeof tree.error === "object" && tree.error.path !== void 0) {
        path.push(...tree.error.path);
      }
      return {
        code,
        path,
        message: typeof tree.error === "string" ? tree.error : (_a = tree.error) === null || _a === void 0 ? void 0 : _a.message,
        error: tree.error
      };
  }
}
function collectIssues(tree, path = [], issues = []) {
  for (; ; ) {
    if (tree.code === "join") {
      collectIssues(tree.left, path.slice(), issues);
      tree = tree.right;
    } else if (tree.code === "prepend") {
      path.push(tree.key);
      tree = tree.tree;
    } else {
      issues.push(cloneIssueWithPath(tree, path));
      return issues;
    }
  }
}
function separatedList(list, sep) {
  if (list.length === 0) {
    return "nothing";
  } else if (list.length === 1) {
    return list[0];
  } else {
    return `${list.slice(0, -1).join(", ")} ${sep} ${list[list.length - 1]}`;
  }
}
function formatLiteral(value) {
  return typeof value === "bigint" ? `${value}n` : JSON.stringify(value);
}
function countIssues(tree) {
  let count = 0;
  for (; ; ) {
    if (tree.code === "join") {
      count += countIssues(tree.left);
      tree = tree.right;
    } else if (tree.code === "prepend") {
      tree = tree.tree;
    } else {
      return count + 1;
    }
  }
}
function formatIssueTree(tree) {
  let path = "";
  let count = 0;
  for (; ; ) {
    if (tree.code === "join") {
      count += countIssues(tree.right);
      tree = tree.left;
    } else if (tree.code === "prepend") {
      path += `.${tree.key}`;
      tree = tree.tree;
    } else {
      break;
    }
  }
  let message = "validation failed";
  if (tree.code === "invalid_type") {
    message = `expected ${separatedList(tree.expected, "or")}`;
  } else if (tree.code === "invalid_literal") {
    message = `expected ${separatedList(tree.expected.map(formatLiteral), "or")}`;
  } else if (tree.code === "missing_value") {
    message = `missing value`;
  } else if (tree.code === "unrecognized_keys") {
    const keys = tree.keys;
    message = `unrecognized ${keys.length === 1 ? "key" : "keys"} ${separatedList(keys.map(formatLiteral), "and")}`;
  } else if (tree.code === "invalid_length") {
    const min2 = tree.minLength;
    const max2 = tree.maxLength;
    message = `expected an array with `;
    if (min2 > 0) {
      if (max2 === min2) {
        message += `${min2}`;
      } else if (max2 !== void 0) {
        message += `between ${min2} and ${max2}`;
      } else {
        message += `at least ${min2}`;
      }
    } else {
      message += `at most ${max2 !== null && max2 !== void 0 ? max2 : "\u221E"}`;
    }
    message += ` item(s)`;
  } else if (tree.code === "custom_error") {
    const error = tree.error;
    if (typeof error === "string") {
      message = error;
    } else if (error !== void 0) {
      if (error.message !== void 0) {
        message = error.message;
      }
      if (error.path !== void 0) {
        path += "." + error.path.join(".");
      }
    }
  }
  let msg = `${tree.code} at .${path.slice(1)} (${message})`;
  if (count === 1) {
    msg += ` (+ 1 other issue)`;
  } else if (count > 1) {
    msg += ` (+ ${count} other issues)`;
  }
  return msg;
}
function lazyProperty(obj, prop, value, enumerable) {
  Object.defineProperty(obj, prop, {
    value,
    enumerable,
    writable: false
  });
  return value;
}
var ValitaError = class extends Error {
  constructor(issueTree) {
    super(formatIssueTree(issueTree));
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this._issueTree = issueTree;
  }
  get issues() {
    return lazyProperty(this, "issues", collectIssues(this._issueTree), true);
  }
};
var ErrImpl = class {
  constructor(issueTree) {
    this.ok = false;
    this._issueTree = issueTree;
  }
  get issues() {
    return lazyProperty(this, "issues", collectIssues(this._issueTree), true);
  }
  get message() {
    return lazyProperty(this, "message", formatIssueTree(this._issueTree), true);
  }
  throw() {
    throw new ValitaError(this._issueTree);
  }
};
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return new ErrImpl({ ok: false, code: "custom_error", error });
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var FLAG_FORBID_EXTRA_KEYS = 1 << 0;
var FLAG_STRIP_EXTRA_KEYS = 1 << 1;
var FLAG_MISSING_VALUE = 1 << 2;
var TAG_UNKNOWN = 0;
var TAG_NEVER = 1;
var TAG_STRING = 2;
var TAG_NUMBER = 3;
var TAG_BIGINT = 4;
var TAG_BOOLEAN = 5;
var TAG_NULL = 6;
var TAG_UNDEFINED = 7;
var TAG_LITERAL = 8;
var TAG_OPTIONAL = 9;
var TAG_OBJECT = 10;
var TAG_ARRAY = 11;
var TAG_UNION = 12;
var TAG_SIMPLE_UNION = 13;
var TAG_TRANSFORM = 14;
var TAG_OTHER = 15;
var taggedMatcher = (tag, match) => {
  return { tag, match };
};
function callMatcher(matcher, value, flags) {
  switch (matcher.tag) {
    case TAG_UNKNOWN:
      return void 0;
    case TAG_NEVER:
      return ISSUE_EXPECTED_NOTHING;
    case TAG_STRING:
      return typeof value === "string" ? void 0 : ISSUE_EXPECTED_STRING;
    case TAG_NUMBER:
      return typeof value === "number" ? void 0 : ISSUE_EXPECTED_NUMBER;
    case TAG_BIGINT:
      return typeof value === "bigint" ? void 0 : ISSUE_EXPECTED_BIGINT;
    case TAG_BOOLEAN:
      return typeof value === "boolean" ? void 0 : ISSUE_EXPECTED_BOOLEAN;
    case TAG_NULL:
      return value === null ? void 0 : ISSUE_EXPECTED_NULL;
    case TAG_UNDEFINED:
      return value === void 0 ? void 0 : ISSUE_EXPECTED_UNDEFINED;
    case TAG_LITERAL:
      return matcher.match(value, flags);
    case TAG_OPTIONAL:
      return matcher.match(value, flags);
    case TAG_OBJECT:
      return matcher.match(value, flags);
    case TAG_ARRAY:
      return matcher.match(value, flags);
    case TAG_UNION:
      return matcher.match(value, flags);
    case TAG_SIMPLE_UNION:
      return matcher.match(value, flags);
    case TAG_TRANSFORM:
      return matcher.match(value, flags);
    default:
      return matcher.match(value, flags);
  }
}
var MATCHER_SYMBOL = Symbol.for("@valita/internal");
var AbstractType = class {
  default(defaultValue) {
    const defaultResult = ok(defaultValue);
    return new TransformType(this.optional(), (v) => {
      return v === void 0 ? defaultResult : void 0;
    });
  }
  /**
   * Derive a new validator that uses the provided predicate function to
   * perform custom validation for the source validator's output values.
   *
   * The predicate function should return `true` when the source
   * type's output value is valid, `false` otherwise. The checked value
   * itself won't get modified or replaced, and is returned as-is on
   * validation success.
   *
   * @example A validator that accepts only numeric strings.
   * ```ts
   * const numericString = v.string().assert((s) => /^\d+$/.test(s))
   * numericString.parse("1");
   * // "1"
   * numericString.parse("foo");
   * // ValitaError: custom_error at . (validation failed)
   * ```
   *
   * You can also _refine_ the output type by passing in a
   * [type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
   * Note that the type predicate must have a compatible input type.
   *
   * @example A validator with its output type refined to `Date`.
   * ```ts
   * const dateType = v.unknown().assert((v): v is Date => v instanceof Date);
   * ```
   *
   * You can also pass in a custom failure messages.
   *
   * @example A validator that rejects non-integers with a custom error.
   * ```ts
   * const integer = v.number().assert((n) => Number.isInteger(n), "not an integer");
   * integer.parse(1);
   * // 1
   * integer.parse(1.5);
   * // ValitaError: custom_error at . (not an integer)
   * ```
   *
   * @param func - The assertion predicate function.
   * @param [error] - A custom error for situations when the assertion
   *                  predicate returns `false`.
   */
  assert(func, error) {
    const err2 = { ok: false, code: "custom_error", error };
    return new TransformType(this, (v, flags) => func(v, flagsToOptions(flags)) ? void 0 : err2);
  }
  map(func) {
    return new TransformType(this, (v, flags) => ({
      ok: true,
      value: func(v, flagsToOptions(flags))
    }));
  }
  chain(input) {
    if (typeof input === "function") {
      return new TransformType(this, (v, flags) => {
        const r = input(v, flagsToOptions(flags));
        return r.ok ? r : r._issueTree;
      });
    }
    return new TransformType(this, (v, flags) => callMatcher(input[MATCHER_SYMBOL], v, flags));
  }
};
var Type = class extends AbstractType {
  optional(defaultFn) {
    const optional = new Optional(this);
    if (!defaultFn) {
      return optional;
    }
    return new TransformType(optional, (v) => {
      return v === void 0 ? { ok: true, value: defaultFn() } : void 0;
    });
  }
  nullable(defaultFn) {
    const nullable = new SimpleUnion([null_(), this]);
    if (!defaultFn) {
      return nullable;
    }
    return new TransformType(nullable, (v) => {
      return v === null ? { ok: true, value: defaultFn() } : void 0;
    });
  }
  _toTerminals(func) {
    func(this);
  }
  /**
   * Parse a value without throwing.
   */
  try(v, options) {
    const r = callMatcher(this[MATCHER_SYMBOL], v, options === void 0 ? FLAG_FORBID_EXTRA_KEYS : options.mode === "strip" ? FLAG_STRIP_EXTRA_KEYS : options.mode === "passthrough" ? 0 : FLAG_FORBID_EXTRA_KEYS);
    return r === void 0 || r.ok ? { ok: true, value: r === void 0 ? v : r.value } : new ErrImpl(r);
  }
  /**
   * Parse a value. Throw a ValitaError on failure.
   */
  parse(v, options) {
    const r = callMatcher(this[MATCHER_SYMBOL], v, options === void 0 ? FLAG_FORBID_EXTRA_KEYS : options.mode === "strip" ? FLAG_STRIP_EXTRA_KEYS : options.mode === "passthrough" ? 0 : FLAG_FORBID_EXTRA_KEYS);
    if (r === void 0 || r.ok) {
      return r === void 0 ? v : r.value;
    }
    throw new ValitaError(r);
  }
};
var SimpleUnion = class extends Type {
  constructor(options) {
    super();
    this.name = "union";
    this.options = options;
  }
  get [MATCHER_SYMBOL]() {
    const options = this.options.map((o) => o[MATCHER_SYMBOL]);
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_SIMPLE_UNION, (v, flags) => {
      let issue = ISSUE_EXPECTED_NOTHING;
      for (const option of options) {
        const result = callMatcher(option, v, flags);
        if (result === void 0 || result.ok) {
          return result;
        }
        issue = result;
      }
      return issue;
    }), false);
  }
  _toTerminals(func) {
    for (const option of this.options) {
      option._toTerminals(func);
    }
  }
};
var Optional = class extends AbstractType {
  constructor(type2) {
    super();
    this.name = "optional";
    this.type = type2;
  }
  optional(defaultFn) {
    if (!defaultFn) {
      return this;
    }
    return new TransformType(this, (v) => {
      return v === void 0 ? { ok: true, value: defaultFn() } : void 0;
    });
  }
  get [MATCHER_SYMBOL]() {
    const matcher = this.type[MATCHER_SYMBOL];
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_OPTIONAL, (v, flags) => v === void 0 || flags & FLAG_MISSING_VALUE ? void 0 : callMatcher(matcher, v, flags)), false);
  }
  _toTerminals(func) {
    func(this);
    func(undefined_());
    this.type._toTerminals(func);
  }
};
function setBit(bits, index2) {
  if (typeof bits !== "number") {
    const idx = index2 >> 5;
    for (let i = bits.length; i <= idx; i++) {
      bits.push(0);
    }
    bits[idx] |= 1 << index2 % 32;
    return bits;
  } else if (index2 < 32) {
    return bits | 1 << index2;
  } else {
    return setBit([bits, 0], index2);
  }
}
function getBit(bits, index2) {
  if (typeof bits === "number") {
    return index2 < 32 ? bits >>> index2 & 1 : 0;
  } else {
    return bits[index2 >> 5] >>> index2 % 32 & 1;
  }
}
var ObjectType = class _ObjectType extends Type {
  constructor(shape, restType, checks) {
    super();
    this.name = "object";
    this.shape = shape;
    this._restType = restType;
    this._checks = checks;
  }
  get [MATCHER_SYMBOL]() {
    const func = createObjectMatcher(this.shape, this._restType, this._checks);
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_OBJECT, (v, flags) => isObject(v) ? func(v, flags) : ISSUE_EXPECTED_OBJECT), false);
  }
  check(func, error) {
    var _a;
    const issue = { ok: false, code: "custom_error", error };
    return new _ObjectType(this.shape, this._restType, [
      ...(_a = this._checks) !== null && _a !== void 0 ? _a : [],
      {
        func,
        issue
      }
    ]);
  }
  rest(restType) {
    return new _ObjectType(this.shape, restType);
  }
  extend(shape) {
    return new _ObjectType(Object.assign(Object.assign({}, this.shape), shape), this._restType);
  }
  pick(...keys) {
    const shape = {};
    for (const key of keys) {
      set(shape, key, this.shape[key]);
    }
    return new _ObjectType(shape, void 0);
  }
  omit(...keys) {
    const shape = Object.assign({}, this.shape);
    for (const key of keys) {
      delete shape[key];
    }
    return new _ObjectType(shape, this._restType);
  }
  partial() {
    var _a;
    const shape = {};
    for (const key of Object.keys(this.shape)) {
      set(shape, key, this.shape[key].optional());
    }
    const rest = (_a = this._restType) === null || _a === void 0 ? void 0 : _a.optional();
    return new _ObjectType(shape, rest);
  }
};
function set(obj, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    obj[key] = value;
  }
}
function createObjectMatcher(shape, rest, checks) {
  const indexedEntries = Object.keys(shape).map((key, index2) => {
    const type2 = shape[key];
    let optional = false;
    type2._toTerminals((t) => {
      optional || (optional = t.name === "optional");
    });
    return {
      key,
      index: index2,
      matcher: type2[MATCHER_SYMBOL],
      optional,
      missing: prependPath(key, ISSUE_MISSING_VALUE)
    };
  });
  const keyedEntries = /* @__PURE__ */ Object.create(null);
  for (const entry of indexedEntries) {
    keyedEntries[entry.key] = entry;
  }
  const restMatcher = rest === null || rest === void 0 ? void 0 : rest[MATCHER_SYMBOL];
  const fastPath = indexedEntries.length === 0 && (rest === null || rest === void 0 ? void 0 : rest.name) === "unknown" && checks === void 0;
  return (obj, flags) => {
    if (fastPath) {
      return void 0;
    }
    let output = void 0;
    let issues = void 0;
    let unrecognized = void 0;
    let seenBits = 0;
    let seenCount = 0;
    if (flags & (FLAG_FORBID_EXTRA_KEYS | FLAG_STRIP_EXTRA_KEYS) || restMatcher !== void 0) {
      for (const key in obj) {
        const value = obj[key];
        const entry = keyedEntries[key];
        if (entry === void 0 && restMatcher === void 0) {
          if (flags & FLAG_FORBID_EXTRA_KEYS) {
            if (unrecognized === void 0) {
              unrecognized = [key];
              issues = joinIssues(issues, {
                ok: false,
                code: "unrecognized_keys",
                keys: unrecognized
              });
            } else {
              unrecognized.push(key);
            }
          } else if (flags & FLAG_STRIP_EXTRA_KEYS && issues === void 0 && output === void 0) {
            output = {};
            for (let m2 = 0; m2 < indexedEntries.length; m2++) {
              if (getBit(seenBits, m2)) {
                const k = indexedEntries[m2].key;
                set(output, k, obj[k]);
              }
            }
          }
          continue;
        }
        const r = entry === void 0 ? callMatcher(restMatcher, value, flags) : callMatcher(entry.matcher, value, flags);
        if (r === void 0) {
          if (output !== void 0 && issues === void 0) {
            set(output, key, value);
          }
        } else if (!r.ok) {
          issues = joinIssues(issues, prependPath(key, r));
        } else if (issues === void 0) {
          if (output === void 0) {
            output = {};
            if (restMatcher === void 0) {
              for (let m2 = 0; m2 < indexedEntries.length; m2++) {
                if (getBit(seenBits, m2)) {
                  const k = indexedEntries[m2].key;
                  set(output, k, obj[k]);
                }
              }
            } else {
              for (const k in obj) {
                set(output, k, obj[k]);
              }
            }
          }
          set(output, key, r.value);
        }
        if (entry !== void 0) {
          seenCount++;
          seenBits = setBit(seenBits, entry.index);
        }
      }
    }
    if (seenCount < indexedEntries.length) {
      for (let i = 0; i < indexedEntries.length; i++) {
        if (getBit(seenBits, i)) {
          continue;
        }
        const entry = indexedEntries[i];
        const value = obj[entry.key];
        let extraFlags = 0;
        if (value === void 0 && !(entry.key in obj)) {
          if (!entry.optional) {
            issues = joinIssues(issues, entry.missing);
            continue;
          }
          extraFlags = FLAG_MISSING_VALUE;
        }
        const r = callMatcher(entry.matcher, value, flags | extraFlags);
        if (r === void 0) {
          if (output !== void 0 && issues === void 0 && !extraFlags) {
            set(output, entry.key, value);
          }
        } else if (!r.ok) {
          issues = joinIssues(issues, prependPath(entry.key, r));
        } else if (issues === void 0) {
          if (output === void 0) {
            output = {};
            if (restMatcher === void 0) {
              for (let m2 = 0; m2 < indexedEntries.length; m2++) {
                if (m2 < i || getBit(seenBits, m2)) {
                  const k = indexedEntries[m2].key;
                  set(output, k, obj[k]);
                }
              }
            } else {
              for (const k in obj) {
                set(output, k, obj[k]);
              }
              for (let m2 = 0; m2 < i; m2++) {
                if (!getBit(seenBits, m2)) {
                  const k = indexedEntries[m2].key;
                  set(output, k, obj[k]);
                }
              }
            }
          }
          set(output, entry.key, r.value);
        }
      }
    }
    if (issues !== void 0) {
      return issues;
    }
    if (checks !== void 0) {
      for (const { func, issue } of checks) {
        if (!func(output !== null && output !== void 0 ? output : obj)) {
          return issue;
        }
      }
    }
    return output && { ok: true, value: output };
  };
}
var ArrayOrTupleType = class _ArrayOrTupleType extends Type {
  constructor(prefix, rest, suffix) {
    super();
    this.name = "array";
    this._prefix = prefix;
    this._rest = rest;
    this._suffix = suffix;
  }
  get [MATCHER_SYMBOL]() {
    var _a, _b;
    const prefix = this._prefix.map((t) => t[MATCHER_SYMBOL]);
    const suffix = this._suffix.map((t) => t[MATCHER_SYMBOL]);
    const rest = (_b = (_a = this._rest) === null || _a === void 0 ? void 0 : _a[MATCHER_SYMBOL]) !== null && _b !== void 0 ? _b : taggedMatcher(1, () => ISSUE_MISSING_VALUE);
    const minLength = prefix.length + suffix.length;
    const maxLength = this._rest ? Infinity : minLength;
    const invalidLength = {
      ok: false,
      code: "invalid_length",
      minLength,
      maxLength: maxLength === Infinity ? void 0 : maxLength
    };
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_ARRAY, (arr, flags) => {
      if (!Array.isArray(arr)) {
        return ISSUE_EXPECTED_ARRAY;
      }
      const length = arr.length;
      if (length < minLength || length > maxLength) {
        return invalidLength;
      }
      const headEnd = prefix.length;
      const tailStart = arr.length - suffix.length;
      let issueTree = void 0;
      let output = arr;
      for (let i = 0; i < arr.length; i++) {
        const entry = i < headEnd ? prefix[i] : i >= tailStart ? suffix[i - tailStart] : rest;
        const r = callMatcher(entry, arr[i], flags);
        if (r !== void 0) {
          if (r.ok) {
            if (output === arr) {
              output = arr.slice();
            }
            output[i] = r.value;
          } else {
            issueTree = joinIssues(issueTree, prependPath(i, r));
          }
        }
      }
      if (issueTree) {
        return issueTree;
      } else if (arr === output) {
        return void 0;
      } else {
        return { ok: true, value: output };
      }
    }), false);
  }
  concat(type2) {
    if (this._rest) {
      if (type2._rest) {
        throw new TypeError("can not concatenate two variadic types");
      }
      return new _ArrayOrTupleType(this._prefix, this._rest, [
        ...this._suffix,
        ...type2._prefix,
        ...type2._suffix
      ]);
    } else if (type2._rest) {
      return new _ArrayOrTupleType([...this._prefix, ...this._suffix, ...type2._prefix], type2._rest, type2._suffix);
    } else {
      return new _ArrayOrTupleType([...this._prefix, ...this._suffix, ...type2._prefix, ...type2._suffix], type2._rest, type2._suffix);
    }
  }
};
function toInputType(v) {
  const type2 = typeof v;
  if (type2 !== "object") {
    return type2;
  } else if (v === null) {
    return "null";
  } else if (Array.isArray(v)) {
    return "array";
  } else {
    return type2;
  }
}
function dedup(arr) {
  return [...new Set(arr)];
}
function groupTerminals(terminals) {
  var _a, _b, _c;
  const order = /* @__PURE__ */ new Map();
  const literals = /* @__PURE__ */ new Map();
  const types = /* @__PURE__ */ new Map();
  const unknowns = [];
  const optionals = [];
  const expectedTypes = [];
  for (const { root: root2, terminal } of terminals) {
    order.set(root2, (_a = order.get(root2)) !== null && _a !== void 0 ? _a : order.size);
    if (terminal.name === "never") {
    } else if (terminal.name === "optional") {
      optionals.push(root2);
    } else if (terminal.name === "unknown") {
      unknowns.push(root2);
    } else if (terminal.name === "literal") {
      const roots = (_b = literals.get(terminal.value)) !== null && _b !== void 0 ? _b : [];
      roots.push(root2);
      literals.set(terminal.value, roots);
      expectedTypes.push(toInputType(terminal.value));
    } else {
      const roots = (_c = types.get(terminal.name)) !== null && _c !== void 0 ? _c : [];
      roots.push(root2);
      types.set(terminal.name, roots);
      expectedTypes.push(terminal.name);
    }
  }
  const byOrder = (a2, b) => {
    var _a2, _b2;
    return ((_a2 = order.get(a2)) !== null && _a2 !== void 0 ? _a2 : 0) - ((_b2 = order.get(b)) !== null && _b2 !== void 0 ? _b2 : 0);
  };
  for (const [value, roots] of literals) {
    const options = types.get(toInputType(value));
    if (options) {
      options.push(...roots);
      literals.delete(value);
    } else {
      literals.set(value, dedup(roots.concat(unknowns)).sort(byOrder));
    }
  }
  for (const [type2, roots] of types) {
    types.set(type2, dedup(roots.concat(unknowns)).sort(byOrder));
  }
  return {
    types,
    literals,
    unknowns: dedup(unknowns).sort(byOrder),
    optionals: dedup(optionals).sort(byOrder),
    expectedTypes: dedup(expectedTypes)
  };
}
function createObjectKeyMatcher(objects, key) {
  var _a;
  const list = [];
  for (const { root: root2, terminal } of objects) {
    terminal.shape[key]._toTerminals((t) => list.push({ root: root2, terminal: t }));
  }
  const { types, literals, optionals, unknowns, expectedTypes } = groupTerminals(list);
  if (unknowns.length > 0 || optionals.length > 1) {
    return void 0;
  }
  for (const roots of literals.values()) {
    if (roots.length > 1) {
      return void 0;
    }
  }
  for (const roots of types.values()) {
    if (roots.length > 1) {
      return void 0;
    }
  }
  const missingValue = prependPath(key, ISSUE_MISSING_VALUE);
  const issue = prependPath(key, types.size === 0 ? {
    ok: false,
    code: "invalid_literal",
    expected: [...literals.keys()]
  } : {
    ok: false,
    code: "invalid_type",
    expected: expectedTypes
  });
  const byLiteral = literals.size > 0 ? /* @__PURE__ */ new Map() : void 0;
  if (byLiteral) {
    for (const [literal2, options] of literals) {
      byLiteral.set(literal2, options[0][MATCHER_SYMBOL]);
    }
  }
  const byType = types.size > 0 ? {} : void 0;
  if (byType) {
    for (const [type2, options] of types) {
      byType[type2] = options[0][MATCHER_SYMBOL];
    }
  }
  const optional = (_a = optionals[0]) === null || _a === void 0 ? void 0 : _a[MATCHER_SYMBOL];
  return (obj, flags) => {
    var _a2;
    const value = obj[key];
    if (value === void 0 && !(key in obj)) {
      return optional === void 0 ? missingValue : callMatcher(optional, obj, flags);
    }
    const option = (_a2 = byType === null || byType === void 0 ? void 0 : byType[toInputType(value)]) !== null && _a2 !== void 0 ? _a2 : byLiteral === null || byLiteral === void 0 ? void 0 : byLiteral.get(value);
    return option ? callMatcher(option, obj, flags) : issue;
  };
}
function createUnionObjectMatcher(terminals) {
  var _a;
  const objects = [];
  const keyCounts = /* @__PURE__ */ new Map();
  for (const { root: root2, terminal } of terminals) {
    if (terminal.name === "unknown") {
      return void 0;
    }
    if (terminal.name === "object") {
      for (const key in terminal.shape) {
        keyCounts.set(key, ((_a = keyCounts.get(key)) !== null && _a !== void 0 ? _a : 0) + 1);
      }
      objects.push({ root: root2, terminal });
    }
  }
  if (objects.length < 2) {
    return void 0;
  }
  for (const [key, count] of keyCounts) {
    if (count === objects.length) {
      const matcher = createObjectKeyMatcher(objects, key);
      if (matcher) {
        return matcher;
      }
    }
  }
  return void 0;
}
function createUnionBaseMatcher(terminals) {
  const { expectedTypes, literals, types, unknowns, optionals } = groupTerminals(terminals);
  const issue = types.size === 0 && unknowns.length === 0 ? {
    ok: false,
    code: "invalid_literal",
    expected: [...literals.keys()]
  } : {
    ok: false,
    code: "invalid_type",
    expected: expectedTypes
  };
  const byLiteral = literals.size > 0 ? /* @__PURE__ */ new Map() : void 0;
  if (byLiteral) {
    for (const [literal2, options] of literals) {
      byLiteral.set(literal2, options.map((t) => t[MATCHER_SYMBOL]));
    }
  }
  const byType = types.size > 0 ? {} : void 0;
  if (byType) {
    for (const [type2, options] of types) {
      byType[type2] = options.map((t) => t[MATCHER_SYMBOL]);
    }
  }
  const optionalMatchers = optionals.map((t) => t[MATCHER_SYMBOL]);
  const unknownMatchers = unknowns.map((t) => t[MATCHER_SYMBOL]);
  return (value, flags) => {
    var _a, _b;
    const options = flags & FLAG_MISSING_VALUE ? optionalMatchers : (_b = (_a = byType === null || byType === void 0 ? void 0 : byType[toInputType(value)]) !== null && _a !== void 0 ? _a : byLiteral === null || byLiteral === void 0 ? void 0 : byLiteral.get(value)) !== null && _b !== void 0 ? _b : unknownMatchers;
    let count = 0;
    let issueTree = issue;
    for (let i = 0; i < options.length; i++) {
      const r = callMatcher(options[i], value, flags);
      if (r === void 0 || r.ok) {
        return r;
      }
      issueTree = count > 0 ? joinIssues(issueTree, r) : r;
      count++;
    }
    if (count > 1) {
      return { ok: false, code: "invalid_union", tree: issueTree };
    }
    return issueTree;
  };
}
var UnionType = class extends Type {
  constructor(options) {
    super();
    this.name = "union";
    this.options = options;
  }
  _toTerminals(func) {
    for (const option of this.options) {
      option._toTerminals(func);
    }
  }
  get [MATCHER_SYMBOL]() {
    const flattened = [];
    for (const option of this.options) {
      option._toTerminals((terminal) => {
        flattened.push({ root: option, terminal });
      });
    }
    const base = createUnionBaseMatcher(flattened);
    const object2 = createUnionObjectMatcher(flattened);
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_UNION, (v, f) => object2 !== void 0 && isObject(v) ? object2(v, f) : base(v, f)), false);
  }
};
var STRICT = Object.freeze({ mode: "strict" });
var STRIP = Object.freeze({ mode: "strip" });
var PASSTHROUGH = Object.freeze({ mode: "passthrough" });
function flagsToOptions(flags) {
  return flags & FLAG_FORBID_EXTRA_KEYS ? STRICT : flags & FLAG_STRIP_EXTRA_KEYS ? STRIP : PASSTHROUGH;
}
var TransformType = class _TransformType extends Type {
  constructor(transformed, transform2) {
    super();
    this.name = "transform";
    this._transformed = transformed;
    this._transform = transform2;
  }
  get [MATCHER_SYMBOL]() {
    const chain = [];
    let next = this;
    while (next instanceof _TransformType) {
      chain.push(next._transform);
      next = next._transformed;
    }
    chain.reverse();
    const matcher = next[MATCHER_SYMBOL];
    const undef = ok(void 0);
    return lazyProperty(this, MATCHER_SYMBOL, taggedMatcher(TAG_TRANSFORM, (v, flags) => {
      let result = callMatcher(matcher, v, flags);
      if (result !== void 0 && !result.ok) {
        return result;
      }
      let current;
      if (result !== void 0) {
        current = result.value;
      } else if (flags & FLAG_MISSING_VALUE) {
        current = void 0;
        result = undef;
      } else {
        current = v;
      }
      for (let i = 0; i < chain.length; i++) {
        const r = chain[i](current, flags);
        if (r !== void 0) {
          if (!r.ok) {
            return r;
          }
          current = r.value;
          result = r;
        }
      }
      return result;
    }), false);
  }
  _toTerminals(func) {
    this._transformed._toTerminals(func);
  }
};
var LazyType = class extends Type {
  constructor(definer) {
    super();
    this.name = "lazy";
    this._recursing = false;
    this._definer = definer;
  }
  get type() {
    return lazyProperty(this, "type", this._definer(), true);
  }
  get [MATCHER_SYMBOL]() {
    const matcher = taggedMatcher(TAG_OTHER, (value, flags) => {
      const typeMatcher = this.type[MATCHER_SYMBOL];
      matcher.tag = typeMatcher.tag;
      matcher.match = typeMatcher.match;
      lazyProperty(this, MATCHER_SYMBOL, typeMatcher, false);
      return callMatcher(typeMatcher, value, flags);
    });
    return matcher;
  }
  _toTerminals(func) {
    if (!this._recursing) {
      this._recursing = true;
      try {
        this.type._toTerminals(func);
      } finally {
        this._recursing = false;
      }
    }
  }
};
function singleton(name, tag, match) {
  const value = taggedMatcher(tag, match);
  class SimpleType extends Type {
    constructor() {
      super();
      this.name = name;
      this[MATCHER_SYMBOL] = value;
    }
  }
  const instance = new SimpleType();
  return /* @__NO_SIDE_EFFECTS__ */ () => instance;
}
var unknown = /* @__PURE__ */ singleton("unknown", TAG_UNKNOWN, () => void 0);
var string = /* @__PURE__ */ singleton("string", TAG_STRING, (v) => typeof v === "string" ? void 0 : ISSUE_EXPECTED_STRING);
var number = /* @__PURE__ */ singleton("number", TAG_NUMBER, (v) => typeof v === "number" ? void 0 : ISSUE_EXPECTED_NUMBER);
var boolean = /* @__PURE__ */ singleton("boolean", TAG_BOOLEAN, (v) => typeof v === "boolean" ? void 0 : ISSUE_EXPECTED_BOOLEAN);
var null_ = /* @__PURE__ */ singleton("null", TAG_NULL, (v) => v === null ? void 0 : ISSUE_EXPECTED_NULL);
var undefined_ = /* @__PURE__ */ singleton("undefined", TAG_UNDEFINED, (v) => v === void 0 ? void 0 : ISSUE_EXPECTED_UNDEFINED);
var LiteralType = class extends Type {
  constructor(value) {
    super();
    this.name = "literal";
    const issue = {
      ok: false,
      code: "invalid_literal",
      expected: [value]
    };
    this[MATCHER_SYMBOL] = taggedMatcher(TAG_LITERAL, (v) => v === value ? void 0 : issue);
    this.value = value;
  }
};
var literal = (value) => {
  return /* @__PURE__ */ new LiteralType(value);
};
var object = (obj) => {
  return /* @__PURE__ */ new ObjectType(obj, void 0);
};
var record = (valueType) => {
  return /* @__PURE__ */ new ObjectType({}, valueType !== null && valueType !== void 0 ? valueType : unknown());
};
var array = (item) => {
  return /* @__PURE__ */ new ArrayOrTupleType([], item !== null && item !== void 0 ? item : unknown(), []);
};
var tuple = (items) => {
  return /* @__PURE__ */ new ArrayOrTupleType(items, void 0, []);
};
var union = (...options) => {
  return /* @__PURE__ */ new UnionType(options);
};

// node_modules/@atcute/oauth-crypto/dist/hash/pkce.js
var generatePkce = async (length = 64) => {
  const verifier = nanoid(length);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge, method: "S256" };
};

// node_modules/@atcute/oauth-browser-client/dist/utils/response.js
var extractContentType = (headers) => {
  return headers.get("content-type")?.split(";")[0];
};

// node_modules/@atcute/oauth-browser-client/dist/utils/strings.js
var isUrlParseSupported = "parse" in URL;
var isValidUrl = (urlString) => {
  let url = null;
  if (isUrlParseSupported) {
    url = URL.parse(urlString);
  } else {
    try {
      url = new URL(urlString);
    } catch {
    }
  }
  if (url !== null) {
    return url.protocol === "https:" || url.protocol === "http:";
  }
  return false;
};

// node_modules/@atcute/oauth-browser-client/dist/resolvers.js
var resolveFromIdentifier = async (ident) => {
  const identity3 = await identityResolver.resolve(ident);
  return {
    identity: identity3,
    metadata: await getMetadataFromResourceServer(identity3.pds)
  };
};
var resolveFromService = async (host) => {
  try {
    const metadata = await getMetadataFromResourceServer(host);
    return { metadata };
  } catch (err2) {
    if (err2 instanceof ResolverError) {
      try {
        const metadata = await getOAuthAuthorizationServerMetadata(host);
        return { metadata };
      } catch {
      }
    }
    throw err2;
  }
};
var getOAuthProtectedResourceMetadata = async (host) => {
  const url = new URL(`/.well-known/oauth-protected-resource`, host);
  const response = await fetch(url.href, {
    redirect: "manual",
    headers: {
      accept: "application/json"
    }
  });
  if (response.status !== 200 || extractContentType(response.headers) !== "application/json") {
    throw new ResolverError(`unexpected response`);
  }
  const metadata = await response.json();
  if (metadata.resource !== url.origin) {
    throw new ResolverError(`unexpected issuer`);
  }
  return metadata;
};
var getOAuthAuthorizationServerMetadata = async (host) => {
  const url = new URL(`/.well-known/oauth-authorization-server`, host);
  const response = await fetch(url.href, {
    redirect: "manual",
    headers: {
      accept: "application/json"
    }
  });
  if (response.status !== 200 || extractContentType(response.headers) !== "application/json") {
    throw new ResolverError(`unexpected response`);
  }
  const metadata = await response.json();
  if (metadata.issuer !== url.origin) {
    throw new ResolverError(`unexpected issuer`);
  }
  if (!isValidUrl(metadata.authorization_endpoint)) {
    throw new ResolverError(`authorization server provided incorrect authorization endpoint`);
  }
  if (!metadata.client_id_metadata_document_supported) {
    throw new ResolverError(`authorization server does not support 'client_id_metadata_document'`);
  }
  if (!metadata.pushed_authorization_request_endpoint) {
    throw new ResolverError(`authorization server does not support 'pushed_authorization request'`);
  }
  if (metadata.response_types_supported) {
    if (!metadata.response_types_supported.includes("code")) {
      throw new ResolverError(`authorization server does not support 'code' response type`);
    }
  }
  return metadata;
};
var getMetadataFromResourceServer = async (input) => {
  const rs_metadata = await getOAuthProtectedResourceMetadata(input);
  if (rs_metadata.authorization_servers?.length !== 1) {
    throw new ResolverError(`expected exactly one authorization server in the listing`);
  }
  const issuer = rs_metadata.authorization_servers[0];
  const as_metadata = await getOAuthAuthorizationServerMetadata(issuer);
  if (as_metadata.protected_resources) {
    if (!as_metadata.protected_resources.includes(rs_metadata.resource)) {
      throw new ResolverError(`server is not in authorization server's jurisdiction`);
    }
  }
  return as_metadata;
};

// node_modules/@atcute/oauth-browser-client/dist/dpop.js
var createDPoPFetch = (dpopKey, isAuthServer) => {
  const nonces = database.dpopNonces;
  const pending2 = database.inflightDpop;
  const sign = createDpopProofSigner(dpopKey);
  return async (input, init2) => {
    const request = new Request(input, init2);
    const authorizationHeader = request.headers.get("authorization");
    const ath = authorizationHeader?.startsWith("DPoP ") ? await sha256Base64Url(authorizationHeader.slice(5)) : void 0;
    const { method, url } = request;
    const { origin, pathname } = new URL(url);
    const htu = origin + pathname;
    let deferred = pending2.get(origin);
    if (deferred) {
      await deferred.promise;
      deferred = void 0;
    }
    let initNonce;
    let expiredOrMissing = false;
    try {
      const [nonce, lapsed] = nonces.getWithLapsed(origin);
      initNonce = nonce;
      expiredOrMissing = lapsed > 3 * 60 * 1e3;
    } catch {
    }
    if (expiredOrMissing) {
      pending2.set(origin, deferred = Promise.withResolvers());
    }
    let nextNonce;
    try {
      const initProof = await sign(method, htu, initNonce, ath);
      request.headers.set("dpop", initProof);
      const initResponse = await fetch(request);
      nextNonce = initResponse.headers.get("dpop-nonce");
      if (nextNonce === null || nextNonce === initNonce) {
        return initResponse;
      }
      try {
        nonces.set(origin, nextNonce);
      } catch {
      }
      const shouldRetry = await isUseDpopNonceError(initResponse, isAuthServer);
      if (!shouldRetry) {
        return initResponse;
      }
      if (input === request || init2?.body instanceof ReadableStream) {
        return initResponse;
      }
    } finally {
      if (deferred) {
        pending2.delete(origin);
        deferred.resolve();
      }
    }
    {
      const nextProof = await sign(method, htu, nextNonce, ath);
      const nextRequest = new Request(input, init2);
      nextRequest.headers.set("dpop", nextProof);
      const retryResponse = await fetch(nextRequest);
      const retryNonce = retryResponse.headers.get("dpop-nonce");
      if (retryNonce !== null && retryNonce !== nextNonce) {
        try {
          nonces.set(origin, retryNonce);
        } catch {
        }
      }
      return retryResponse;
    }
  };
};
var isUseDpopNonceError = async (response, isAuthServer) => {
  if (isAuthServer === void 0 || isAuthServer === false) {
    if (response.status === 401) {
      const wwwAuth = response.headers.get("www-authenticate");
      if (wwwAuth?.startsWith("DPoP")) {
        return wwwAuth.includes('error="use_dpop_nonce"');
      }
    }
  }
  if (isAuthServer === void 0 || isAuthServer === true) {
    if (response.status === 400 && extractContentType(response.headers) === "application/json") {
      try {
        const json = await response.clone().json();
        return typeof json === "object" && json?.["error"] === "use_dpop_nonce";
      } catch {
        return false;
      }
    }
  }
  return false;
};

// node_modules/@atcute/oauth-browser-client/dist/utils/misc.js
var pick = (obj, keys) => {
  const cloned = {};
  for (let idx = 0, len = keys.length; idx < len; idx++) {
    const key = keys[idx];
    cloned[key] = obj[key];
  }
  return cloned;
};

// node_modules/@atcute/oauth-browser-client/dist/agents/server-agent.js
var OAuthServerAgent = class {
  #fetch;
  #metadata;
  #dpopKey;
  constructor(metadata, dpopKey) {
    this.#metadata = metadata;
    this.#dpopKey = dpopKey;
    this.#fetch = createDPoPFetch(dpopKey, true);
  }
  async request(endpoint, payload) {
    const url = this.#metadata[`${endpoint}_endpoint`];
    if (!url) {
      throw new Error(`no endpoint for ${endpoint}`);
    }
    if ((endpoint === "token" || endpoint === "pushed_authorization_request") && fetchClientAssertion !== void 0) {
      const sign = createDpopProofSigner(this.#dpopKey);
      const assertion = await fetchClientAssertion({
        aud: this.#metadata.issuer,
        createDpopProof: async (url2, nonce) => {
          return await sign("POST", url2, nonce, void 0);
        }
      });
      payload = { ...payload, ...assertion };
    }
    const response = await this.#fetch(url, {
      method: "post",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, client_id: CLIENT_ID })
    });
    if (extractContentType(response.headers) !== "application/json") {
      throw new FetchResponseError(response, 2, `unexpected content-type`);
    }
    const json = await response.json();
    if (response.ok) {
      return json;
    } else {
      throw new OAuthResponseError(response, json);
    }
  }
  async revoke(token) {
    try {
      await this.request("revocation", { token });
    } catch {
    }
  }
  async exchangeCode(code, verifier) {
    const response = await this.request("token", {
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier
    });
    try {
      return await this.#processExchangeResponse(response);
    } catch (err2) {
      await this.revoke(response.access_token);
      throw err2;
    }
  }
  async refresh({ sub, token }) {
    if (!token.refresh) {
      throw new TokenRefreshError(sub, "no refresh token available");
    }
    const response = await this.request("token", {
      grant_type: "refresh_token",
      refresh_token: token.refresh
    });
    try {
      if (sub !== response.sub) {
        throw new TokenRefreshError(sub, `sub mismatch in token response; got ${response.sub}`);
      }
      return this.#processTokenResponse(response);
    } catch (err2) {
      await this.revoke(response.access_token);
      throw err2;
    }
  }
  #processTokenResponse(res) {
    if (!res.sub) {
      throw new TypeError(`missing sub field in token response`);
    }
    if (!res.scope) {
      throw new TypeError(`missing scope field in token response`);
    }
    if (res.token_type !== "DPoP") {
      throw new TypeError(`token response returned a non-dpop token`);
    }
    return {
      scope: res.scope,
      refresh: res.refresh_token,
      access: res.access_token,
      type: res.token_type,
      expires_at: typeof res.expires_in === "number" ? Date.now() + res.expires_in * 1e3 : void 0
    };
  }
  async #processExchangeResponse(res) {
    const sub = res.sub;
    if (!sub) {
      throw new TypeError(`missing sub field in token response`);
    }
    const token = this.#processTokenResponse(res);
    const resolved = await resolveFromIdentifier(sub);
    if (resolved.metadata.issuer !== this.#metadata.issuer) {
      throw new TypeError(`issuer mismatch; got ${resolved.metadata.issuer}`);
    }
    return {
      token,
      info: {
        sub,
        aud: resolved.identity.pds,
        server: pick(resolved.metadata, [
          "issuer",
          "authorization_endpoint",
          "introspection_endpoint",
          "pushed_authorization_request_endpoint",
          "revocation_endpoint",
          "token_endpoint"
        ])
      }
    };
  }
};

// node_modules/@atcute/oauth-browser-client/dist/utils/dpop-key.js
var ES256_ALG = { name: "ECDSA", namedCurve: "P-256" };
var isLegacyDpopKey = (key) => {
  return typeof key.key === "string" && typeof key.jwt === "string";
};
var migrateLegacyDpopKey = async (key) => {
  const pkcs8 = fromBase64Url3(key.key);
  const cryptoKey = await crypto.subtle.importKey("pkcs8", pkcs8, ES256_ALG, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", cryptoKey);
  jwk.alg = "ES256";
  return jwk;
};

// node_modules/@atcute/oauth-browser-client/dist/agents/sessions.js
var pending = /* @__PURE__ */ new Map();
var getSession = async (sub, options) => {
  options?.signal?.throwIfAborted();
  let allowStored = isTokenUsable;
  if (options?.noCache) {
    allowStored = returnFalse;
  } else if (options?.allowStale) {
    allowStored = returnTrue;
  }
  let previousExecutionFlow;
  while (previousExecutionFlow = pending.get(sub)) {
    try {
      const { isFresh, value: value2 } = await previousExecutionFlow;
      if (isFresh || allowStored(value2)) {
        return value2;
      }
    } catch {
    }
    options?.signal?.throwIfAborted();
  }
  const run = async () => {
    const storedSession = await migrateSessionIfNeeded(sub, database.sessions.get(sub));
    if (storedSession && allowStored(storedSession)) {
      return { isFresh: false, value: storedSession };
    }
    const newSession = await refreshToken(sub, storedSession);
    await storeSession(sub, newSession);
    return { isFresh: true, value: newSession };
  };
  let promise;
  if (locks) {
    promise = locks.request(`atcute-oauth:${sub}`, run);
  } else {
    promise = run();
  }
  promise = promise.finally(() => pending.delete(sub));
  if (pending.has(sub)) {
    throw new Error("concurrent request for the same key");
  }
  pending.set(sub, promise);
  const { value } = await promise;
  return value;
};
var storeSession = async (sub, newSession) => {
  try {
    database.sessions.set(sub, newSession);
  } catch (err2) {
    await onRefreshError(newSession);
    throw err2;
  }
};
var deleteStoredSession = (sub) => {
  database.sessions.delete(sub);
};
var returnTrue = () => true;
var returnFalse = () => false;
var refreshToken = async (sub, storedSession) => {
  if (storedSession === void 0) {
    throw new TokenRefreshError(sub, `session deleted by another tab`);
  }
  const { dpopKey, info, token } = storedSession;
  const server = new OAuthServerAgent(info.server, dpopKey);
  try {
    const newToken = await server.refresh({ sub: info.sub, token });
    return { dpopKey, info, token: newToken };
  } catch (cause) {
    if (cause instanceof OAuthResponseError && cause.status === 400 && cause.error === "invalid_grant") {
      throw new TokenRefreshError(sub, `session was revoked`, { cause });
    }
    throw cause;
  }
};
var onRefreshError = async ({ dpopKey, info, token }) => {
  const server = new OAuthServerAgent(info.server, dpopKey);
  await server.revoke(token.refresh ?? token.access);
};
var isTokenUsable = ({ token }) => {
  const expires = token.expires_at;
  return expires == null || Date.now() + 6e4 <= expires;
};
var migrateSessionIfNeeded = async (sub, session) => {
  if (!session || !isLegacyDpopKey(session.dpopKey)) {
    return session;
  }
  const dpopKey = await migrateLegacyDpopKey(session.dpopKey);
  const migrated = { ...session, dpopKey };
  try {
    database.sessions.set(sub, migrated);
  } catch {
  }
  return migrated;
};

// node_modules/@atcute/oauth-browser-client/dist/agents/exchange.js
var createAuthorizationUrl = async (options) => {
  const { target, scope, state = null, ...reqs } = options;
  let resolved;
  switch (target.type) {
    case "account": {
      resolved = await resolveFromIdentifier(target.identifier);
      break;
    }
    case "pds": {
      resolved = await resolveFromService(target.serviceUrl);
    }
  }
  const { identity: identity3, metadata } = resolved;
  const loginHint = identity3 ? identity3.handle !== "handle.invalid" ? identity3.handle : identity3.did : void 0;
  const sid = nanoid(24);
  const pkce = await generatePkce();
  const dpopKey = await generateDpopKey(["ES256"]);
  const params = {
    display: reqs.display,
    ui_locales: reqs.locale,
    prompt: reqs.prompt,
    redirect_uri: REDIRECT_URI,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
    state: sid,
    login_hint: loginHint,
    response_mode: "fragment",
    response_type: "code",
    scope
  };
  database.states.set(sid, {
    dpopKey,
    metadata,
    verifier: pkce.verifier,
    state
  });
  const server = new OAuthServerAgent(metadata, dpopKey);
  const response = await server.request("pushed_authorization_request", params);
  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("request_uri", response.request_uri);
  return authUrl;
};
var finalizeAuthorization = async (params) => {
  const issuer = params.get("iss");
  const sid = params.get("state");
  const code = params.get("code");
  const error = params.get("error");
  if (!sid || !(code || error)) {
    throw new LoginError(`missing parameters`);
  }
  const stored = database.states.get(sid);
  if (stored) {
    database.states.delete(sid);
  } else {
    throw new LoginError(`unknown state provided`);
  }
  if (error) {
    throw new AuthorizationError(params.get("error_description") || error);
  }
  if (!code) {
    throw new LoginError(`missing code parameter`);
  }
  const dpopKey = stored.dpopKey;
  const metadata = stored.metadata;
  const state = stored.state ?? null;
  if (issuer === null) {
    throw new LoginError(`missing issuer parameter`);
  } else if (issuer !== metadata.issuer) {
    throw new LoginError(`issuer mismatch`);
  }
  const server = new OAuthServerAgent(metadata, dpopKey);
  const { info, token } = await server.exchangeCode(code, stored.verifier);
  const sub = info.sub;
  const session = { dpopKey, info, token };
  await storeSession(sub, session);
  return { session, state };
};

// node_modules/@atcute/oauth-browser-client/dist/agents/user-agent.js
var OAuthUserAgent = class {
  session;
  #fetch;
  #getSessionPromise;
  constructor(session) {
    this.session = session;
    this.#fetch = createDPoPFetch(session.dpopKey, false);
  }
  get sub() {
    return this.session.info.sub;
  }
  getSession(options) {
    const promise = getSession(this.session.info.sub, options);
    promise.then((session) => {
      this.session = session;
    }).finally(() => {
      this.#getSessionPromise = void 0;
    });
    return this.#getSessionPromise = promise;
  }
  async signOut() {
    const sub = this.session.info.sub;
    try {
      const { dpopKey, info, token } = await getSession(sub, { allowStale: true });
      const server = new OAuthServerAgent(info.server, dpopKey);
      await server.revoke(token.refresh ?? token.access);
    } finally {
      deleteStoredSession(sub);
    }
  }
  async handle(pathname, init2) {
    await this.#getSessionPromise;
    const headers = new Headers(init2?.headers);
    let session = this.session;
    let url = new URL(pathname, session.info.aud);
    headers.set("authorization", `${session.token.type} ${session.token.access}`);
    let response = await this.#fetch(url.href, { ...init2, headers });
    if (!isInvalidTokenResponse(response)) {
      return response;
    }
    try {
      if (this.#getSessionPromise) {
        session = await this.#getSessionPromise;
      } else {
        session = await this.getSession();
      }
    } catch {
      return response;
    }
    if (init2?.body instanceof ReadableStream) {
      return response;
    }
    url = new URL(pathname, session.info.aud);
    headers.set("authorization", `${session.token.type} ${session.token.access}`);
    return await this.#fetch(url.href, { ...init2, headers });
  }
};
var isInvalidTokenResponse = (response) => {
  if (response.status !== 401) {
    return false;
  }
  const auth = response.headers.get("www-authenticate");
  return auth != null && (auth.startsWith("Bearer ") || auth.startsWith("DPoP ")) && auth.includes('error="invalid_token"');
};

// src/auth/oauth-handler.ts
var import_obsidian = require("obsidian");

// node_modules/@atcute/identity/dist/typedefs.js
var typedefs_exports = {};
__export(typedefs_exports, {
  FRAGMENT_RE: () => FRAGMENT_RE,
  MULTIBASE_RE: () => MULTIBASE_RE,
  didDocument: () => didDocument,
  didRelativeUri: () => didRelativeUri,
  didString: () => didString,
  multibaseString: () => multibaseString,
  rfc3968UriSchema: () => rfc3968UriSchema,
  service: () => service,
  verificationMethod: () => verificationMethod
});

// node_modules/@atcute/lexicons/dist/syntax/did.js
var DID_RE = /^did:([a-z]+):([a-zA-Z0-9._:%-]*[a-zA-Z0-9._-])$/;
var isDid = /* @__NO_SIDE_EFFECTS__ */ (input) => {
  return typeof input === "string" && input.length >= 7 && input.length <= 2048 && DID_RE.test(input);
};

// node_modules/@atcute/lexicons/dist/syntax/utils/ascii.js
var isAsciiAlpha = /* @__NO_SIDE_EFFECTS__ */ (c2) => {
  return c2 >= 65 && c2 <= 90 || c2 >= 97 && c2 <= 122;
};
var isAsciiAlphaNum = /* @__NO_SIDE_EFFECTS__ */ (c2) => {
  return /* @__PURE__ */ isAsciiAlpha(c2) || c2 >= 48 && c2 <= 57;
};

// node_modules/@atcute/lexicons/dist/syntax/handle.js
var isValidLabel = (input, start2, end) => {
  const len = end - start2;
  if (len === 0 || len > 63) {
    return false;
  }
  const first = input.charCodeAt(start2);
  if (!isAsciiAlphaNum(first)) {
    return false;
  }
  if (len > 1) {
    if (!isAsciiAlphaNum(input.charCodeAt(end - 1)))
      return false;
    for (let j = start2 + 1; j < end - 1; j++) {
      const c2 = input.charCodeAt(j);
      if (!isAsciiAlphaNum(c2) && c2 !== 45) {
        return false;
      }
    }
  }
  return true;
};
var isHandle = /* @__NO_SIDE_EFFECTS__ */ (input) => {
  if (typeof input !== "string") {
    return false;
  }
  const len = input.length;
  if (len < 3 || len > 253) {
    return false;
  }
  let labelStart = 0;
  let labelCount = 0;
  let lastLabelStart = 0;
  for (let i = 0; i <= len; i++) {
    if (i === len || input.charCodeAt(i) === 46) {
      if (!isValidLabel(input, labelStart, i)) {
        return false;
      }
      lastLabelStart = labelStart;
      labelStart = i + 1;
      labelCount++;
    }
  }
  if (labelCount < 2) {
    return false;
  }
  return isAsciiAlpha(input.charCodeAt(lastLabelStart));
};

// node_modules/@atcute/lexicons/dist/syntax/at-identifier.js
var isActorIdentifier = /* @__NO_SIDE_EFFECTS__ */ (input) => {
  return isDid(input) || isHandle(input);
};

// node_modules/@atcute/identity/dist/typedefs.js
var FRAGMENT_RE = /^#[^#]+$/;
var MULTIBASE_RE = /^z[a-km-zA-HJ-NP-Z1-9]+$/;
var rfc3968UriSchema = string().assert((input) => {
  return URL.canParse(input);
}, `must be a url`);
var didRelativeUri = string().assert((input) => {
  return FRAGMENT_RE.test(input) || URL.canParse(input);
}, `must be a did relative uri`);
var multibaseString = string().assert((input) => {
  return MULTIBASE_RE.test(input);
}, `must be a base58 multibase`);
var didString = string().assert(isDid, `must be a did`);
var verificationMethod = object({
  id: didRelativeUri,
  type: string(),
  controller: didString,
  publicKeyMultibase: multibaseString.optional(),
  publicKeyJwk: record().optional()
}).chain((input) => {
  switch (input.type) {
    case "Multikey": {
      if (input.publicKeyMultibase === void 0) {
        return err({ message: `missing multikey`, path: ["publicKeyMultibase"] });
      }
      break;
    }
    case "EcdsaSecp256k1VerificationKey2019":
    case "EcdsaSecp256r1VerificationKey2019": {
      if (input.publicKeyMultibase === void 0) {
        return err({ message: `missing multibase key`, path: ["publicKeyMultibase"] });
      }
      break;
    }
  }
  return ok(input);
});
var service = object({
  // should've only been RFC3968, but did:plc uses relative URIs.
  id: didRelativeUri,
  type: union(string(), array(string())),
  serviceEndpoint: union(rfc3968UriSchema, record(rfc3968UriSchema), array(union(rfc3968UriSchema, record(rfc3968UriSchema))))
});
var didDocument = object({
  "@context": array(rfc3968UriSchema).optional(),
  id: didString,
  alsoKnownAs: array(rfc3968UriSchema).chain((input) => {
    for (let i = 0, len = input.length; i < len; i++) {
      const aka = input[i];
      for (let j = 0; j < i; j++) {
        if (aka === input[j]) {
          return err({
            message: `duplicate "${aka}" aka entry`,
            path: [i]
          });
        }
      }
    }
    return ok(input);
  }).optional(),
  verificationMethod: array(verificationMethod).chain((input) => {
    for (let i = 0, len = input.length; i < len; i++) {
      const method = input[i];
      const methodId = method.id;
      for (let j = 0; j < i; j++) {
        if (methodId === input[j].id) {
          return err({
            message: `duplicate "${methodId}" verification method`,
            path: [i, "id"]
          });
        }
      }
    }
    return ok(input);
  }).optional(),
  service: array(service).optional(),
  controller: union(didString, array(didString)).optional(),
  authentication: array(union(didRelativeUri, verificationMethod)).optional()
}).chain((input) => {
  const { id: did, service: services } = input;
  if (services?.length) {
    const len = services.length;
    const identifiers = new Array(len);
    for (let i = 0; i < len; i++) {
      const service2 = services[i];
      let id2 = service2.id;
      if (id2[0] === "#") {
        id2 = did + id2;
      }
      identifiers[i] = id2;
    }
    for (let i = 0; i < len; i++) {
      const id2 = identifiers[i];
      for (let j = 0; j < i; j++) {
        if (id2 === identifiers[j]) {
          return err({
            message: `duplicate "${id2}" service`,
            path: ["service", i, "id"]
          });
        }
      }
    }
  }
  return ok(input);
});

// node_modules/@atcute/identity/dist/utils.js
var isUrlParseSupported2 = "parse" in URL;
var isAtprotoServiceEndpoint = (input) => {
  let url = null;
  if (isUrlParseSupported2) {
    url = URL.parse(input);
  } else {
    try {
      url = new URL(input);
    } catch {
    }
  }
  return url !== null && (url.protocol === "https:" || url.protocol === "http:") && url.pathname === "/" && url.search === "" && url.hash === "";
};
var getAtprotoHandle = (doc) => {
  const alsoKnownAs = doc.alsoKnownAs;
  if (!alsoKnownAs) {
    return null;
  }
  const PREFIX2 = "at://";
  for (let idx = 0, len = alsoKnownAs.length; idx < len; idx++) {
    const aka = alsoKnownAs[idx];
    if (!aka.startsWith(PREFIX2)) {
      continue;
    }
    const raw = aka.slice(PREFIX2.length);
    if (!isHandle(raw)) {
      return void 0;
    }
    return raw;
  }
  return null;
};
var getAtprotoServiceEndpoint = (doc, predicate) => {
  const services = doc.service;
  if (!services) {
    return;
  }
  for (let idx = 0, len = services.length; idx < len; idx++) {
    const { id: id2, type: type2, serviceEndpoint } = services[idx];
    if (id2 !== predicate.id && id2 !== doc.id + predicate.id) {
      continue;
    }
    if (predicate.type !== void 0) {
      if (Array.isArray(type2)) {
        if (!type2.includes(predicate.type)) {
          continue;
        }
      } else {
        if (type2 !== predicate.type) {
          continue;
        }
      }
    }
    if (typeof serviceEndpoint !== "string" || !isAtprotoServiceEndpoint(serviceEndpoint)) {
      continue;
    }
    return serviceEndpoint;
  }
};
var getPdsEndpoint = (doc) => {
  return getAtprotoServiceEndpoint(doc, {
    id: "#atproto_pds",
    type: "AtprotoPersonalDataServer"
  });
};

// node_modules/@atcute/identity/dist/methods/plc.js
var PLC_DID_RE = /^did:plc:([a-z2-7]{24})$/;
var isPlcDid = (input) => {
  return input.length === 32 && PLC_DID_RE.test(input);
};

// node_modules/@atcute/identity/dist/methods/web.js
var ATPROTO_WEB_DID_RE = /^did:web:([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(?:\.[a-zA-Z]{2,})|localhost(?:%3[aA]\d+)?)$/;
var isAtprotoWebDid = (input) => {
  return input.length >= 12 && ATPROTO_WEB_DID_RE.test(input);
};

// node_modules/@atcute/identity/dist/did.js
var isAtprotoDid = (input) => {
  return isPlcDid(input) || isAtprotoWebDid(input);
};
var extractDidMethod = (did) => {
  const isep = did.indexOf(":", 4);
  const method = did.slice(4, isep);
  return method;
};

// node_modules/@atcute/identity-resolver/dist/errors.js
var DidDocumentResolutionError = class extends Error {
  name = "DidResolutionError";
};
var UnsupportedDidMethodError = class extends DidDocumentResolutionError {
  did;
  name = "UnsupportedDidMethodError";
  constructor(did) {
    super(`unsupported did method; did=${did}`);
    this.did = did;
  }
};
var DocumentNotFoundError = class extends DidDocumentResolutionError {
  did;
  name = "DocumentNotFoundError";
  constructor(did) {
    super(`did document not found; did=${did}`);
    this.did = did;
  }
};
var FailedDocumentResolutionError = class extends DidDocumentResolutionError {
  did;
  name = "FailedDocumentResolutionError";
  constructor(did, options) {
    super(`failed to resolve did document; did=${did}`, options);
    this.did = did;
  }
};
var HandleResolutionError = class extends Error {
  name = "HandleResolutionError";
};
var DidNotFoundError = class extends HandleResolutionError {
  handle;
  name = "DidNotFoundError";
  constructor(handle) {
    super(`handle returned no did; handle=${handle}`);
    this.handle = handle;
  }
};
var FailedHandleResolutionError = class extends HandleResolutionError {
  handle;
  name = "FailedHandleResolutionError";
  constructor(handle, options) {
    super(`failed to resolve handle; handle=${handle}`, options);
    this.handle = handle;
  }
};
var InvalidResolvedHandleError = class extends HandleResolutionError {
  handle;
  did;
  name = "InvalidResolvedHandleError";
  constructor(handle, did) {
    super(`handle returned invalid did; handle=${handle}; did=${did}`);
    this.handle = handle;
    this.did = did;
  }
};
var AmbiguousHandleError = class extends HandleResolutionError {
  name = "AmbiguousHandleError";
  constructor(handle) {
    super(`handle returned multiple did values; handle=${handle}`);
  }
};
var ActorResolutionError = class extends Error {
  name = "ActorResolutionError";
};

// node_modules/@atcute/identity-resolver/dist/actor/local.js
var LocalActorResolver = class {
  handleResolver;
  didDocumentResolver;
  constructor(options) {
    this.handleResolver = options.handleResolver;
    this.didDocumentResolver = options.didDocumentResolver;
  }
  async resolve(actor, options) {
    const identifierIsDid = isDid(actor);
    let did;
    if (identifierIsDid) {
      did = actor;
    } else {
      try {
        did = await this.handleResolver.resolve(actor, options);
      } catch (err2) {
        throw new ActorResolutionError(`failed to resolve handle`, { cause: err2 });
      }
    }
    let doc;
    try {
      doc = await this.didDocumentResolver.resolve(did, options);
    } catch (err2) {
      throw new ActorResolutionError(`failed to resolve did document`, { cause: err2 });
    }
    const pds = getPdsEndpoint(doc);
    if (!pds) {
      throw new ActorResolutionError(`missing pds endpoint`);
    }
    let handle = "handle.invalid";
    if (identifierIsDid) {
      const writtenHandle = getAtprotoHandle(doc);
      if (writtenHandle) {
        try {
          const resolved = await this.handleResolver.resolve(writtenHandle, options);
          if (resolved === did) {
            handle = writtenHandle;
          }
        } catch {
        }
      }
    } else if (getAtprotoHandle(doc) === actor) {
      handle = actor;
    }
    return {
      did,
      handle,
      pds: new URL(pds).href
    };
  }
};

// node_modules/@atcute/identity-resolver/dist/did/composite.js
var CompositeDidDocumentResolver = class {
  #methods;
  constructor({ methods }) {
    this.#methods = new Map(Object.entries(methods));
  }
  async resolve(did, options) {
    const method = extractDidMethod(did);
    const resolver = this.#methods.get(method);
    if (resolver === void 0) {
      throw new UnsupportedDidMethodError(did);
    }
    return await resolver.resolve(did, options);
  }
};

// node_modules/@atcute/util-fetch/dist/pipeline.js
function pipe(...pipeline) {
  return pipeline.reduce(pipeTwo);
}
var pipeTwo = (first, second) => {
  return (input) => first(input).then(second);
};

// node_modules/@atcute/util-fetch/dist/errors.js
var FetchResponseError2 = class extends Error {
  name = "FetchResponseError";
};
var FailedResponseError = class extends FetchResponseError2 {
  response;
  name = "FailedResponseError";
  constructor(response) {
    super(`got http ${response.status}`);
    this.response = response;
  }
  get status() {
    return this.response.status;
  }
};
var ImproperContentTypeError = class extends FetchResponseError2 {
  contentType;
  name = "ImproperContentTypeError";
  constructor(contentType, reason) {
    super(reason);
    this.contentType = contentType;
  }
};
var ImproperContentLengthError = class extends FetchResponseError2 {
  expectedSize;
  actualSize;
  name = "ImproperContentLengthError";
  constructor(expectedSize, actualSize, reason) {
    super(reason);
    this.expectedSize = expectedSize;
    this.actualSize = actualSize;
  }
};
var ImproperResponseError = class extends FetchResponseError2 {
  name = "ImproperResponseError";
  constructor(reason, options) {
    super(reason, options);
  }
};

// node_modules/@atcute/util-fetch/dist/streams/size-limit.js
var SizeLimitStream = class extends TransformStream {
  constructor(maxSize) {
    let bytesRead = 0;
    super({
      transform(chunk, controller) {
        bytesRead += chunk.length;
        if (bytesRead > maxSize) {
          controller.error(new ImproperContentLengthError(maxSize, bytesRead, `response content-length too large`));
          return;
        }
        controller.enqueue(chunk);
      }
    });
  }
};

// node_modules/@atcute/util-fetch/dist/transformers.js
var isResponseOk = async (response) => {
  if (response.ok) {
    return response;
  }
  throw new FailedResponseError(response);
};
var readResponseAsText = (maxSize) => async (response) => {
  const text = await readResponse(response, maxSize);
  return { response, text };
};
var parseResponseAsJson = (typeRegex, maxSize) => async (response) => {
  await assertContentType(response, typeRegex);
  const text = await readResponse(response, maxSize);
  try {
    const json = JSON.parse(text);
    return { response, json };
  } catch (error) {
    throw new ImproperResponseError(`unexpected json data`, { cause: error });
  }
};
var validateJsonWith = (schema, options) => async (parsed) => {
  const json = schema.parse(parsed.json, options);
  return { response: parsed.response, json };
};
var assertContentType = async (response, typeRegex) => {
  const type2 = response.headers.get("content-type")?.split(";", 1)[0].trim();
  if (type2 === void 0) {
    if (response.body) {
      await response.body.cancel();
    }
    throw new ImproperContentTypeError(null, `missing response content-type`);
  }
  if (!typeRegex.test(type2)) {
    if (response.body) {
      await response.body.cancel();
    }
    throw new ImproperContentTypeError(type2, `unexpected response content-type`);
  }
};
var readResponse = async (response, maxSize) => {
  const rawSize = response.headers.get("content-length");
  if (rawSize !== null) {
    const size = Number(rawSize);
    if (!Number.isSafeInteger(size) || size <= 0) {
      response.body?.cancel();
      throw new ImproperContentLengthError(maxSize, null, `invalid response content-length`);
    }
    if (size > maxSize) {
      response.body?.cancel();
      throw new ImproperContentLengthError(maxSize, size, `response content-length too large`);
    }
  }
  const stream = response.body.pipeThrough(new SizeLimitStream(maxSize)).pipeThrough(new TextDecoderStream());
  let text = "";
  for await (const chunk of createStreamIterator(stream)) {
    text += chunk;
  }
  return text;
};
var createStreamIterator = Symbol.asyncIterator in ReadableStream.prototype ? (stream) => stream[Symbol.asyncIterator]() : (stream) => {
  const reader = stream.getReader();
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      return reader.read();
    },
    async return() {
      await reader.cancel();
      return { done: true, value: void 0 };
    },
    async throw(error) {
      await reader.cancel(error);
      return { done: true, value: void 0 };
    }
  };
};

// node_modules/@atcute/util-fetch/dist/doh-json.js
var uint32 = number().assert((input) => Number.isInteger(input) && input >= 0 && input <= 2 ** 32 - 1);
var question = object({
  name: string(),
  type: literal(16)
  // TXT
});
var answer = object({
  name: string(),
  type: literal(16),
  // TXT
  TTL: uint32,
  data: string().chain((input) => {
    return ok(input.replace(/^"|"$/g, "").replace(/\\"/g, '"'));
  })
});
var authority = object({
  name: string(),
  type: uint32,
  TTL: uint32,
  data: string()
});
var dohJsonTxtResult = object({
  /** DNS response code */
  Status: uint32,
  /** whether response is truncated */
  TC: boolean(),
  /** whether recursive desired bit is set, always true for Google and Cloudflare DoH */
  RD: boolean(),
  /** whether recursive available bit is set, always true for Google and Cloudflare DoH */
  RA: boolean(),
  /** whether response data was validated with DNSSEC */
  AD: boolean(),
  /** whether client asked to disable DNSSEC validation */
  CD: boolean(),
  /** requested records */
  Question: tuple([question]),
  /** answers */
  Answer: array(answer).optional(() => []),
  /** authority */
  Authority: array(authority).optional(),
  /** comment from the DNS server */
  Comment: union(string(), array(string())).optional()
});
var fetchDohJsonTxt = pipe(isResponseOk, parseResponseAsJson(/^application\/(dns-)?json$/, 16 * 1024), validateJsonWith(dohJsonTxtResult, { mode: "passthrough" }));

// node_modules/@atcute/identity-resolver/dist/did/utils.js
var fetchDocHandler = pipe(isResponseOk, parseResponseAsJson(/^application\/(did\+ld\+)?json$/, 20 * 1024), validateJsonWith(typedefs_exports.didDocument, { mode: "passthrough" }));

// node_modules/@atcute/identity-resolver/dist/did/methods/plc.js
var PlcDidDocumentResolver = class {
  apiUrl;
  #fetch;
  constructor({ apiUrl = "https://plc.directory", fetch: fetchThis = fetch } = {}) {
    this.apiUrl = apiUrl;
    this.#fetch = fetchThis;
  }
  async resolve(did, options) {
    if (!did.startsWith("did:plc:")) {
      throw new UnsupportedDidMethodError(did);
    }
    let json;
    try {
      const url = new URL(`/${encodeURIComponent(did)}`, this.apiUrl);
      const response = await (0, this.#fetch)(url, {
        signal: options?.signal,
        cache: options?.noCache ? "no-cache" : void 0,
        redirect: "manual",
        headers: { accept: "application/did+ld+json,application/json" }
      });
      if (response.status >= 300 && response.status < 400) {
        throw new TypeError(`unexpected redirect`);
      }
      const handled = await fetchDocHandler(response);
      json = handled.json;
    } catch (cause) {
      if (cause instanceof FailedResponseError && cause.status === 404) {
        throw new DocumentNotFoundError(did);
      }
      throw new FailedDocumentResolutionError(did, { cause });
    }
    return json;
  }
};

// node_modules/@atcute/identity-resolver/dist/handle/composite.js
var CompositeHandleResolver = class {
  #methods;
  strategy;
  constructor({ methods, strategy = "race" }) {
    this.#methods = methods;
    this.strategy = strategy;
  }
  async resolve(handle, options) {
    const { http, dns } = this.#methods;
    const parentSignal = options?.signal;
    const controller = new AbortController();
    if (parentSignal) {
      parentSignal.addEventListener("abort", () => controller.abort(), { signal: controller.signal });
    }
    const dnsPromise = dns.resolve(handle, { ...options, signal: controller.signal });
    const httpPromise = http.resolve(handle, { ...options, signal: controller.signal });
    switch (this.strategy) {
      case "race": {
        return new Promise((resolve) => {
          dnsPromise.then((did) => {
            controller.abort();
            resolve(did);
          }, () => resolve(httpPromise));
          httpPromise.then((did) => {
            controller.abort();
            resolve(did);
          }, () => resolve(dnsPromise));
        });
      }
      case "dns-first": {
        httpPromise.catch(noop);
        const resolved = await dnsPromise.catch(noop);
        if (resolved) {
          controller.abort();
          return resolved;
        }
        return httpPromise;
      }
      case "http-first": {
        dnsPromise.catch(noop);
        const resolved = await httpPromise.catch(noop);
        if (resolved) {
          controller.abort();
          return resolved;
        }
        return dnsPromise;
      }
      case "both": {
        const [dnsResponse, httpResponse] = await Promise.allSettled([dnsPromise, httpPromise]);
        const dnsDid = dnsResponse.status === "fulfilled" ? dnsResponse.value : void 0;
        const httpDid = httpResponse.status === "fulfilled" ? httpResponse.value : void 0;
        if (dnsDid && httpDid && dnsDid !== httpDid) {
          throw new AmbiguousHandleError(handle);
        }
        return dnsDid || httpDid || dnsPromise;
      }
    }
  }
};
var noop = () => {
};

// node_modules/@atcute/identity-resolver/dist/handle/methods/doh-json.js
var SUBDOMAIN = "_atproto";
var PREFIX = "did=";
var DohJsonHandleResolver = class {
  dohUrl;
  #fetch;
  constructor({ dohUrl, fetch: fetchThis = fetch }) {
    this.dohUrl = dohUrl;
    this.#fetch = fetchThis;
  }
  async resolve(handle, options) {
    let json;
    try {
      const url = new URL(this.dohUrl);
      url.searchParams.set("name", `${SUBDOMAIN}.${handle}`);
      url.searchParams.set("type", "TXT");
      const response = await (0, this.#fetch)(url, {
        signal: options?.signal,
        cache: options?.noCache ? "no-cache" : void 0,
        headers: { accept: "application/dns-json" }
      });
      const handled = await fetchDohJsonTxt(response);
      json = handled.json;
    } catch (cause) {
      throw new FailedHandleResolutionError(handle, { cause });
    }
    const status = json.Status;
    const answers = json.Answer;
    if (status !== 0) {
      if (status === 3) {
        throw new DidNotFoundError(handle);
      }
      throw new FailedHandleResolutionError(handle, {
        cause: new TypeError(`dns returned ${status}`)
      });
    }
    for (let i = 0, il = answers.length; i < il; i++) {
      const answer2 = answers[i];
      const data = answer2.data;
      if (!data.startsWith(PREFIX)) {
        continue;
      }
      for (let j = i + 1; j < il; j++) {
        const data2 = answers[j].data;
        if (data2.startsWith(PREFIX)) {
          throw new AmbiguousHandleError(handle);
        }
      }
      const did = data.slice(PREFIX.length);
      if (!isAtprotoDid(did)) {
        throw new InvalidResolvedHandleError(handle, did);
      }
      return did;
    }
    throw new DidNotFoundError(handle);
  }
};

// node_modules/@atcute/identity-resolver/dist/handle/methods/well-known.js
var fetchWellKnownHandler = pipe(isResponseOk, readResponseAsText(2048 + 16));
var WellKnownHandleResolver = class {
  #fetch;
  constructor({ fetch: fetchThis = fetch } = {}) {
    this.#fetch = fetchThis;
  }
  async resolve(handle, options) {
    let text;
    try {
      const url = new URL("/.well-known/atproto-did", `https://${handle}`);
      const response = await (0, this.#fetch)(url, {
        signal: options?.signal,
        cache: options?.noCache ? "no-cache" : void 0,
        redirect: "manual"
      });
      if (response.status >= 300 && response.status < 400) {
        throw new TypeError(`unexpected redirect`);
      }
      const handled = await fetchWellKnownHandler(response);
      text = handled.text;
    } catch (cause) {
      if (cause instanceof FailedResponseError && cause.status === 404) {
        throw new DidNotFoundError(handle);
      }
      throw new FailedHandleResolutionError(handle, { cause });
    }
    const did = text.split("\n")[0].trim();
    if (!isAtprotoDid(did)) {
      throw new InvalidResolvedHandleError(handle, did);
    }
    return did;
  }
};

// src/auth/resolver.ts
var handleResolver = new CompositeHandleResolver({
  strategy: "race",
  methods: {
    http: new WellKnownHandleResolver(),
    dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" })
  }
});
var didDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver()
  }
});
var compositeResolver = new LocalActorResolver({
  handleResolver,
  didDocumentResolver
});

// src/auth/oauth-handler.ts
var IDENTITY_TIMEOUT_MS = 2e4;
var CALLBACK_WAIT_MS = 5 * 6e4;
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}
var OAuthHandler = class {
  callbackResolver = null;
  callbackRejecter = null;
  callbackTimeout = null;
  pendingState = null;
  config;
  constructor(config) {
    this.config = config;
    configureOAuth({
      metadata: {
        client_id: config.clientId,
        redirect_uri: config.redirectUri
      },
      identityResolver: compositeResolver,
      storageName: config.storageName
    });
  }
  handleCallback(params) {
    if (this.callbackResolver && this.callbackRejecter) {
      if (this.callbackTimeout) {
        clearTimeout(this.callbackTimeout);
        this.callbackTimeout = null;
      }
      if (params.has("error")) {
        const error = params.get("error") || "unknown_error";
        const description = params.get("error_description") || error;
        this.callbackRejecter(new Error(`OAuth error: ${description}`));
      } else if (this.pendingState && params.get("state") !== this.pendingState) {
        this.callbackRejecter(new Error("State mismatch"));
      } else {
        this.callbackResolver(params);
      }
      this.callbackResolver = null;
      this.callbackRejecter = null;
      this.pendingState = null;
    }
  }
  async authorize(identifier) {
    let authUrl;
    try {
      authUrl = await withTimeout(
        createAuthorizationUrl({
          target: { type: "account", identifier },
          scope: this.config.scope
        }),
        IDENTITY_TIMEOUT_MS,
        "Identity resolution / PAR"
      );
    } catch (err2) {
      new import_obsidian.Notice("Failed to start authorization: " + (err2 instanceof Error ? err2.message : String(err2)));
      throw err2;
    }
    this.pendingState = authUrl.searchParams.get("state");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const waitForCallback = new Promise((resolve, reject) => {
      this.callbackResolver = resolve;
      this.callbackRejecter = reject;
      this.callbackTimeout = setTimeout(() => {
        if (this.callbackRejecter) {
          this.callbackRejecter(new Error("OAuth callback timed out after 5 minutes"));
          this.callbackResolver = null;
          this.callbackRejecter = null;
          this.pendingState = null;
        }
      }, CALLBACK_WAIT_MS);
    });
    window.open(authUrl.toString(), "_blank");
    new import_obsidian.Notice("Continue login in the browser");
    const params = await waitForCallback;
    new import_obsidian.Notice("Authorization callback received. Exchanging tokens...");
    const { session } = await finalizeAuthorization(params);
    return session;
  }
  async restore(did) {
    const session = await getSession(did, { allowStale: false });
    if (!session) {
      throw new Error("No session found for DID: " + did);
    }
    return session;
  }
  async revoke(did) {
    const session = await getSession(did, { allowStale: true });
    if (session) {
      try {
        const agent = new OAuthUserAgent(session);
        await agent.signOut();
      } catch (error) {
        console.error("Error during sign out:", error);
      }
    }
    deleteStoredSession(did);
  }
};

// node_modules/@atcute/lexicons/dist/validations/index.js
var xrpcSchemaGenerated = false;
var ok2 = /* @__NO_SIDE_EFFECTS__ */ (value) => {
  return { ok: true, value };
};
var FLAG_EMPTY = 0;
var FLAG_ABORT_EARLY = 1 << 0;
var FLAG_STRICT = 1 << 1;
var cloneIssueWithPath2 = (issue, path) => {
  const { ok: _ok, msg: _fmt, ...clone } = issue;
  return { ...clone, path };
};
var collectIssues2 = (tree, path = [], issues = []) => {
  for (; ; ) {
    switch (tree.code) {
      case "join": {
        collectIssues2(tree.left, path.slice(), issues);
        tree = tree.right;
        continue;
      }
      case "prepend": {
        path.push(tree.key);
        tree = tree.tree;
        continue;
      }
      default: {
        issues.push(cloneIssueWithPath2(tree, path));
        return issues;
      }
    }
  }
};
var countIssues2 = (tree) => {
  let count = 0;
  for (; ; ) {
    switch (tree.code) {
      case "join": {
        count += countIssues2(tree.left);
        tree = tree.right;
        continue;
      }
      case "prepend": {
        tree = tree.tree;
        continue;
      }
      default: {
        return count + 1;
      }
    }
  }
};
var formatIssueTree2 = (tree) => {
  let path = "";
  let count = 0;
  for (; ; ) {
    switch (tree.code) {
      case "join": {
        count += countIssues2(tree.right);
        tree = tree.left;
        continue;
      }
      case "prepend": {
        path += `.${tree.key}`;
        tree = tree.tree;
        continue;
      }
    }
    break;
  }
  const message = tree.msg();
  let msg = `${tree.code} at ${path || "."} (${message})`;
  if (count > 0) {
    msg += ` (+${count} other issue(s))`;
  }
  return msg;
};
var ValidationError = class extends Error {
  name = "ValidationError";
  #issueTree;
  constructor(issueTree) {
    super();
    this.#issueTree = issueTree;
  }
  get message() {
    return formatIssueTree2(this.#issueTree);
  }
  get issues() {
    return collectIssues2(this.#issueTree);
  }
};
var ErrImpl2 = class {
  ok = false;
  #issueTree;
  constructor(issueTree) {
    this.#issueTree = issueTree;
  }
  get message() {
    return formatIssueTree2(this.#issueTree);
  }
  get issues() {
    return collectIssues2(this.#issueTree);
  }
  throw() {
    throw new ValidationError(this.#issueTree);
  }
};
var safeParse = /* @__NO_SIDE_EFFECTS__ */ (schema, input, options) => {
  let flags = FLAG_EMPTY;
  if (options?.strict) {
    flags |= FLAG_STRICT;
  }
  const r = schema["~run"](input, flags);
  if (r === void 0) {
    return /* @__PURE__ */ ok2(input);
  }
  if (r.ok) {
    return r;
  }
  return new ErrImpl2(r);
};

// node_modules/@atcute/client/dist/fetch-handler.js
var buildFetchHandler = (handler) => {
  if (typeof handler === "object") {
    return handler.handle.bind(handler);
  }
  return handler;
};
var simpleFetchHandler = ({ service: service2, fetch: _fetch = fetch }) => {
  return async (pathname, init2) => {
    const url = new URL(pathname, service2);
    return await _fetch(url.href, init2);
  };
};

// node_modules/@atcute/client/dist/client.js
var JSON_CONTENT_TYPE_RE = /\bapplication\/json\b/;
var Client = class _Client {
  handler;
  proxy;
  constructor({ handler, proxy = null }) {
    this.handler = buildFetchHandler(handler);
    this.proxy = proxy;
  }
  /**
   * clones this XRPC client
   * @param opts options to merge with
   * @returns the cloned XRPC client
   */
  clone({ handler = this.handler, proxy = this.proxy } = {}) {
    return new _Client({ handler, proxy });
  }
  get(name, options = {}) {
    return this.#perform("get", name, options);
  }
  post(name, options = {}) {
    return this.#perform("post", name, options);
  }
  async call(schema, options = {}) {
    if (!xrpcSchemaGenerated) {
      return;
    }
    if ("mainSchema" in schema) {
      schema = schema.mainSchema;
    }
    if (schema.params !== null) {
      const paramsResult = safeParse(schema.params, options.params);
      if (!paramsResult.ok) {
        throw new ClientValidationError("params", paramsResult);
      }
    }
    if (schema.type === "xrpc_procedure" && schema.input?.type === "lex") {
      const inputResult = safeParse(schema.input.schema, options.input);
      if (!inputResult.ok) {
        throw new ClientValidationError("input", inputResult);
      }
    }
    const isQuery = schema.type === "xrpc_query";
    const method = isQuery ? "get" : "post";
    if (options.as === void 0 && schema.output?.type === "blob") {
      throw new TypeError(`\`as\` option is required for endpoints returning blobs`);
    }
    const format = options.as !== void 0 ? options.as : schema.output?.type === "lex" ? "json" : null;
    const response = await this.#perform(method, schema.nsid, {
      params: options.params,
      input: isQuery ? void 0 : options.input,
      as: format,
      signal: options.signal,
      headers: options.headers
    });
    if (format === "json" && response.ok && schema.output?.type === "lex") {
      const outputResult = safeParse(schema.output.schema, response.data);
      if (!outputResult.ok) {
        throw new ClientValidationError("output", outputResult);
      }
      return {
        ok: true,
        status: response.status,
        headers: response.headers,
        data: outputResult.value
      };
    }
    return response;
  }
  async #perform(method, name, { signal, as: format = "json", headers, input, params }) {
    const isWebInput = input && (input instanceof Blob || ArrayBuffer.isView(input) || input instanceof ArrayBuffer || input instanceof ReadableStream);
    const url = `/xrpc/${name}` + _constructSearchParams(params);
    const response = await this.handler(url, {
      method,
      signal,
      body: input && !isWebInput ? JSON.stringify(input) : input,
      headers: _mergeHeaders(headers, {
        "content-type": input && !isWebInput ? "application/json" : null,
        "atproto-proxy": _constructProxyHeader(this.proxy)
      }),
      duplex: input instanceof ReadableStream ? "half" : void 0
    });
    {
      const status = response.status;
      const headers2 = response.headers;
      const type2 = headers2.get("content-type");
      if (status !== 200) {
        let json;
        if (type2 != null && JSON_CONTENT_TYPE_RE.test(type2)) {
          try {
            const parsed = await response.json();
            if (isXRPCErrorPayload(parsed)) {
              json = parsed;
            }
          } catch {
          }
        } else {
          await response.body?.cancel();
        }
        return {
          ok: false,
          status,
          headers: headers2,
          data: json ?? {
            error: `UnknownXRPCError`,
            message: `Request failed with status code ${status}`
          }
        };
      }
      {
        let data;
        switch (format) {
          case "json": {
            if (type2 != null && JSON_CONTENT_TYPE_RE.test(type2)) {
              data = await response.json();
            } else {
              await response.body?.cancel();
              throw new TypeError(`Invalid response content-type (got ${type2})`);
            }
            break;
          }
          case null: {
            data = null;
            await response.body?.cancel();
            break;
          }
          case "blob": {
            data = await response.blob();
            break;
          }
          case "bytes": {
            data = new Uint8Array(await response.arrayBuffer());
            break;
          }
          case "stream": {
            data = response.body;
            break;
          }
        }
        return {
          ok: true,
          status,
          headers: headers2,
          data
        };
      }
    }
  }
};
var _constructSearchParams = (params) => {
  let searchParams;
  for (const key in params) {
    const value = params[key];
    if (value !== void 0) {
      searchParams ??= new URLSearchParams();
      if (Array.isArray(value)) {
        for (let idx = 0, len = value.length; idx < len; idx++) {
          const val = value[idx];
          searchParams.append(key, "" + val);
        }
      } else {
        searchParams.set(key, "" + value);
      }
    }
  }
  return searchParams ? `?` + searchParams.toString() : "";
};
var _constructProxyHeader = (proxy) => {
  if (proxy != null) {
    return `${proxy.did}${proxy.serviceId}`;
  }
  return null;
};
var _mergeHeaders = (init2, defaults) => {
  let headers;
  for (const name in defaults) {
    const value = defaults[name];
    if (value !== null) {
      headers ??= new Headers(init2);
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    }
  }
  return headers ?? init2;
};
var isXRPCErrorPayload = (input) => {
  if (typeof input !== "object" || input == null) {
    return false;
  }
  const kindType = typeof input.error;
  const messageType = typeof input.message;
  return kindType === "string" && (messageType === "undefined" || messageType === "string");
};
var ClientValidationError = class extends Error {
  /** validation target (params, input, or output) */
  target;
  /** validation result */
  result;
  constructor(target, result) {
    super(`validation failed for ${target}: ${result.message}`);
    this.name = "ClientValidationError";
    this.target = target;
    this.result = result;
  }
};

// src/auth/client.ts
var import_obsidian2 = require("obsidian");
var ACTOR_TIMEOUT_MS = 2e4;
function withTimeout2(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}
var CacheEntry = class {
  value;
  timestamp;
  constructor(value) {
    this.value = value;
    this.timestamp = Date.now();
  }
};
var Cache = class {
  #store = /* @__PURE__ */ new Map();
  #ttl;
  constructor(ttlMillis) {
    this.#ttl = ttlMillis;
  }
  get(key) {
    const entry = this.#store.get(key);
    if (entry) {
      if (Date.now() - entry.timestamp < this.#ttl) {
        return entry.value;
      } else {
        this.#store.delete(key);
      }
    }
    return void 0;
  }
  set(key, value) {
    this.#store.set(key, new CacheEntry(value));
  }
  clear() {
    this.#store.clear();
  }
};
var Handler = class {
  cache;
  agent;
  constructor() {
    this.cache = new Cache(5 * 60 * 1e3);
  }
  async getActor(identifier) {
    const key = `actor:${identifier}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    try {
      const res = await withTimeout2(
        compositeResolver.resolve(identifier),
        ACTOR_TIMEOUT_MS,
        "Actor resolution"
      );
      this.cache.set(key, res);
      return res;
    } catch (e) {
      throw new Error(`Failed to resolve actor ${identifier}: ${JSON.stringify(e)}`);
    }
  }
  async getPDS(pathname) {
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
  clearCache() {
    this.cache.clear();
  }
  async handle(pathname, init2) {
    const cacheKey = `${init2?.method || "GET"}:${pathname}`;
    if (init2?.method?.toLowerCase() === "get") {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached.clone();
    }
    let resp;
    const pds = await this.getPDS(pathname);
    if (pds) {
      const sfh = simpleFetchHandler({ service: pds });
      resp = await sfh(pathname, init2);
    } else if (this.agent) {
      resp = await this.agent.handle(pathname, init2);
    } else {
      const sfh = simpleFetchHandler({ service: "https://bsky.social" });
      resp = await sfh(pathname, init2);
    }
    if (init2?.method?.toLowerCase() === "get" && resp.ok) {
      this.cache.set(cacheKey, resp.clone());
    }
    return resp;
  }
};
var ATPClient = class extends Client {
  hh;
  oauth;
  actor;
  constructor(oauth) {
    const hh = new Handler();
    super({ handler: hh });
    this.oauth = oauth;
    this.hh = hh;
  }
  get loggedIn() {
    return !!this.hh.agent && !!this.actor;
  }
  async login(identifier) {
    const session = await this.oauth.authorize(identifier);
    this.hh.agent = new OAuthUserAgent(session);
    const did = this.hh.agent?.session.info.sub;
    if (did) {
      new import_obsidian2.Notice("Tokens received. Resolving identity...");
      this.actor = await this.hh.getActor(did);
      new import_obsidian2.Notice(`Logged in as @${this.actor.handle ?? this.actor.did}`);
    }
  }
  async restoreSession(did) {
    const session = await this.oauth.restore(did);
    this.hh.agent = new OAuthUserAgent(session);
    this.actor = await this.hh.getActor(did);
  }
  async logout(identifier) {
    await this.oauth.revoke(identifier);
    this.hh.agent = void 0;
    this.actor = void 0;
  }
  async getActor(identifier) {
    return this.hh.getActor(identifier);
  }
  clearCache() {
    this.hh.clearCache();
  }
  handleOAuthCallback(params) {
    this.oauth.handleCallback(params);
  }
};

// src/auth/auth-manager.ts
var STORAGE_KEY = "atp_auth_did";
var AtpAuthManager = class {
  plugin;
  protocolScheme;
  oauthHandler;
  atpClient;
  did;
  constructor(options) {
    this.plugin = options.plugin;
    this.protocolScheme = options.protocolScheme;
    this.oauthHandler = new OAuthHandler({
      clientId: options.clientId,
      redirectUri: options.redirectUri,
      scope: options.scope,
      storageName: options.storageName
    });
    this.atpClient = new ATPClient(this.oauthHandler);
  }
  async initialize() {
    this.plugin.registerObsidianProtocolHandler(this.protocolScheme, (params) => {
      try {
        const urlParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value) urlParams.set(key, String(value));
        }
        if (urlParams.has("error")) {
          const error = urlParams.get("error") || "unknown";
          const desc = urlParams.get("error_description") || error;
          new import_obsidian3.Notice(`OAuth error: ${desc}`);
          console.error("OAuth callback error:", desc);
          return;
        }
        if (!urlParams.has("code")) {
          new import_obsidian3.Notice("OAuth callback missing authorization code.");
          return;
        }
        this.atpClient.handleOAuthCallback(urlParams);
        new import_obsidian3.Notice("Finishing login...");
      } catch (error) {
        console.error("OAuth callback error:", error);
        new import_obsidian3.Notice("Authentication error: " + (error instanceof Error ? error.message : String(error)));
      }
    });
    const saved = await this.plugin.loadData();
    this.did = saved?.[STORAGE_KEY];
    if (this.did) {
      try {
        await this.atpClient.restoreSession(this.did);
      } catch (e) {
        console.warn("Failed to restore session:", e);
        this.did = void 0;
        await this._persist();
      }
    }
  }
  get client() {
    return this.atpClient;
  }
  get actor() {
    return this.atpClient.actor;
  }
  get isLoggedIn() {
    return this.atpClient.loggedIn;
  }
  get handle() {
    return this.atpClient.actor?.handle;
  }
  async login(identifier) {
    await this.atpClient.login(identifier);
    this.did = this.atpClient.actor?.did;
    await this._persist();
  }
  async logout() {
    if (this.did) {
      await this.atpClient.logout(this.did);
    }
    this.did = void 0;
    await this._persist();
  }
  async checkAuth() {
    if (this.isLoggedIn) return true;
    if (this.did) {
      try {
        await this.atpClient.restoreSession(this.did);
        return true;
      } catch (e) {
        console.error("Failed to restore session:", e);
        this.did = void 0;
        await this._persist();
        new import_obsidian3.Notice("Session expired. Please log in via settings.");
        return false;
      }
    }
    new import_obsidian3.Notice("Please log in via plugin settings.");
    return false;
  }
  async _persist() {
    const saved = await this.plugin.loadData() ?? {};
    saved[STORAGE_KEY] = this.did;
    await this.plugin.saveData(saved);
  }
};

// src/auth/settings.ts
var import_obsidian4 = require("obsidian");
var AuthSettingsSection = class {
  constructor(app, containerEl, auth, onStateChange) {
    this.app = app;
    this.containerEl = containerEl;
    this.auth = auth;
    this.onStateChange = onStateChange;
  }
  display() {
    new import_obsidian4.Setting(this.containerEl).setName("AT Protocol Account").setHeading();
    if (this.auth.isLoggedIn) {
      const displayName = this.auth.handle || this.auth.did;
      new import_obsidian4.Setting(this.containerEl).setName(`Logged in as @${displayName}`).setDesc(this.auth.did || "").addButton(
        (button) => button.setButtonText("Log out").setCta().onClick(async () => {
          await this.auth.logout();
          this.onStateChange?.();
          new import_obsidian4.Notice("Logged out successfully");
        })
      );
    } else {
      let handleInput;
      new import_obsidian4.Setting(this.containerEl).setName("Log in").setDesc("Enter your handle (e.g., user.bsky.social)").addText((text) => {
        handleInput = text.inputEl;
        text.setValue("");
      }).addButton(
        (button) => button.setButtonText("Log in").setCta().onClick(async () => {
          const handle = handleInput.value.trim();
          if (!handle) {
            new import_obsidian4.Notice("Please enter a handle.");
            return;
          }
          if (!isActorIdentifier(handle)) {
            new import_obsidian4.Notice("Invalid handle format. Use something like user.bsky.social");
            return;
          }
          const safetyTimer = setTimeout(() => {
            button.setDisabled(false);
            button.setButtonText("Log in");
            new import_obsidian4.Notice("Login attempt timed out. Please try again.");
          }, 6e4);
          button.setDisabled(true);
          button.setButtonText("Logging in...");
          new import_obsidian4.Notice("Opening browser for authorization...");
          try {
            await this.auth.login(handle);
            this.onStateChange?.();
            new import_obsidian4.Notice(`Successfully logged in as ${this.auth.handle}`);
          } catch (error) {
            console.error("Login failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            new import_obsidian4.Notice(`Authentication failed: ${errorMessage}`);
          } finally {
            clearTimeout(safetyTimer);
            button.setDisabled(false);
            button.setButtonText("Log in");
          }
        })
      );
    }
  }
};

// src/settings.ts
var import_obsidian5 = require("obsidian");
var DEFAULT_SETTINGS = {
  defaultClipType: "article"
};
var SettingTab = class extends import_obsidian5.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const authSection = new AuthSettingsSection(
      this.app,
      containerEl,
      this.plugin.auth,
      () => this.display()
    );
    authSection.display();
    new import_obsidian5.Setting(containerEl).setName("Semblage").setHeading();
    new import_obsidian5.Setting(containerEl).setName("Default clip type").setDesc("Default semantic type for new URL cards").addDropdown((dropdown) => {
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
};

// src/views/card-gallery-view.ts
var import_obsidian7 = require("obsidian");
init_types();
init_cosmik_api();

// src/modals/connection-modal.ts
var import_obsidian6 = require("obsidian");
init_cosmik_api();
var PRESET_TYPES = ["RELATED", "SUPPORTS", "SUPPLEMENT", "cites", "inspired-by", "contradicts", "extends", "references"];
var ConnectionModal = class extends import_obsidian6.Modal {
  client;
  did;
  cards;
  preferredSource;
  preferredTarget;
  onSaved;
  constructor(app, client, did, cards, preferredSource, preferredTarget, onSaved) {
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
    contentEl.createEl("label", { text: "Source card" });
    const sourceSelect = contentEl.createEl("select");
    sourceSelect.style.width = "100%";
    for (const c2 of this.cards) {
      sourceSelect.createEl("option", {
        text: `[${c2.semanticType}] ${c2.title.slice(0, 60)}`,
        value: c2.uri
      });
    }
    if (this.preferredSource) {
      sourceSelect.value = this.preferredSource;
    }
    contentEl.createEl("label", { text: "Target card", attr: { style: "display:block;margin-top:10px;" } });
    const targetSelect = contentEl.createEl("select");
    targetSelect.style.width = "100%";
    for (const c2 of this.cards) {
      targetSelect.createEl("option", {
        text: `[${c2.semanticType}] ${c2.title.slice(0, 60)}`,
        value: c2.uri
      });
    }
    if (this.preferredTarget) {
      targetSelect.value = this.preferredTarget;
    }
    contentEl.createEl("label", { text: "Connection type", attr: { style: "display:block;margin-top:10px;" } });
    const typeInput = contentEl.createEl("input", { type: "text", value: "RELATED" });
    typeInput.setAttribute("list", "connection-types");
    const datalist = contentEl.createEl("datalist", { attr: { id: "connection-types" } });
    for (const t of PRESET_TYPES) {
      datalist.createEl("option", { value: t });
    }
    typeInput.style.width = "100%";
    contentEl.createEl("label", { text: "Note (optional)", attr: { style: "display:block;margin-top:10px;" } });
    const noteInput = contentEl.createEl("input", { type: "text" });
    noteInput.style.width = "100%";
    const saveBtn = contentEl.createEl("button", {
      text: "Create Connection",
      attr: { style: "margin-top:15px;display:block;" }
    });
    saveBtn.addEventListener("click", async () => {
      const sourceUri = sourceSelect.value;
      const targetUri = targetSelect.value;
      if (sourceUri === targetUri) {
        new import_obsidian6.Notice("Source and target must be different cards");
        return;
      }
      try {
        await createConnection(this.client, this.did, {
          $type: "network.cosmik.connection",
          source: sourceUri,
          target: targetUri,
          connectionType: typeInput.value.trim() || "RELATED",
          note: noteInput.value.trim() || void 0
        });
        new import_obsidian6.Notice("Connection created");
        this.onSaved?.();
        this.close();
      } catch (e) {
        new import_obsidian6.Notice("Failed to create connection: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/views/card-gallery-view.ts
var VIEW_TYPE_SEMBLAGE_GALLERY = "semblage-gallery";
var GROUP_ORDER = ["article", "research", "software", "video", "book", "social", "link", "note", "other"];
var CardGalleryView = class extends import_obsidian7.ItemView {
  client;
  did;
  cards = [];
  connectionIndex = /* @__PURE__ */ new Map();
  refreshEl;
  constructor(leaf, client, did) {
    super(leaf);
    this.client = client;
    this.did = did;
  }
  getViewType() {
    return VIEW_TYPE_SEMBLAGE_GALLERY;
  }
  getDisplayText() {
    return "Semblage Gallery";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("semblage-gallery");
    const header = this.contentEl.createDiv({ cls: "semblage-gallery-header" });
    header.createEl("h3", { text: "Semblage Cards" });
    this.refreshEl = header.createEl("span", {
      text: "Refreshing...",
      cls: "semblage-gallery-status"
    });
    const refreshBtn = header.createEl("button", { text: "Refresh", cls: "semblage-gallery-refresh-btn" });
    refreshBtn.addEventListener("click", () => this.loadData());
    await this.loadData();
  }
  setAuth(did) {
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
      new import_obsidian7.Notice("Failed to load gallery: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  render() {
    this.contentEl.querySelectorAll(".semblage-group").forEach((el) => el.remove());
    this.contentEl.querySelectorAll(".semblage-orphan-notes").forEach((el) => el.remove());
    const urlCards = this.cards.filter((c2) => c2.record.type === "URL");
    const noteCards = this.cards.filter((c2) => c2.record.type === "NOTE");
    const notesByParent = /* @__PURE__ */ new Map();
    const orphanNotes = [];
    for (const note of noteCards) {
      let parentUri;
      if (note.record.parentCard?.uri) {
        parentUri = note.record.parentCard.uri;
      } else if (note.url) {
        const parent = urlCards.find((c2) => c2.url === note.url);
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
    const grouped = /* @__PURE__ */ new Map();
    for (const card of urlCards) {
      const list = grouped.get(card.semanticType) || [];
      list.push(card);
      grouped.set(card.semanticType, list);
    }
    for (const type2 of GROUP_ORDER) {
      const groupCards = grouped.get(type2);
      if (!groupCards || groupCards.length === 0) continue;
      this.renderGroup(type2, groupCards, notesByParent);
    }
    if (orphanNotes.length > 0) {
      this.renderOrphanNotes(orphanNotes);
    }
  }
  renderGroup(type2, cards, notesByParent) {
    const groupEl = this.contentEl.createDiv({ cls: "semblage-group collapsed" });
    const heading = groupEl.createEl("h4", { cls: "semblage-group-title", text: `${type2} (${cards.length})` });
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
  renderNotes(container, parentUri, notes) {
    const notesEl = container.createDiv({ cls: "semblage-card-notes" });
    const toggle = notesEl.createEl("button", {
      text: `${notes.length} note${notes.length > 1 ? "s" : ""}`,
      cls: "semblage-card-notes-toggle"
    });
    const listEl = notesEl.createDiv({ cls: "semblage-card-notes-list hidden" });
    toggle.addEventListener("click", () => {
      listEl.toggleClass("hidden", !listEl.hasClass("hidden"));
      toggle.textContent = listEl.hasClass("hidden") ? `${notes.length} note${notes.length > 1 ? "s" : ""}` : "Hide notes";
    });
    for (const note of notes) {
      const noteEl = listEl.createDiv({ cls: "semblage-note" });
      const text = note.record.content?.text || "";
      noteEl.createEl("div", { text, cls: "semblage-note-text" });
      if (note.record.createdAt) {
        const date = new Date(note.record.createdAt).toLocaleDateString();
        noteEl.createEl("span", { text: date, cls: "semblage-note-date" });
      }
    }
  }
  renderOrphanNotes(notes) {
    const section = this.contentEl.createDiv({ cls: "semblage-orphan-notes" });
    section.createEl("h4", {
      text: `\u26A0 Unattached Notes (${notes.length})`,
      cls: "semblage-orphan-title"
    });
    const desc = section.createEl("div", {
      text: "These notes have no parent card. Attach them to a URL card.",
      cls: "semblage-orphan-desc"
    });
    for (const note of notes) {
      const noteEl = section.createDiv({ cls: "semblage-note orphaned" });
      const text = note.record.content?.text || "";
      noteEl.createEl("div", { text, cls: "semblage-note-text" });
    }
  }
  renderCard(container, card) {
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
    const byUri = this.connectionIndex.get(card.uri);
    const byUrl = card.url ? this.connectionIndex.get(card.url) : void 0;
    const outgoing = /* @__PURE__ */ new Map();
    const incoming = /* @__PURE__ */ new Map();
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
    const actionsEl = cardEl.createDiv({ cls: "semblage-card-actions" });
    const connectBtn = actionsEl.createEl("button", { text: "+ connect", cls: "semblage-card-action-btn" });
    connectBtn.addEventListener("click", () => {
      new ConnectionModal(this.app, this.client, this.did, this.cards, card.uri, void 0, () => this.loadData()).open();
    });
    if (card.url) {
      titleEl.addEventListener("click", () => {
        window.open(card.url, "_blank");
      });
      titleEl.addClass("clickable");
    }
  }
  renderConnectionChip(container, edge, direction, currentUri) {
    const chip = container.createDiv({ cls: "semblage-connection-chip" });
    const type2 = edge.record.connectionType || "related";
    if (direction === "out") {
      const target = resolveCardReference(edge.record.target, this.cards);
      const label = target ? target.title.slice(0, 40) : edge.record.target.slice(-20);
      chip.createEl("span", {
        cls: "semblage-connection-predicate",
        text: `${type2.toLowerCase()}`
      });
      chip.createEl("span", { text: " \u2192 " });
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
      chip.createEl("span", { text: " \u2192 " });
      chip.createEl("span", {
        cls: "semblage-connection-predicate",
        text: `${type2.toLowerCase()}`
      });
    }
    if (edge.record.note) {
      chip.createEl("span", { cls: "semblage-connection-note", text: ` "${edge.record.note}"` });
    }
  }
  scrollToCard(uri) {
    const el = this.contentEl.querySelector(`[data-uri="${CSS.escape(uri)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  async onClose() {
    this.contentEl.empty();
  }
};

// src/views/category-graph-view.ts
var import_obsidian8 = require("obsidian");
init_cosmik_api();

// src/engine/morphism-heuristics.ts
var TokenCache = class {
  #store = /* @__PURE__ */ new Map();
  tokenize(text) {
    const cached = this.#store.get(text);
    if (cached) return cached;
    const tokens = new Set(
      text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t) => t.length > 2)
    );
    this.#store.set(text, tokens);
    return tokens;
  }
};
function parseDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function parseDate(iso) {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  return isNaN(ts) ? 0 : ts;
}
function jaccard(a2, b) {
  const intersection = new Set([...a2].filter((x3) => b.has(x3)));
  const union2 = /* @__PURE__ */ new Set([...a2, ...b]);
  return union2.size === 0 ? 0 : intersection.size / union2.size;
}
function adamicAdar(commonNeighbors, degrees2) {
  let score = 0;
  for (const n of commonNeighbors) {
    const d = degrees2.get(n) || 1;
    if (d > 1) score += 1 / Math.log(d);
  }
  return score;
}
function discoverMorphismCandidates(cards, connections, threshold = 0.35, maxSuggestionsPerCard = 3) {
  const urlCards = cards.filter((c2) => c2.record.type === "URL");
  const tokenCache = new TokenCache();
  const candidates = [];
  const outgoing = /* @__PURE__ */ new Map();
  const incoming = /* @__PURE__ */ new Map();
  const degrees2 = /* @__PURE__ */ new Map();
  const existingPairs = /* @__PURE__ */ new Set();
  for (const card of urlCards) {
    outgoing.set(card.uri, /* @__PURE__ */ new Set());
    incoming.set(card.uri, /* @__PURE__ */ new Set());
    degrees2.set(card.uri, 0);
  }
  for (const edge of connections) {
    const s = edge.record.source;
    const t = edge.record.target;
    outgoing.get(s)?.add(t);
    incoming.get(t)?.add(s);
    existingPairs.add(`${s}|${t}`);
    degrees2.set(s, (degrees2.get(s) || 0) + 1);
    degrees2.set(t, (degrees2.get(t) || 0) + 1);
  }
  const allUris = urlCards.map((c2) => c2.uri);
  const typeFreq = /* @__PURE__ */ new Map();
  for (const edge of connections) {
    const type2 = edge.record.connectionType || "related";
    typeFreq.set(type2, (typeFreq.get(type2) || 0) + 1);
  }
  const dominantType = Array.from(typeFreq.entries()).sort((a2, b) => b[1] - a2[1])[0]?.[0] || "related";
  for (let i = 0; i < urlCards.length; i++) {
    const cardA = urlCards[i];
    const degA = degrees2.get(cardA.uri) || 0;
    const tokensA = tokenCache.tokenize(
      cardA.title + " " + cardA.record.content?.metadata?.description || ""
    );
    const domainA = cardA.url ? parseDomain(cardA.url) : "";
    const createdA = parseDate(cardA.record.createdAt);
    const scores = [];
    for (let j = 0; j < urlCards.length; j++) {
      if (i === j) continue;
      const cardB = urlCards[j];
      const pairKey = `${cardA.uri}|${cardB.uri}`;
      if (existingPairs.has(pairKey)) continue;
      const heuristics = {};
      let coref = 0;
      const metaA = cardA.record.content?.metadata;
      const metaB = cardB.record.content?.metadata;
      if (metaA?.doi && metaA.doi === metaB?.doi) coref = 1;
      if (metaA?.isbn && metaA.isbn === metaB?.isbn) coref = 1;
      if (cardA.url && cardA.url === cardB.url) coref = 1;
      heuristics.coref = coref;
      const domainB = cardB.url ? parseDomain(cardB.url) : "";
      heuristics.domain = domainA && domainA === domainB ? 0.8 : 0;
      const tokensB = tokenCache.tokenize(
        cardB.title + " " + (metaB?.description || "")
      );
      heuristics.lexical = jaccard(tokensA, tokensB);
      const createdB = parseDate(cardB.record.createdAt);
      const deltaMin = Math.abs(createdA - createdB) / 6e4;
      heuristics.temporal = deltaMin < 5 ? 1 - deltaMin / 5 : 0;
      const typePair = `${cardA.semanticType}|${cardB.semanticType}`;
      const typeEdgeFreq = /* @__PURE__ */ new Map();
      for (const edge of connections) {
        const src = urlCards.find((c2) => c2.uri === edge.record.source);
        const tgt = urlCards.find((c2) => c2.uri === edge.record.target);
        if (src && tgt) {
          const key = `${src.semanticType}|${tgt.semanticType}`;
          typeEdgeFreq.set(key, (typeEdgeFreq.get(key) || 0) + 1);
        }
      }
      const maxTypeFreq = Math.max(...typeEdgeFreq.values(), 1);
      heuristics.typeAdj = (typeEdgeFreq.get(typePair) || 0) / maxTypeFreq;
      const outA = outgoing.get(cardA.uri) || /* @__PURE__ */ new Set();
      const outB = outgoing.get(cardB.uri) || /* @__PURE__ */ new Set();
      const inA = incoming.get(cardA.uri) || /* @__PURE__ */ new Set();
      const inB = incoming.get(cardB.uri) || /* @__PURE__ */ new Set();
      const commonOut = new Set([...outA].filter((x3) => outB.has(x3)));
      const commonIn = new Set([...inA].filter((x3) => inB.has(x3)));
      const commonAll = /* @__PURE__ */ new Set([...commonOut, ...commonIn]);
      const jaccardOut = jaccard(outA, outB);
      const jaccardIn = jaccard(inA, inB);
      const aa = adamicAdar(commonAll, degrees2);
      const maxAA = Math.log(cards.length + 1);
      heuristics.graphProx = (jaccardOut + jaccardIn) / 2 + (maxAA > 0 ? aa / maxAA : 0) * 0.5;
      const degB = degrees2.get(cardB.uri) || 0;
      const maxDeg = Math.max(...degrees2.values(), 1);
      heuristics.hub = degA === 0 && degB > 0 ? degB / maxDeg : 0;
      const MAX_WEIGHT = 1 + 0.7 + 0.5 + 0.3 + 0.4 + 0.6 + 0.2;
      const rawScore = heuristics.coref * 1 + heuristics.domain * 0.7 + heuristics.lexical * 0.5 + heuristics.temporal * 0.3 + heuristics.typeAdj * 0.4 + heuristics.graphProx * 0.6 + heuristics.hub * 0.2;
      const score = rawScore / MAX_WEIGHT;
      if (score >= threshold) {
        const inferredType = Array.from(typeEdgeFreq.entries()).filter(([k]) => k === typePair).sort((a2, b) => b[1] - a2[1])[0]?.[0] || dominantType;
        scores.push({
          target: cardB.uri,
          score,
          heuristics,
          type: inferredType
        });
      }
    }
    scores.sort((a2, b) => b.score - a2.score);
    for (const s of scores.slice(0, maxSuggestionsPerCard)) {
      candidates.push({
        source: cardA.uri,
        target: s.target,
        score: s.score,
        heuristics: s.heuristics,
        proposedType: s.type
      });
    }
  }
  return candidates;
}

// node_modules/d3-dispatch/src/dispatch.js
var noop2 = { value: () => {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set2(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set2(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type2, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type2, that, args) {
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (var t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type2, name) {
  for (var i = 0, n = type2.length, c2; i < n; ++i) {
    if ((c2 = type2[i]).name === name) {
      return c2.value;
    }
  }
}
function set2(type2, name, callback) {
  for (var i = 0, n = type2.length; i < n; ++i) {
    if (type2[i].name === name) {
      type2[i] = noop2, type2 = type2.slice(0, i).concat(type2.slice(i + 1));
      break;
    }
  }
  if (callback != null) type2.push({ name, value: callback });
  return type2;
}
var dispatch_default = dispatch;

// node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

// node_modules/d3-selection/src/namespace.js
function namespace_default(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name } : name;
}

// node_modules/d3-selection/src/creator.js
function creatorInherit(name) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator_default(name) {
  var fullname = namespace_default(name);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

// node_modules/d3-selection/src/selector.js
function none() {
}
function selector_default(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

// node_modules/d3-selection/src/selection/select.js
function select_default(select) {
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m2 = groups.length, subgroups = new Array(m2), j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/array.js
function array2(x3) {
  return x3 == null ? [] : Array.isArray(x3) ? x3 : Array.from(x3);
}

// node_modules/d3-selection/src/selectorAll.js
function empty() {
  return [];
}
function selectorAll_default(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

// node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
  return function() {
    return array2(select.apply(this, arguments));
  };
}
function selectAll_default(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll_default(select);
  for (var groups = this._groups, m2 = groups.length, subgroups = [], parents = [], j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}

// node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
  return function() {
    return this.matches(selector);
  };
}
function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

// node_modules/d3-selection/src/selection/selectChild.js
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selectChild_default(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/selectChildren.js
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selectChildren_default(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/filter.js
function filter_default(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m2 = groups.length, subgroups = new Array(m2), j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
  return new Array(update.length);
}

// node_modules/d3-selection/src/selection/enter.js
function enter_default() {
  return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector) {
    return this._parent.querySelector(selector);
  },
  querySelectorAll: function(selector) {
    return this._parent.querySelectorAll(selector);
  }
};

// node_modules/d3-selection/src/constant.js
function constant_default(x3) {
  return function() {
    return x3;
  };
}

// node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0, node, groupLength = group.length, dataLength = data.length;
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}
function bindKey(parent, group, enter, update, exit, data, key) {
  var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
      exit[i] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function data_default(value, key) {
  if (!arguments.length) return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
  if (typeof value !== "function") value = constant_default(value);
  for (var m2 = groups.length, update = new Array(m2), enter = new Array(m2), exit = new Array(m2), j = 0; j < m2; ++j) {
    var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}

// node_modules/d3-selection/src/selection/exit.js
function exit_default() {
  return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
}

// node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove();
  else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

// node_modules/d3-selection/src/selection/merge.js
function merge_default(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m2 = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m2; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Selection(merges, this._parents);
}

// node_modules/d3-selection/src/selection/order.js
function order_default() {
  for (var groups = this._groups, j = -1, m2 = groups.length; ++j < m2; ) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0; ) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/sort.js
function sort_default(compare) {
  if (!compare) compare = ascending;
  function compareNode(a2, b) {
    return a2 && b ? compare(a2.__data__, b.__data__) : !a2 - !b;
  }
  for (var groups = this._groups, m2 = groups.length, sortgroups = new Array(m2), j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending(a2, b) {
  return a2 < b ? -1 : a2 > b ? 1 : a2 >= b ? 0 : NaN;
}

// node_modules/d3-selection/src/selection/call.js
function call_default() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

// node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
  return Array.from(this);
}

// node_modules/d3-selection/src/selection/node.js
function node_default() {
  for (var groups = this._groups, j = 0, m2 = groups.length; j < m2; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }
  return null;
}

// node_modules/d3-selection/src/selection/size.js
function size_default() {
  let size = 0;
  for (const node of this) ++size;
  return size;
}

// node_modules/d3-selection/src/selection/empty.js
function empty_default() {
  return !this.node();
}

// node_modules/d3-selection/src/selection/each.js
function each_default(callback) {
  for (var groups = this._groups, j = 0, m2 = groups.length; j < m2; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/attr.js
function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}
function attr_default(name, value) {
  var fullname = namespace_default(name);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}

// node_modules/d3-selection/src/window.js
function window_default(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

// node_modules/d3-selection/src/selection/style.js
function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}
function styleFunction(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}
function style_default(name, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
  return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
}

// node_modules/d3-selection/src/selection/property.js
function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}
function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}
function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}
function property_default(name, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}

// node_modules/d3-selection/src/selection/classed.js
function classArray(string2) {
  return string2.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};
function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}
function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}
function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}
function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}
function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}
function classed_default(name, value) {
  var names = classArray(name + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}

// node_modules/d3-selection/src/selection/text.js
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}
function text_default(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}

// node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}
function html_default(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

// node_modules/d3-selection/src/selection/raise.js
function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
  return this.each(raise);
}

// node_modules/d3-selection/src/selection/lower.js
function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
  return this.each(lower);
}

// node_modules/d3-selection/src/selection/append.js
function append_default(name) {
  var create2 = typeof name === "function" ? name : creator_default(name);
  return this.select(function() {
    return this.appendChild(create2.apply(this, arguments));
  });
}

// node_modules/d3-selection/src/selection/insert.js
function constantNull() {
  return null;
}
function insert_default(name, before) {
  var create2 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
  return this.select(function() {
    return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

// node_modules/d3-selection/src/selection/remove.js
function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}
function remove_default() {
  return this.each(remove);
}

// node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

// node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

// node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames2(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return { type: t, name };
  });
}
function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m2 = on.length, o; j < m2; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m2 = on.length; j < m2; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = { type: typename.type, name: typename.name, value, listener, options };
    if (!on) this.__on = [o];
    else on.push(o);
  };
}
function on_default(typename, value, options) {
  var typenames = parseTypenames2(typename + ""), i, n = typenames.length, t;
  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m2 = on.length, o; j < m2; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }
  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}

// node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type2, params) {
  var window2 = window_default(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type2, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params) event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type2, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params);
  };
}
function dispatchFunction(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params.apply(this, arguments));
  };
}
function dispatch_default2(type2, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
}

// node_modules/d3-selection/src/selection/iterator.js
function* iterator_default() {
  for (var groups = this._groups, j = 0, m2 = groups.length; j < m2; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) yield node;
    }
  }
}

// node_modules/d3-selection/src/selection/index.js
var root = [null];
function Selection(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: select_default,
  selectAll: selectAll_default,
  selectChild: selectChild_default,
  selectChildren: selectChildren_default,
  filter: filter_default,
  data: data_default,
  enter: enter_default,
  exit: exit_default,
  join: join_default,
  merge: merge_default,
  selection: selection_selection,
  order: order_default,
  sort: sort_default,
  call: call_default,
  nodes: nodes_default,
  node: node_default,
  size: size_default,
  empty: empty_default,
  each: each_default,
  attr: attr_default,
  style: style_default,
  property: property_default,
  classed: classed_default,
  text: text_default,
  html: html_default,
  raise: raise_default,
  lower: lower_default,
  append: append_default,
  insert: insert_default,
  remove: remove_default,
  clone: clone_default,
  datum: datum_default,
  on: on_default,
  dispatch: dispatch_default2,
  [Symbol.iterator]: iterator_default
};
var selection_default = selection;

// node_modules/d3-selection/src/select.js
function select_default2(selector) {
  return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
}

// node_modules/d3-selection/src/sourceEvent.js
function sourceEvent_default(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent) event = sourceEvent;
  return event;
}

// node_modules/d3-selection/src/pointer.js
function pointer_default(event, node) {
  event = sourceEvent_default(event);
  if (node === void 0) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// node_modules/d3-drag/src/noevent.js
var nonpassive = { passive: false };
var nonpassivecapture = { capture: true, passive: false };
function nopropagation(event) {
  event.stopImmediatePropagation();
}
function noevent_default(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// node_modules/d3-drag/src/nodrag.js
function nodrag_default(view) {
  var root2 = view.document.documentElement, selection2 = select_default2(view).on("dragstart.drag", noevent_default, nonpassivecapture);
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", noevent_default, nonpassivecapture);
  } else {
    root2.__noselect = root2.style.MozUserSelect;
    root2.style.MozUserSelect = "none";
  }
}
function yesdrag(view, noclick) {
  var root2 = view.document.documentElement, selection2 = select_default2(view).on("dragstart.drag", null);
  if (noclick) {
    selection2.on("click.drag", noevent_default, nonpassivecapture);
    setTimeout(function() {
      selection2.on("click.drag", null);
    }, 0);
  }
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", null);
  } else {
    root2.style.MozUserSelect = root2.__noselect;
    delete root2.__noselect;
  }
}

// node_modules/d3-drag/src/constant.js
var constant_default2 = (x3) => () => x3;

// node_modules/d3-drag/src/event.js
function DragEvent(type2, {
  sourceEvent,
  subject,
  target,
  identifier,
  active,
  x: x3,
  y: y3,
  dx,
  dy,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type2, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent, enumerable: true, configurable: true },
    subject: { value: subject, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    identifier: { value: identifier, enumerable: true, configurable: true },
    active: { value: active, enumerable: true, configurable: true },
    x: { value: x3, enumerable: true, configurable: true },
    y: { value: y3, enumerable: true, configurable: true },
    dx: { value: dx, enumerable: true, configurable: true },
    dy: { value: dy, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}
DragEvent.prototype.on = function() {
  var value = this._.on.apply(this._, arguments);
  return value === this._ ? this : value;
};

// node_modules/d3-drag/src/drag.js
function defaultFilter(event) {
  return !event.ctrlKey && !event.button;
}
function defaultContainer() {
  return this.parentNode;
}
function defaultSubject(event, d) {
  return d == null ? { x: event.x, y: event.y } : d;
}
function defaultTouchable() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function drag_default() {
  var filter2 = defaultFilter, container = defaultContainer, subject = defaultSubject, touchable = defaultTouchable, gestures = {}, listeners = dispatch_default("start", "drag", "end"), active = 0, mousedownx, mousedowny, mousemoving, touchending, clickDistance2 = 0;
  function drag(selection2) {
    selection2.on("mousedown.drag", mousedowned).filter(touchable).on("touchstart.drag", touchstarted).on("touchmove.drag", touchmoved, nonpassive).on("touchend.drag touchcancel.drag", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function mousedowned(event, d) {
    if (touchending || !filter2.call(this, event, d)) return;
    var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
    if (!gesture) return;
    select_default2(event.view).on("mousemove.drag", mousemoved, nonpassivecapture).on("mouseup.drag", mouseupped, nonpassivecapture);
    nodrag_default(event.view);
    nopropagation(event);
    mousemoving = false;
    mousedownx = event.clientX;
    mousedowny = event.clientY;
    gesture("start", event);
  }
  function mousemoved(event) {
    noevent_default(event);
    if (!mousemoving) {
      var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
      mousemoving = dx * dx + dy * dy > clickDistance2;
    }
    gestures.mouse("drag", event);
  }
  function mouseupped(event) {
    select_default2(event.view).on("mousemove.drag mouseup.drag", null);
    yesdrag(event.view, mousemoving);
    noevent_default(event);
    gestures.mouse("end", event);
  }
  function touchstarted(event, d) {
    if (!filter2.call(this, event, d)) return;
    var touches = event.changedTouches, c2 = container.call(this, event, d), n = touches.length, i, gesture;
    for (i = 0; i < n; ++i) {
      if (gesture = beforestart(this, c2, event, d, touches[i].identifier, touches[i])) {
        nopropagation(event);
        gesture("start", event, touches[i]);
      }
    }
  }
  function touchmoved(event) {
    var touches = event.changedTouches, n = touches.length, i, gesture;
    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        noevent_default(event);
        gesture("drag", event, touches[i]);
      }
    }
  }
  function touchended(event) {
    var touches = event.changedTouches, n = touches.length, i, gesture;
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() {
      touchending = null;
    }, 500);
    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        nopropagation(event);
        gesture("end", event, touches[i]);
      }
    }
  }
  function beforestart(that, container2, event, d, identifier, touch) {
    var dispatch2 = listeners.copy(), p = pointer_default(touch || event, container2), dx, dy, s;
    if ((s = subject.call(that, new DragEvent("beforestart", {
      sourceEvent: event,
      target: drag,
      identifier,
      active,
      x: p[0],
      y: p[1],
      dx: 0,
      dy: 0,
      dispatch: dispatch2
    }), d)) == null) return;
    dx = s.x - p[0] || 0;
    dy = s.y - p[1] || 0;
    return function gesture(type2, event2, touch2) {
      var p0 = p, n;
      switch (type2) {
        case "start":
          gestures[identifier] = gesture, n = active++;
          break;
        case "end":
          delete gestures[identifier], --active;
        // falls through
        case "drag":
          p = pointer_default(touch2 || event2, container2), n = active;
          break;
      }
      dispatch2.call(
        type2,
        that,
        new DragEvent(type2, {
          sourceEvent: event2,
          subject: s,
          target: drag,
          identifier,
          active: n,
          x: p[0] + dx,
          y: p[1] + dy,
          dx: p[0] - p0[0],
          dy: p[1] - p0[1],
          dispatch: dispatch2
        }),
        d
      );
    };
  }
  drag.filter = function(_) {
    return arguments.length ? (filter2 = typeof _ === "function" ? _ : constant_default2(!!_), drag) : filter2;
  };
  drag.container = function(_) {
    return arguments.length ? (container = typeof _ === "function" ? _ : constant_default2(_), drag) : container;
  };
  drag.subject = function(_) {
    return arguments.length ? (subject = typeof _ === "function" ? _ : constant_default2(_), drag) : subject;
  };
  drag.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default2(!!_), drag) : touchable;
  };
  drag.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? drag : value;
  };
  drag.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
  };
  return drag;
}

// node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

// node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format) {
  var m2, l;
  format = (format + "").trim().toLowerCase();
  return (m2 = reHex.exec(format)) ? (l = m2[1].length, m2 = parseInt(m2[1], 16), l === 6 ? rgbn(m2) : l === 3 ? new Rgb(m2 >> 8 & 15 | m2 >> 4 & 240, m2 >> 4 & 15 | m2 & 240, (m2 & 15) << 4 | m2 & 15, 1) : l === 8 ? rgba(m2 >> 24 & 255, m2 >> 16 & 255, m2 >> 8 & 255, (m2 & 255) / 255) : l === 4 ? rgba(m2 >> 12 & 15 | m2 >> 8 & 240, m2 >> 8 & 15 | m2 >> 4 & 240, m2 >> 4 & 15 | m2 & 240, ((m2 & 15) << 4 | m2 & 15) / 255) : null) : (m2 = reRgbInteger.exec(format)) ? new Rgb(m2[1], m2[2], m2[3], 1) : (m2 = reRgbPercent.exec(format)) ? new Rgb(m2[1] * 255 / 100, m2[2] * 255 / 100, m2[3] * 255 / 100, 1) : (m2 = reRgbaInteger.exec(format)) ? rgba(m2[1], m2[2], m2[3], m2[4]) : (m2 = reRgbaPercent.exec(format)) ? rgba(m2[1] * 255 / 100, m2[2] * 255 / 100, m2[3] * 255 / 100, m2[4]) : (m2 = reHslPercent.exec(format)) ? hsla(m2[1], m2[2] / 100, m2[3] / 100, 1) : (m2 = reHslaPercent.exec(format)) ? hsla(m2[1], m2[2] / 100, m2[3] / 100, m2[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
  return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a2) {
  if (a2 <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a2);
}
function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a2 = clampa(this.opacity);
  return `${a2 === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a2 === 1 ? ")" : `, ${a2})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a2) {
  if (a2 <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a2);
}
function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, min2 = Math.min(r, g, b), max2 = Math.max(r, g, b), h = NaN, s = max2 - min2, l = (max2 + min2) / 2;
  if (s) {
    if (r === max2) h = (g - b) / s + (g < b) * 6;
    else if (g === max2) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max2 + min2 : 2 - max2 - min2;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a2 = clampa(this.opacity);
    return `${a2 === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a2 === 1 ? ")" : `, ${a2})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

// node_modules/d3-interpolate/src/basis.js
function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1, t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}
function basis_default(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values) {
  var n = values.length;
  return function(t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/constant.js
var constant_default3 = (x3) => () => x3;

// node_modules/d3-interpolate/src/color.js
function linear(a2, d) {
  return function(t) {
    return a2 + t * d;
  };
}
function exponential(a2, b, y3) {
  return a2 = Math.pow(a2, y3), b = Math.pow(b, y3) - a2, y3 = 1 / y3, function(t) {
    return Math.pow(a2 + t * b, y3);
  };
}
function gamma(y3) {
  return (y3 = +y3) === 1 ? nogamma : function(a2, b) {
    return b - a2 ? exponential(a2, b, y3) : constant_default3(isNaN(a2) ? b : a2);
  };
}
function nogamma(a2, b) {
  var d = b - a2;
  return d ? linear(a2, d) : constant_default3(isNaN(a2) ? b : a2);
}

// node_modules/d3-interpolate/src/rgb.js
var rgb_default = function rgbGamma(y3) {
  var color2 = gamma(y3);
  function rgb2(start2, end) {
    var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.r = r(t);
      start2.g = g(t);
      start2.b = b(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
}(1);
function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
    for (i = 0; i < n; ++i) {
      color2 = rgb(colors[i]);
      r[i] = color2.r || 0;
      g[i] = color2.g || 0;
      b[i] = color2.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color2.opacity = 1;
    return function(t) {
      color2.r = r(t);
      color2.g = g(t);
      color2.b = b(t);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// node_modules/d3-interpolate/src/number.js
function number_default(a2, b) {
  return a2 = +a2, b = +b, function(t) {
    return a2 * (1 - t) + b * t;
  };
}

// node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero(b) {
  return function() {
    return b;
  };
}
function one(b) {
  return function(t) {
    return b(t) + "";
  };
}
function string_default(a2, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
  a2 = a2 + "", b = b + "";
  while ((am = reA.exec(a2)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s[i]) s[i] += bm;
      else s[++i] = bm;
    } else {
      s[++i] = null;
      q.push({ i, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs;
    else s[++i] = bs;
  }
  return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
    for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
    return s.join("");
  });
}

// node_modules/d3-interpolate/src/transform/decompose.js
var degrees = 180 / Math.PI;
var identity = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose_default(a2, b, c2, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a2 * a2 + b * b)) a2 /= scaleX, b /= scaleX;
  if (skewX = a2 * c2 + b * d) c2 -= a2 * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c2 * c2 + d * d)) c2 /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a2 * d < b * c2) a2 = -a2, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a2) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX,
    scaleY
  };
}

// node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
  const m2 = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m2.isIdentity ? identity : decompose_default(m2.a, m2.b, m2.c, m2.d, m2.e, m2.f);
}
function parseSvg(value) {
  if (value == null) return identity;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
  value = value.matrix;
  return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

// node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse2, pxComma, pxParen, degParen) {
  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }
  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a2, b, s, q) {
    if (a2 !== b) {
      if (a2 - b > 180) b += 360;
      else if (b - a2 > 180) a2 += 360;
      q.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number_default(a2, b) });
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }
  function skewX(a2, b, s, q) {
    if (a2 !== b) {
      q.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number_default(a2, b) });
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a2, b) {
    var s = [], q = [];
    a2 = parse2(a2), b = parse2(b);
    translate(a2.translateX, a2.translateY, b.translateX, b.translateY, s, q);
    rotate(a2.rotate, b.rotate, s, q);
    skewX(a2.skewX, b.skewX, s, q);
    scale(a2.scaleX, a2.scaleY, b.scaleX, b.scaleY, s, q);
    a2 = b = null;
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

// node_modules/d3-interpolate/src/zoom.js
var epsilon2 = 1e-12;
function cosh(x3) {
  return ((x3 = Math.exp(x3)) + 1 / x3) / 2;
}
function sinh(x3) {
  return ((x3 = Math.exp(x3)) - 1 / x3) / 2;
}
function tanh(x3) {
  return ((x3 = Math.exp(2 * x3)) - 1) / (x3 + 1);
}
var zoom_default = function zoomRho(rho, rho2, rho4) {
  function zoom(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      };
    } else {
      var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S, coshr0 = cosh(r0), u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      };
    }
    i.duration = S * 1e3 * rho / Math.SQRT2;
    return i;
  }
  zoom.rho = function(_) {
    var _1 = Math.max(1e-3, +_), _2 = _1 * _1, _4 = _2 * _2;
    return zoomRho(_1, _2, _4);
  };
  return zoom;
}(Math.SQRT2, 2, 4);

// node_modules/d3-timer/src/timer.js
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
  setTimeout(f, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time) {
  var t = new Timer();
  t.restart(callback, delay, time);
  return t;
}
function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
    t = t._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}
function sleep(time) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow;
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

// node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time) {
  var t = new Timer();
  delay = delay == null ? 0 : +delay;
  t.restart((elapsed) => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

// node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name, id2, index2, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id2 in schedules) return;
  create(node, id2, {
    name,
    index: index2,
    // For context during callback.
    group,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}
function set3(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}
function get2(node, id2) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
  return schedule;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule, 0, self.time);
  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed) start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i, j, n, o;
    if (self.state !== SCHEDULED) return stop();
    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;
      if (o.state === STARTED) return timeout_default(start2);
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      } else if (+i < id2) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }
    timeout_default(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return;
    self.state = STARTED;
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }
  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
    while (++i < n) {
      tween[i].call(node, t);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i in schedules) return;
    delete node.__transition;
  }
}

// node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name) {
  var schedules = node.__transition, schedule, active, empty2 = true, i;
  if (!schedules) return;
  name = name == null ? null : name + "";
  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) {
      empty2 = false;
      continue;
    }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }
  if (empty2) delete node.__transition;
}

// node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default2(name) {
  return this.each(function() {
    interrupt_default(this, name);
  });
}

// node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id2, name) {
  var tween0, tween1;
  return function() {
    var schedule = set3(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }
    schedule.tween = tween1;
  };
}
function tweenFunction(id2, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error();
  return function() {
    var schedule = set3(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = { name, value }, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }
    schedule.tween = tween1;
  };
}
function tween_default(name, value) {
  var id2 = this._id;
  name += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name, value));
}
function tweenValue(transition2, name, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule = set3(this, id2);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name];
  };
}

// node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default(a2, b) {
  var c2;
  return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c2 = color(b)) ? (b = c2, rgb_default) : string_default)(a2, b);
}

// node_modules/d3-transition/src/transition/attr.js
function attrRemove2(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attr_default2(name, value) {
  var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
  return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value));
}

// node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i.call(this, t));
  };
}
function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}
function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween(name, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween_default(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  var fullname = namespace_default(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

// node_modules/d3-transition/src/transition/delay.js
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function delay_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}

// node_modules/d3-transition/src/transition/duration.js
function durationFunction(id2, value) {
  return function() {
    set3(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set3(this, id2).duration = value;
  };
}
function duration_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}

// node_modules/d3-transition/src/transition/ease.js
function easeConstant(id2, value) {
  if (typeof value !== "function") throw new Error();
  return function() {
    set3(this, id2).ease = value;
  };
}
function ease_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}

// node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error();
    set3(this, id2).ease = v;
  };
}
function easeVarying_default(value) {
  if (typeof value !== "function") throw new Error();
  return this.each(easeVarying(this._id, value));
}

// node_modules/d3-transition/src/transition/filter.js
function filter_default2(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m2 = groups.length, subgroups = new Array(m2), j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/merge.js
function merge_default2(transition2) {
  if (transition2._id !== this._id) throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m2 = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m2; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/on.js
function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}
function onFunction(id2, name, listener) {
  var on0, on1, sit = start(name) ? init : set3;
  return function() {
    var schedule = sit(this, id2), on = schedule.on;
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
    schedule.on = on1;
  };
}
function on_default2(name, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
}

// node_modules/d3-transition/src/transition/remove.js
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id2) return;
    if (parent) parent.removeChild(this);
  };
}
function remove_default2() {
  return this.on("end.remove", removeFunction(this._id));
}

// node_modules/d3-transition/src/transition/select.js
function select_default3(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m2 = groups.length, subgroups = new Array(m2), j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule_default(subgroup[i], name, id2, i, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name, id2);
}

// node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default2(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function") select = selectorAll_default(select);
  for (var groups = this._groups, m2 = groups.length, subgroups = [], parents = [], j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children2 = select.call(node, node.__data__, i, group), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
          if (child = children2[k]) {
            schedule_default(child, name, id2, k, children2, inherit2);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name, id2);
}

// node_modules/d3-transition/src/transition/selection.js
var Selection2 = selection_default.prototype.constructor;
function selection_default2() {
  return new Selection2(this._groups, this._parents);
}

// node_modules/d3-transition/src/transition/style.js
function styleNull(name, interpolate) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function styleFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
  return function() {
    var schedule = set3(this, id2), on = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
    schedule.on = on1;
  };
}
function style_default2(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
  return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove2(name)) : typeof value === "function" ? this.styleTween(name, styleFunction2(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i, value), priority).on("end.style." + name, null);
}

// node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i.call(this, t), priority);
  };
}
function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}
function styleTween_default(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

// node_modules/d3-transition/src/transition/text.js
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function text_default2(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}

// node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}
function textTween(value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function textTween_default(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, textTween(value));
}

// node_modules/d3-transition/src/transition/transition.js
function transition_default() {
  var name = this._name, id0 = this._id, id1 = newId();
  for (var groups = this._groups, m2 = groups.length, j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit2 = get2(node, id0);
        schedule_default(node, name, id1, i, group, {
          time: inherit2.time + inherit2.delay + inherit2.duration,
          delay: 0,
          duration: inherit2.duration,
          ease: inherit2.ease
        });
      }
    }
  }
  return new Transition(groups, this._parents, name, id1);
}

// node_modules/d3-transition/src/transition/end.js
function end_default() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0) resolve();
    } };
    that.each(function() {
      var schedule = set3(this, id2), on = schedule.on;
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule.on = on1;
    });
    if (size === 0) resolve();
  });
}

// node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups, parents, name, id2) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id2;
}
function transition(name) {
  return selection_default().transition(name);
}
function newId() {
  return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: select_default3,
  selectAll: selectAll_default2,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: filter_default2,
  merge: merge_default2,
  selection: selection_default2,
  transition: transition_default,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: on_default2,
  attr: attr_default2,
  attrTween: attrTween_default,
  style: style_default2,
  styleTween: styleTween_default,
  text: text_default2,
  textTween: textTween_default,
  remove: remove_default2,
  tween: tween_default,
  delay: delay_default,
  duration: duration_default,
  ease: ease_default,
  easeVarying: easeVarying_default,
  end: end_default,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

// node_modules/d3-ease/src/cubic.js
function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

// node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function transition_default2(name) {
  var id2, timing;
  if (name instanceof Transition) {
    id2 = name._id, name = name._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }
  for (var groups = this._groups, m2 = groups.length, j = 0; j < m2; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule_default(node, name, id2, i, group, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups, this._parents, name, id2);
}

// node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default2;
selection_default.prototype.transition = transition_default2;

// node_modules/d3-brush/src/brush.js
var { abs, max, min } = Math;
function number1(e) {
  return [+e[0], +e[1]];
}
function number2(e) {
  return [number1(e[0]), number1(e[1])];
}
var X = {
  name: "x",
  handles: ["w", "e"].map(type),
  input: function(x3, e) {
    return x3 == null ? null : [[+x3[0], e[0][1]], [+x3[1], e[1][1]]];
  },
  output: function(xy) {
    return xy && [xy[0][0], xy[1][0]];
  }
};
var Y = {
  name: "y",
  handles: ["n", "s"].map(type),
  input: function(y3, e) {
    return y3 == null ? null : [[e[0][0], +y3[0]], [e[1][0], +y3[1]]];
  },
  output: function(xy) {
    return xy && [xy[0][1], xy[1][1]];
  }
};
var XY = {
  name: "xy",
  handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
  input: function(xy) {
    return xy == null ? null : number2(xy);
  },
  output: function(xy) {
    return xy;
  }
};
function type(t) {
  return { type: t };
}

// node_modules/d3-force/src/center.js
function center_default(x3, y3) {
  var nodes, strength = 1;
  if (x3 == null) x3 = 0;
  if (y3 == null) y3 = 0;
  function force() {
    var i, n = nodes.length, node, sx = 0, sy = 0;
    for (i = 0; i < n; ++i) {
      node = nodes[i], sx += node.x, sy += node.y;
    }
    for (sx = (sx / n - x3) * strength, sy = (sy / n - y3) * strength, i = 0; i < n; ++i) {
      node = nodes[i], node.x -= sx, node.y -= sy;
    }
  }
  force.initialize = function(_) {
    nodes = _;
  };
  force.x = function(_) {
    return arguments.length ? (x3 = +_, force) : x3;
  };
  force.y = function(_) {
    return arguments.length ? (y3 = +_, force) : y3;
  };
  force.strength = function(_) {
    return arguments.length ? (strength = +_, force) : strength;
  };
  return force;
}

// node_modules/d3-quadtree/src/add.js
function add_default(d) {
  const x3 = +this._x.call(null, d), y3 = +this._y.call(null, d);
  return add(this.cover(x3, y3), x3, y3, d);
}
function add(tree, x3, y3, d) {
  if (isNaN(x3) || isNaN(y3)) return tree;
  var parent, node = tree._root, leaf = { data: d }, x0 = tree._x0, y0 = tree._y0, x1 = tree._x1, y1 = tree._y1, xm, ym, xp, yp, right, bottom, i, j;
  if (!node) return tree._root = leaf, tree;
  while (node.length) {
    if (right = x3 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y3 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
    if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
  }
  xp = +tree._x.call(null, node.data);
  yp = +tree._y.call(null, node.data);
  if (x3 === xp && y3 === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;
  do {
    parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
    if (right = x3 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y3 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
  } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | xp >= xm));
  return parent[j] = node, parent[i] = leaf, tree;
}
function addAll(data) {
  var d, i, n = data.length, x3, y3, xz = new Array(n), yz = new Array(n), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (i = 0; i < n; ++i) {
    if (isNaN(x3 = +this._x.call(null, d = data[i])) || isNaN(y3 = +this._y.call(null, d))) continue;
    xz[i] = x3;
    yz[i] = y3;
    if (x3 < x0) x0 = x3;
    if (x3 > x1) x1 = x3;
    if (y3 < y0) y0 = y3;
    if (y3 > y1) y1 = y3;
  }
  if (x0 > x1 || y0 > y1) return this;
  this.cover(x0, y0).cover(x1, y1);
  for (i = 0; i < n; ++i) {
    add(this, xz[i], yz[i], data[i]);
  }
  return this;
}

// node_modules/d3-quadtree/src/cover.js
function cover_default(x3, y3) {
  if (isNaN(x3 = +x3) || isNaN(y3 = +y3)) return this;
  var x0 = this._x0, y0 = this._y0, x1 = this._x1, y1 = this._y1;
  if (isNaN(x0)) {
    x1 = (x0 = Math.floor(x3)) + 1;
    y1 = (y0 = Math.floor(y3)) + 1;
  } else {
    var z = x1 - x0 || 1, node = this._root, parent, i;
    while (x0 > x3 || x3 >= x1 || y0 > y3 || y3 >= y1) {
      i = (y3 < y0) << 1 | x3 < x0;
      parent = new Array(4), parent[i] = node, node = parent, z *= 2;
      switch (i) {
        case 0:
          x1 = x0 + z, y1 = y0 + z;
          break;
        case 1:
          x0 = x1 - z, y1 = y0 + z;
          break;
        case 2:
          x1 = x0 + z, y0 = y1 - z;
          break;
        case 3:
          x0 = x1 - z, y0 = y1 - z;
          break;
      }
    }
    if (this._root && this._root.length) this._root = node;
  }
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  return this;
}

// node_modules/d3-quadtree/src/data.js
function data_default2() {
  var data = [];
  this.visit(function(node) {
    if (!node.length) do
      data.push(node.data);
    while (node = node.next);
  });
  return data;
}

// node_modules/d3-quadtree/src/extent.js
function extent_default(_) {
  return arguments.length ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1]) : isNaN(this._x0) ? void 0 : [[this._x0, this._y0], [this._x1, this._y1]];
}

// node_modules/d3-quadtree/src/quad.js
function quad_default(node, x0, y0, x1, y1) {
  this.node = node;
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;
}

// node_modules/d3-quadtree/src/find.js
function find_default(x3, y3, radius) {
  var data, x0 = this._x0, y0 = this._y0, x1, y1, x22, y22, x32 = this._x1, y32 = this._y1, quads = [], node = this._root, q, i;
  if (node) quads.push(new quad_default(node, x0, y0, x32, y32));
  if (radius == null) radius = Infinity;
  else {
    x0 = x3 - radius, y0 = y3 - radius;
    x32 = x3 + radius, y32 = y3 + radius;
    radius *= radius;
  }
  while (q = quads.pop()) {
    if (!(node = q.node) || (x1 = q.x0) > x32 || (y1 = q.y0) > y32 || (x22 = q.x1) < x0 || (y22 = q.y1) < y0) continue;
    if (node.length) {
      var xm = (x1 + x22) / 2, ym = (y1 + y22) / 2;
      quads.push(
        new quad_default(node[3], xm, ym, x22, y22),
        new quad_default(node[2], x1, ym, xm, y22),
        new quad_default(node[1], xm, y1, x22, ym),
        new quad_default(node[0], x1, y1, xm, ym)
      );
      if (i = (y3 >= ym) << 1 | x3 >= xm) {
        q = quads[quads.length - 1];
        quads[quads.length - 1] = quads[quads.length - 1 - i];
        quads[quads.length - 1 - i] = q;
      }
    } else {
      var dx = x3 - +this._x.call(null, node.data), dy = y3 - +this._y.call(null, node.data), d2 = dx * dx + dy * dy;
      if (d2 < radius) {
        var d = Math.sqrt(radius = d2);
        x0 = x3 - d, y0 = y3 - d;
        x32 = x3 + d, y32 = y3 + d;
        data = node.data;
      }
    }
  }
  return data;
}

// node_modules/d3-quadtree/src/remove.js
function remove_default3(d) {
  if (isNaN(x3 = +this._x.call(null, d)) || isNaN(y3 = +this._y.call(null, d))) return this;
  var parent, node = this._root, retainer, previous, next, x0 = this._x0, y0 = this._y0, x1 = this._x1, y1 = this._y1, x3, y3, xm, ym, right, bottom, i, j;
  if (!node) return this;
  if (node.length) while (true) {
    if (right = x3 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y3 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
    if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
    if (!node.length) break;
    if (parent[i + 1 & 3] || parent[i + 2 & 3] || parent[i + 3 & 3]) retainer = parent, j = i;
  }
  while (node.data !== d) if (!(previous = node, node = node.next)) return this;
  if (next = node.next) delete node.next;
  if (previous) return next ? previous.next = next : delete previous.next, this;
  if (!parent) return this._root = next, this;
  next ? parent[i] = next : delete parent[i];
  if ((node = parent[0] || parent[1] || parent[2] || parent[3]) && node === (parent[3] || parent[2] || parent[1] || parent[0]) && !node.length) {
    if (retainer) retainer[j] = node;
    else this._root = node;
  }
  return this;
}
function removeAll(data) {
  for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
  return this;
}

// node_modules/d3-quadtree/src/root.js
function root_default() {
  return this._root;
}

// node_modules/d3-quadtree/src/size.js
function size_default2() {
  var size = 0;
  this.visit(function(node) {
    if (!node.length) do
      ++size;
    while (node = node.next);
  });
  return size;
}

// node_modules/d3-quadtree/src/visit.js
function visit_default(callback) {
  var quads = [], q, node = this._root, child, x0, y0, x1, y1;
  if (node) quads.push(new quad_default(node, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
      var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[3]) quads.push(new quad_default(child, xm, ym, x1, y1));
      if (child = node[2]) quads.push(new quad_default(child, x0, ym, xm, y1));
      if (child = node[1]) quads.push(new quad_default(child, xm, y0, x1, ym));
      if (child = node[0]) quads.push(new quad_default(child, x0, y0, xm, ym));
    }
  }
  return this;
}

// node_modules/d3-quadtree/src/visitAfter.js
function visitAfter_default(callback) {
  var quads = [], next = [], q;
  if (this._root) quads.push(new quad_default(this._root, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    var node = q.node;
    if (node.length) {
      var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[0]) quads.push(new quad_default(child, x0, y0, xm, ym));
      if (child = node[1]) quads.push(new quad_default(child, xm, y0, x1, ym));
      if (child = node[2]) quads.push(new quad_default(child, x0, ym, xm, y1));
      if (child = node[3]) quads.push(new quad_default(child, xm, ym, x1, y1));
    }
    next.push(q);
  }
  while (q = next.pop()) {
    callback(q.node, q.x0, q.y0, q.x1, q.y1);
  }
  return this;
}

// node_modules/d3-quadtree/src/x.js
function defaultX(d) {
  return d[0];
}
function x_default(_) {
  return arguments.length ? (this._x = _, this) : this._x;
}

// node_modules/d3-quadtree/src/y.js
function defaultY(d) {
  return d[1];
}
function y_default(_) {
  return arguments.length ? (this._y = _, this) : this._y;
}

// node_modules/d3-quadtree/src/quadtree.js
function quadtree(nodes, x3, y3) {
  var tree = new Quadtree(x3 == null ? defaultX : x3, y3 == null ? defaultY : y3, NaN, NaN, NaN, NaN);
  return nodes == null ? tree : tree.addAll(nodes);
}
function Quadtree(x3, y3, x0, y0, x1, y1) {
  this._x = x3;
  this._y = y3;
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  this._root = void 0;
}
function leaf_copy(leaf) {
  var copy = { data: leaf.data }, next = copy;
  while (leaf = leaf.next) next = next.next = { data: leaf.data };
  return copy;
}
var treeProto = quadtree.prototype = Quadtree.prototype;
treeProto.copy = function() {
  var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1), node = this._root, nodes, child;
  if (!node) return copy;
  if (!node.length) return copy._root = leaf_copy(node), copy;
  nodes = [{ source: node, target: copy._root = new Array(4) }];
  while (node = nodes.pop()) {
    for (var i = 0; i < 4; ++i) {
      if (child = node.source[i]) {
        if (child.length) nodes.push({ source: child, target: node.target[i] = new Array(4) });
        else node.target[i] = leaf_copy(child);
      }
    }
  }
  return copy;
};
treeProto.add = add_default;
treeProto.addAll = addAll;
treeProto.cover = cover_default;
treeProto.data = data_default2;
treeProto.extent = extent_default;
treeProto.find = find_default;
treeProto.remove = remove_default3;
treeProto.removeAll = removeAll;
treeProto.root = root_default;
treeProto.size = size_default2;
treeProto.visit = visit_default;
treeProto.visitAfter = visitAfter_default;
treeProto.x = x_default;
treeProto.y = y_default;

// node_modules/d3-force/src/constant.js
function constant_default5(x3) {
  return function() {
    return x3;
  };
}

// node_modules/d3-force/src/jiggle.js
function jiggle_default(random) {
  return (random() - 0.5) * 1e-6;
}

// node_modules/d3-force/src/collide.js
function x(d) {
  return d.x + d.vx;
}
function y(d) {
  return d.y + d.vy;
}
function collide_default(radius) {
  var nodes, radii, random, strength = 1, iterations = 1;
  if (typeof radius !== "function") radius = constant_default5(radius == null ? 1 : +radius);
  function force() {
    var i, n = nodes.length, tree, node, xi, yi, ri, ri2;
    for (var k = 0; k < iterations; ++k) {
      tree = quadtree(nodes, x, y).visitAfter(prepare);
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        ri = radii[node.index], ri2 = ri * ri;
        xi = node.x + node.vx;
        yi = node.y + node.vy;
        tree.visit(apply);
      }
    }
    function apply(quad, x0, y0, x1, y1) {
      var data = quad.data, rj = quad.r, r = ri + rj;
      if (data) {
        if (data.index > node.index) {
          var x3 = xi - data.x - data.vx, y3 = yi - data.y - data.vy, l = x3 * x3 + y3 * y3;
          if (l < r * r) {
            if (x3 === 0) x3 = jiggle_default(random), l += x3 * x3;
            if (y3 === 0) y3 = jiggle_default(random), l += y3 * y3;
            l = (r - (l = Math.sqrt(l))) / l * strength;
            node.vx += (x3 *= l) * (r = (rj *= rj) / (ri2 + rj));
            node.vy += (y3 *= l) * r;
            data.vx -= x3 * (r = 1 - r);
            data.vy -= y3 * r;
          }
        }
        return;
      }
      return x0 > xi + r || x1 < xi - r || y0 > yi + r || y1 < yi - r;
    }
  }
  function prepare(quad) {
    if (quad.data) return quad.r = radii[quad.data.index];
    for (var i = quad.r = 0; i < 4; ++i) {
      if (quad[i] && quad[i].r > quad.r) {
        quad.r = quad[i].r;
      }
    }
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node;
    radii = new Array(n);
    for (i = 0; i < n; ++i) node = nodes[i], radii[node.index] = +radius(node, i, nodes);
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };
  force.strength = function(_) {
    return arguments.length ? (strength = +_, force) : strength;
  };
  force.radius = function(_) {
    return arguments.length ? (radius = typeof _ === "function" ? _ : constant_default5(+_), initialize(), force) : radius;
  };
  return force;
}

// node_modules/d3-force/src/link.js
function index(d) {
  return d.index;
}
function find2(nodeById, nodeId) {
  var node = nodeById.get(nodeId);
  if (!node) throw new Error("node not found: " + nodeId);
  return node;
}
function link_default(links) {
  var id2 = index, strength = defaultStrength, strengths, distance = constant_default5(30), distances, nodes, count, bias, random, iterations = 1;
  if (links == null) links = [];
  function defaultStrength(link) {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }
  function force(alpha) {
    for (var k = 0, n = links.length; k < iterations; ++k) {
      for (var i = 0, link, source, target, x3, y3, l, b; i < n; ++i) {
        link = links[i], source = link.source, target = link.target;
        x3 = target.x + target.vx - source.x - source.vx || jiggle_default(random);
        y3 = target.y + target.vy - source.y - source.vy || jiggle_default(random);
        l = Math.sqrt(x3 * x3 + y3 * y3);
        l = (l - distances[i]) / l * alpha * strengths[i];
        x3 *= l, y3 *= l;
        target.vx -= x3 * (b = bias[i]);
        target.vy -= y3 * b;
        source.vx += x3 * (b = 1 - b);
        source.vy += y3 * b;
      }
    }
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, m2 = links.length, nodeById = new Map(nodes.map((d, i2) => [id2(d, i2, nodes), d])), link;
    for (i = 0, count = new Array(n); i < m2; ++i) {
      link = links[i], link.index = i;
      if (typeof link.source !== "object") link.source = find2(nodeById, link.source);
      if (typeof link.target !== "object") link.target = find2(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }
    for (i = 0, bias = new Array(m2); i < m2; ++i) {
      link = links[i], bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index]);
    }
    strengths = new Array(m2), initializeStrength();
    distances = new Array(m2), initializeDistance();
  }
  function initializeStrength() {
    if (!nodes) return;
    for (var i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }
  function initializeDistance() {
    if (!nodes) return;
    for (var i = 0, n = links.length; i < n; ++i) {
      distances[i] = +distance(links[i], i, links);
    }
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.links = function(_) {
    return arguments.length ? (links = _, initialize(), force) : links;
  };
  force.id = function(_) {
    return arguments.length ? (id2 = _, force) : id2;
  };
  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };
  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default5(+_), initializeStrength(), force) : strength;
  };
  force.distance = function(_) {
    return arguments.length ? (distance = typeof _ === "function" ? _ : constant_default5(+_), initializeDistance(), force) : distance;
  };
  return force;
}

// node_modules/d3-force/src/lcg.js
var a = 1664525;
var c = 1013904223;
var m = 4294967296;
function lcg_default() {
  let s = 1;
  return () => (s = (a * s + c) % m) / m;
}

// node_modules/d3-force/src/simulation.js
function x2(d) {
  return d.x;
}
function y2(d) {
  return d.y;
}
var initialRadius = 10;
var initialAngle = Math.PI * (3 - Math.sqrt(5));
function simulation_default(nodes) {
  var simulation, alpha = 1, alphaMin = 1e-3, alphaDecay = 1 - Math.pow(alphaMin, 1 / 300), alphaTarget = 0, velocityDecay = 0.6, forces = /* @__PURE__ */ new Map(), stepper = timer(step), event = dispatch_default("tick", "end"), random = lcg_default();
  if (nodes == null) nodes = [];
  function step() {
    tick();
    event.call("tick", simulation);
    if (alpha < alphaMin) {
      stepper.stop();
      event.call("end", simulation);
    }
  }
  function tick(iterations) {
    var i, n = nodes.length, node;
    if (iterations === void 0) iterations = 1;
    for (var k = 0; k < iterations; ++k) {
      alpha += (alphaTarget - alpha) * alphaDecay;
      forces.forEach(function(force) {
        force(alpha);
      });
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        if (node.fx == null) node.x += node.vx *= velocityDecay;
        else node.x = node.fx, node.vx = 0;
        if (node.fy == null) node.y += node.vy *= velocityDecay;
        else node.y = node.fy, node.vy = 0;
      }
    }
    return simulation;
  }
  function initializeNodes() {
    for (var i = 0, n = nodes.length, node; i < n; ++i) {
      node = nodes[i], node.index = i;
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      if (isNaN(node.x) || isNaN(node.y)) {
        var radius = initialRadius * Math.sqrt(0.5 + i), angle = i * initialAngle;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      }
      if (isNaN(node.vx) || isNaN(node.vy)) {
        node.vx = node.vy = 0;
      }
    }
  }
  function initializeForce(force) {
    if (force.initialize) force.initialize(nodes, random);
    return force;
  }
  initializeNodes();
  return simulation = {
    tick,
    restart: function() {
      return stepper.restart(step), simulation;
    },
    stop: function() {
      return stepper.stop(), simulation;
    },
    nodes: function(_) {
      return arguments.length ? (nodes = _, initializeNodes(), forces.forEach(initializeForce), simulation) : nodes;
    },
    alpha: function(_) {
      return arguments.length ? (alpha = +_, simulation) : alpha;
    },
    alphaMin: function(_) {
      return arguments.length ? (alphaMin = +_, simulation) : alphaMin;
    },
    alphaDecay: function(_) {
      return arguments.length ? (alphaDecay = +_, simulation) : +alphaDecay;
    },
    alphaTarget: function(_) {
      return arguments.length ? (alphaTarget = +_, simulation) : alphaTarget;
    },
    velocityDecay: function(_) {
      return arguments.length ? (velocityDecay = 1 - _, simulation) : 1 - velocityDecay;
    },
    randomSource: function(_) {
      return arguments.length ? (random = _, forces.forEach(initializeForce), simulation) : random;
    },
    force: function(name, _) {
      return arguments.length > 1 ? (_ == null ? forces.delete(name) : forces.set(name, initializeForce(_)), simulation) : forces.get(name);
    },
    find: function(x3, y3, radius) {
      var i = 0, n = nodes.length, dx, dy, d2, node, closest;
      if (radius == null) radius = Infinity;
      else radius *= radius;
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        dx = x3 - node.x;
        dy = y3 - node.y;
        d2 = dx * dx + dy * dy;
        if (d2 < radius) closest = node, radius = d2;
      }
      return closest;
    },
    on: function(name, _) {
      return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
    }
  };
}

// node_modules/d3-force/src/manyBody.js
function manyBody_default() {
  var nodes, node, random, alpha, strength = constant_default5(-30), strengths, distanceMin2 = 1, distanceMax2 = Infinity, theta2 = 0.81;
  function force(_) {
    var i, n = nodes.length, tree = quadtree(nodes, x2, y2).visitAfter(accumulate);
    for (alpha = _, i = 0; i < n; ++i) node = nodes[i], tree.visit(apply);
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node2;
    strengths = new Array(n);
    for (i = 0; i < n; ++i) node2 = nodes[i], strengths[node2.index] = +strength(node2, i, nodes);
  }
  function accumulate(quad) {
    var strength2 = 0, q, c2, weight = 0, x3, y3, i;
    if (quad.length) {
      for (x3 = y3 = i = 0; i < 4; ++i) {
        if ((q = quad[i]) && (c2 = Math.abs(q.value))) {
          strength2 += q.value, weight += c2, x3 += c2 * q.x, y3 += c2 * q.y;
        }
      }
      quad.x = x3 / weight;
      quad.y = y3 / weight;
    } else {
      q = quad;
      q.x = q.data.x;
      q.y = q.data.y;
      do
        strength2 += strengths[q.data.index];
      while (q = q.next);
    }
    quad.value = strength2;
  }
  function apply(quad, x1, _, x22) {
    if (!quad.value) return true;
    var x3 = quad.x - node.x, y3 = quad.y - node.y, w = x22 - x1, l = x3 * x3 + y3 * y3;
    if (w * w / theta2 < l) {
      if (l < distanceMax2) {
        if (x3 === 0) x3 = jiggle_default(random), l += x3 * x3;
        if (y3 === 0) y3 = jiggle_default(random), l += y3 * y3;
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
        node.vx += x3 * quad.value * alpha / l;
        node.vy += y3 * quad.value * alpha / l;
      }
      return true;
    } else if (quad.length || l >= distanceMax2) return;
    if (quad.data !== node || quad.next) {
      if (x3 === 0) x3 = jiggle_default(random), l += x3 * x3;
      if (y3 === 0) y3 = jiggle_default(random), l += y3 * y3;
      if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
    }
    do
      if (quad.data !== node) {
        w = strengths[quad.data.index] * alpha / l;
        node.vx += x3 * w;
        node.vy += y3 * w;
      }
    while (quad = quad.next);
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default5(+_), initialize(), force) : strength;
  };
  force.distanceMin = function(_) {
    return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
  };
  force.distanceMax = function(_) {
    return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
  };
  force.theta = function(_) {
    return arguments.length ? (theta2 = _ * _, force) : Math.sqrt(theta2);
  };
  return force;
}

// node_modules/d3-zoom/src/constant.js
var constant_default6 = (x3) => () => x3;

// node_modules/d3-zoom/src/event.js
function ZoomEvent(type2, {
  sourceEvent,
  target,
  transform: transform2,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type2, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    transform: { value: transform2, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}

// node_modules/d3-zoom/src/transform.js
function Transform(k, x3, y3) {
  this.k = k;
  this.x = x3;
  this.y = y3;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x3, y3) {
    return x3 === 0 & y3 === 0 ? this : new Transform(this.k, this.x + this.k * x3, this.y + this.k * y3);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x3) {
    return x3 * this.k + this.x;
  },
  applyY: function(y3) {
    return y3 * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x3) {
    return (x3 - this.x) / this.k;
  },
  invertY: function(y3) {
    return (y3 - this.y) / this.k;
  },
  rescaleX: function(x3) {
    return x3.copy().domain(x3.range().map(this.invertX, this).map(x3.invert, x3));
  },
  rescaleY: function(y3) {
    return y3.copy().domain(y3.range().map(this.invertY, this).map(y3.invert, y3));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity2 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity2;
  return node.__zoom;
}

// node_modules/d3-zoom/src/noevent.js
function nopropagation3(event) {
  event.stopImmediatePropagation();
}
function noevent_default3(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// node_modules/d3-zoom/src/zoom.js
function defaultFilter2(event) {
  return (!event.ctrlKey || event.type === "wheel") && !event.button;
}
function defaultExtent() {
  var e = this;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    if (e.hasAttribute("viewBox")) {
      e = e.viewBox.baseVal;
      return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
    }
    return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
  }
  return [[0, 0], [e.clientWidth, e.clientHeight]];
}
function defaultTransform() {
  return this.__zoom || identity2;
}
function defaultWheelDelta(event) {
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3) * (event.ctrlKey ? 10 : 1);
}
function defaultTouchable2() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function defaultConstrain(transform2, extent, translateExtent) {
  var dx0 = transform2.invertX(extent[0][0]) - translateExtent[0][0], dx1 = transform2.invertX(extent[1][0]) - translateExtent[1][0], dy0 = transform2.invertY(extent[0][1]) - translateExtent[0][1], dy1 = transform2.invertY(extent[1][1]) - translateExtent[1][1];
  return transform2.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}
function zoom_default2() {
  var filter2 = defaultFilter2, extent = defaultExtent, constrain = defaultConstrain, wheelDelta = defaultWheelDelta, touchable = defaultTouchable2, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate = zoom_default, listeners = dispatch_default("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
  function zoom(selection2) {
    selection2.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  zoom.transform = function(collection, transform2, point, event) {
    var selection2 = collection.selection ? collection.selection() : collection;
    selection2.property("__zoom", defaultTransform);
    if (collection !== selection2) {
      schedule(collection, transform2, point, event);
    } else {
      selection2.interrupt().each(function() {
        gesture(this, arguments).event(event).start().zoom(null, typeof transform2 === "function" ? transform2.apply(this, arguments) : transform2).end();
      });
    }
  };
  zoom.scaleBy = function(selection2, k, p, event) {
    zoom.scaleTo(selection2, function() {
      var k0 = this.__zoom.k, k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0 * k1;
    }, p, event);
  };
  zoom.scaleTo = function(selection2, k, p, event) {
    zoom.transform(selection2, function() {
      var e = extent.apply(this, arguments), t0 = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t0.invert(p0), k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
    }, p, event);
  };
  zoom.translateBy = function(selection2, x3, y3, event) {
    zoom.transform(selection2, function() {
      return constrain(this.__zoom.translate(
        typeof x3 === "function" ? x3.apply(this, arguments) : x3,
        typeof y3 === "function" ? y3.apply(this, arguments) : y3
      ), extent.apply(this, arguments), translateExtent);
    }, null, event);
  };
  zoom.translateTo = function(selection2, x3, y3, p, event) {
    zoom.transform(selection2, function() {
      var e = extent.apply(this, arguments), t = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
      return constrain(identity2.translate(p0[0], p0[1]).scale(t.k).translate(
        typeof x3 === "function" ? -x3.apply(this, arguments) : -x3,
        typeof y3 === "function" ? -y3.apply(this, arguments) : -y3
      ), e, translateExtent);
    }, p, event);
  };
  function scale(transform2, k) {
    k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
    return k === transform2.k ? transform2 : new Transform(k, transform2.x, transform2.y);
  }
  function translate(transform2, p0, p1) {
    var x3 = p0[0] - p1[0] * transform2.k, y3 = p0[1] - p1[1] * transform2.k;
    return x3 === transform2.x && y3 === transform2.y ? transform2 : new Transform(transform2.k, x3, y3);
  }
  function centroid(extent2) {
    return [(+extent2[0][0] + +extent2[1][0]) / 2, (+extent2[0][1] + +extent2[1][1]) / 2];
  }
  function schedule(transition2, transform2, point, event) {
    transition2.on("start.zoom", function() {
      gesture(this, arguments).event(event).start();
    }).on("interrupt.zoom end.zoom", function() {
      gesture(this, arguments).event(event).end();
    }).tween("zoom", function() {
      var that = this, args = arguments, g = gesture(that, args).event(event), e = extent.apply(that, args), p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a2 = that.__zoom, b = typeof transform2 === "function" ? transform2.apply(that, args) : transform2, i = interpolate(a2.invert(p).concat(w / a2.k), b.invert(p).concat(w / b.k));
      return function(t) {
        if (t === 1) t = b;
        else {
          var l = i(t), k = w / l[2];
          t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k);
        }
        g.zoom(null, t);
      };
    });
  }
  function gesture(that, args, clean) {
    return !clean && that.__zooming || new Gesture(that, args);
  }
  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.active = 0;
    this.sourceEvent = null;
    this.extent = extent.apply(that, args);
    this.taps = 0;
  }
  Gesture.prototype = {
    event: function(event) {
      if (event) this.sourceEvent = event;
      return this;
    },
    start: function() {
      if (++this.active === 1) {
        this.that.__zooming = this;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform2) {
      if (this.mouse && key !== "mouse") this.mouse[1] = transform2.invert(this.mouse[0]);
      if (this.touch0 && key !== "touch") this.touch0[1] = transform2.invert(this.touch0[0]);
      if (this.touch1 && key !== "touch") this.touch1[1] = transform2.invert(this.touch1[0]);
      this.that.__zoom = transform2;
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        delete this.that.__zooming;
        this.emit("end");
      }
      return this;
    },
    emit: function(type2) {
      var d = select_default2(this.that).datum();
      listeners.call(
        type2,
        this.that,
        new ZoomEvent(type2, {
          sourceEvent: this.sourceEvent,
          target: zoom,
          type: type2,
          transform: this.that.__zoom,
          dispatch: listeners
        }),
        d
      );
    }
  };
  function wheeled(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var g = gesture(this, args).event(event), t = this.__zoom, k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))), p = pointer_default(event);
    if (g.wheel) {
      if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
        g.mouse[1] = t.invert(g.mouse[0] = p);
      }
      clearTimeout(g.wheel);
    } else if (t.k === k) return;
    else {
      g.mouse = [p, t.invert(p)];
      interrupt_default(this);
      g.start();
    }
    noevent_default3(event);
    g.wheel = setTimeout(wheelidled, wheelDelay);
    g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }
  function mousedowned(event, ...args) {
    if (touchending || !filter2.apply(this, arguments)) return;
    var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v = select_default2(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer_default(event, currentTarget), x0 = event.clientX, y0 = event.clientY;
    nodrag_default(event.view);
    nopropagation3(event);
    g.mouse = [p, this.__zoom.invert(p)];
    interrupt_default(this);
    g.start();
    function mousemoved(event2) {
      noevent_default3(event2);
      if (!g.moved) {
        var dx = event2.clientX - x0, dy = event2.clientY - y0;
        g.moved = dx * dx + dy * dy > clickDistance2;
      }
      g.event(event2).zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer_default(event2, currentTarget), g.mouse[1]), g.extent, translateExtent));
    }
    function mouseupped(event2) {
      v.on("mousemove.zoom mouseup.zoom", null);
      yesdrag(event2.view, g.moved);
      noevent_default3(event2);
      g.event(event2).end();
    }
  }
  function dblclicked(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var t0 = this.__zoom, p0 = pointer_default(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t0.invert(p0), k1 = t0.k * (event.shiftKey ? 0.5 : 2), t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);
    noevent_default3(event);
    if (duration > 0) select_default2(this).transition().duration(duration).call(schedule, t1, p0, event);
    else select_default2(this).call(zoom.transform, t1, p0, event);
  }
  function touchstarted(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
    nopropagation3(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer_default(t, this);
      p = [p, this.__zoom.invert(p), t.identifier];
      if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
      else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
    }
    if (touchstarting) touchstarting = clearTimeout(touchstarting);
    if (started) {
      if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
        touchstarting = null;
      }, touchDelay);
      interrupt_default(this);
      g.start();
    }
  }
  function touchmoved(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
    noevent_default3(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer_default(t, this);
      if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
      else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
    }
    t = g.that.__zoom;
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      t = scale(t, Math.sqrt(dp / dl));
      p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
    } else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
    else return;
    g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
  }
  function touchended(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
    nopropagation3(event);
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() {
      touchending = null;
    }, touchDelay);
    for (i = 0; i < n; ++i) {
      t = touches[i];
      if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
      else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
    }
    if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
    if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
    else {
      g.end();
      if (g.taps === 2) {
        t = pointer_default(t, this);
        if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
          var p = select_default2(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
        }
      }
    }
  }
  zoom.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant_default6(+_), zoom) : wheelDelta;
  };
  zoom.filter = function(_) {
    return arguments.length ? (filter2 = typeof _ === "function" ? _ : constant_default6(!!_), zoom) : filter2;
  };
  zoom.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default6(!!_), zoom) : touchable;
  };
  zoom.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant_default6([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
  };
  zoom.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
  };
  zoom.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };
  zoom.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom) : constrain;
  };
  zoom.duration = function(_) {
    return arguments.length ? (duration = +_, zoom) : duration;
  };
  zoom.interpolate = function(_) {
    return arguments.length ? (interpolate = _, zoom) : interpolate;
  };
  zoom.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom : value;
  };
  zoom.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
  };
  zoom.tapDistance = function(_) {
    return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
  };
  return zoom;
}

// src/util/aturi.ts
function extractDidFromAtUri(aturi) {
  const match = aturi.match(/^at:\/\/([^/]+)/);
  return match?.[1] || "";
}

// src/util/handle-cache.ts
var CACHE_KEY = "handleCache";
async function loadHandleCache(context) {
  try {
    const data = await context.loadData();
    return data?.[CACHE_KEY] || {};
  } catch {
    return {};
  }
}
async function saveHandleCache(context, cache) {
  try {
    const data = await context.loadData() || {};
    data[CACHE_KEY] = cache;
    await context.saveData(data);
  } catch (e) {
    console.error("Failed to save handle cache:", e);
  }
}
function extractDid(aturi) {
  return extractDidFromAtUri(aturi);
}

// src/views/category-graph-view.ts
var VIEW_TYPE_CATEGORY_GRAPH = "semblage-category-graph";
var TYPE_COLORS = {
  article: "#e74c3c",
  research: "#9b59b6",
  software: "#3498db",
  video: "#e67e22",
  book: "#27ae60",
  social: "#1abc9c",
  link: "#95a5a6",
  note: "#f39c12",
  other: "#7f8c8d"
};
var PREDICATE_COLORS = {
  cites: "#e74c3c",
  "inspired-by": "#9b59b6",
  "contradicts": "#e67e22",
  "extends": "#3498db",
  "references": "#27ae60",
  "supports": "#1abc9c",
  "supplement": "#f39c12",
  "related": "#95a5a6"
};
var HEURISTIC_LABELS = {
  coref: "Co-reference",
  domain: "Domain affinity",
  lexical: "Lexical overlap",
  temporal: "Temporal proximity",
  typeAdj: "Type adjacency",
  graphProx: "Graph proximity",
  hub: "Hub attachment"
};
var CategoryGraphView = class extends import_obsidian8.ItemView {
  client;
  did;
  cards = [];
  connections = [];
  candidates = [];
  foreignCards = /* @__PURE__ */ new Map();
  // did -> cards
  foreignConnections = /* @__PURE__ */ new Map();
  // did -> connections
  refreshEl;
  svg = null;
  simulation = null;
  showSuggestions = true;
  showImports = true;
  activeFilter = null;
  width = 800;
  height = 600;
  sidePanel = null;
  graphContainer = null;
  selectedCardUri = null;
  handleCache = {};
  plugin;
  constructor(leaf, client, did, plugin) {
    super(leaf);
    this.client = client;
    this.did = did;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CATEGORY_GRAPH;
  }
  getDisplayText() {
    return "Category Graph";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("semblage-category-graph");
    const header = this.contentEl.createDiv({ cls: "semblage-graph-header" });
    header.createEl("h3", { text: "Category Graph" });
    this.refreshEl = header.createEl("span", {
      text: "Loading...",
      cls: "semblage-graph-status"
    });
    const controls = header.createDiv({ cls: "semblage-graph-controls" });
    this.renderControls(controls);
    const mainContainer = this.contentEl.createDiv({ cls: "semblage-graph-main" });
    this.graphContainer = mainContainer.createDiv({ cls: "semblage-graph-container" });
    this.svg = select_default2(this.graphContainer).append("svg").attr("width", "100%").attr("height", "100%");
    this.sidePanel = mainContainer.createDiv({ cls: "semblage-graph-sidepanel hidden" });
    const closeBtn = this.sidePanel.createEl("button", {
      text: "\xD7",
      cls: "semblage-graph-sidepanel-close"
    });
    closeBtn.addEventListener("click", () => this.closeSidePanel());
    await this.loadData();
    this.registerDomEvent(window, "resize", () => {
      this.updateDimensions();
    });
  }
  updateDimensions() {
    if (!this.graphContainer || !this.svg) return;
    const rect = this.graphContainer.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.svg.attr("viewBox", [0, 0, this.width, this.height]);
    if (this.simulation) {
      this.simulation.force("center", center_default(this.width / 2, this.height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }
  renderControls(container) {
    const refreshBtn = container.createEl("button", { text: "Refresh" });
    refreshBtn.addEventListener("click", () => this.loadData());
    const toggleBtn = container.createEl("button", { text: "Hide Suggestions" });
    toggleBtn.addEventListener("click", () => {
      this.showSuggestions = !this.showSuggestions;
      toggleBtn.textContent = this.showSuggestions ? "Hide Suggestions" : "Show Suggestions";
      this.renderGraph();
    });
    const importBtn = container.createEl("button", { text: "Hide Imports" });
    importBtn.addEventListener("click", () => {
      this.showImports = !this.showImports;
      importBtn.textContent = this.showImports ? "Hide Imports" : "Show Imports";
      this.renderGraph();
    });
    const filterSelect = container.createEl("select");
    filterSelect.createEl("option", { text: "All morphisms", value: "" });
    const types = [...new Set(this.connections.map((c2) => c2.record.connectionType || "related"))].sort();
    for (const t of types) {
      filterSelect.createEl("option", { text: t, value: t });
    }
    filterSelect.addEventListener("change", (e) => {
      this.activeFilter = e.target.value || null;
      this.renderGraph();
    });
  }
  setAuth(did) {
    this.did = did;
  }
  async loadData() {
    if (!this.did) {
      this.refreshEl.textContent = "Not logged in";
      return;
    }
    this.refreshEl.textContent = "Computing morphisms...";
    try {
      const { listCards: listCards2, listConnections: listConnections2, listFollows: listFollows2, fetchForeignCards: fetchForeignCards2, resolveHandles: resolveHandles2 } = await Promise.resolve().then(() => (init_cosmik_api(), cosmik_api_exports));
      this.cards = await listCards2(this.client, this.did);
      this.connections = await listConnections2(this.client, this.did);
      this.candidates = discoverMorphismCandidates(this.cards, this.connections, 0.35, 3);
      const follows = await listFollows2(this.client, this.did);
      this.foreignCards.clear();
      this.foreignConnections.clear();
      for (const foreignDid of follows.slice(0, 5)) {
        try {
          const foreign = await fetchForeignCards2(this.client, foreignDid);
          this.foreignCards.set(foreignDid, foreign.cards);
          this.foreignConnections.set(foreignDid, foreign.connections);
        } catch (e) {
          console.warn(`Failed to fetch cards from ${foreignDid}:`, e);
        }
      }
      const handleCache = await loadHandleCache(this.plugin);
      const allForeignDids = follows.slice(0, 5);
      this.handleCache = await resolveHandles2(this.client, allForeignDids, handleCache);
      await saveHandleCache(this.plugin, this.handleCache);
      const urlCount = this.cards.filter((c2) => c2.record.type === "URL").length;
      const noteCount = this.cards.filter((c2) => c2.record.type === "NOTE").length;
      const foreignCount = Array.from(this.foreignCards.values()).reduce((sum, cards) => sum + cards.length, 0);
      this.refreshEl.textContent = `${urlCount} objects \xB7 ${noteCount} notes \xB7 ${this.connections.length} morphisms \xB7 ${this.candidates.length} suggestions \xB7 ${follows.length} followed \xB7 ${foreignCount} imported`;
      this.renderGraph();
    } catch (e) {
      this.refreshEl.textContent = "Error loading";
      new import_obsidian8.Notice("Failed to load graph: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  renderGraph() {
    if (!this.svg || !this.graphContainer) return;
    this.svg.selectAll("*").remove();
    this.updateDimensions();
    const g = this.svg.append("g");
    const zoom = zoom_default2().scaleExtent([0.1, 4]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    this.svg.call(zoom);
    const localUrlCards = this.cards.filter((c2) => c2.record.type === "URL");
    const noteCards = this.cards.filter((c2) => c2.record.type === "NOTE");
    const allForeignCards = [];
    for (const cards of this.foreignCards.values()) {
      allForeignCards.push(...cards);
    }
    const allForeignUrlCards = allForeignCards.filter((c2) => c2.record.type === "URL");
    const urlMap = /* @__PURE__ */ new Map();
    const addToUrlMap = (card, aturi, handle) => {
      const key = card.url || card.uri;
      const existing = urlMap.get(key);
      if (existing) {
        existing.provenance.push({ aturi, handle });
      } else {
        urlMap.set(key, { card, provenance: [{ aturi, handle }] });
      }
    };
    const localHandle = this.handleCache[this.did] || "you";
    for (const card of localUrlCards) {
      addToUrlMap(card, card.uri, localHandle);
    }
    for (const card of allForeignUrlCards) {
      const foreignDid = extractDid(card.uri);
      const handle = this.handleCache[foreignDid] || foreignDid.slice(0, 15) + "\u2026";
      addToUrlMap(card, card.uri, handle);
    }
    const uriToUrl = /* @__PURE__ */ new Map();
    for (const [url, { card }] of urlMap) {
      uriToUrl.set(card.uri, url);
      if (card.url && card.url !== url) uriToUrl.set(card.url, url);
    }
    const resolveUrl = (ref) => {
      return uriToUrl.get(ref) || (urlMap.has(ref) ? ref : ref);
    };
    const noteCountMap = /* @__PURE__ */ new Map();
    for (const note of noteCards) {
      if (note.record.parentCard?.uri) {
        const url = uriToUrl.get(note.record.parentCard.uri) || note.record.parentCard.uri;
        noteCountMap.set(url, (noteCountMap.get(url) || 0) + 1);
      }
      if (note.url) {
        const url = uriToUrl.get(note.url) || note.url;
        noteCountMap.set(url, (noteCountMap.get(url) || 0) + 1);
      }
    }
    const degreeMap = /* @__PURE__ */ new Map();
    for (const c2 of this.connections) {
      const s = resolveUrl(c2.record.source);
      const t = resolveUrl(c2.record.target);
      degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
      degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
    }
    if (this.showImports) {
      for (const connections of this.foreignConnections.values()) {
        for (const c2 of connections) {
          const s = resolveUrl(c2.record.source);
          const t = resolveUrl(c2.record.target);
          degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
          degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
        }
      }
    }
    const maxScore = this.candidates.length > 0 ? Math.max(...this.candidates.map((c2) => c2.score)) : 1;
    let nodes = [];
    for (const [url, { card, provenance }] of urlMap) {
      const deg = degreeMap.get(url) || 0;
      const bestCandidate = this.candidates.filter((c2) => c2.source === card.uri || c2.target === card.uri).sort((a2, b) => b.score - a2.score)[0];
      const hasLocal = provenance.some((p) => p.handle === localHandle);
      const isForeign = !hasLocal;
      nodes.push({
        id: url,
        card,
        degree: deg,
        isIsolated: deg === 0,
        morphicScore: bestCandidate ? bestCandidate.score / maxScore : 0,
        noteCount: noteCountMap.get(url) || 0,
        isForeign,
        provenance
      });
    }
    nodes = nodes.filter((n) => {
      if (n.isForeign) return n.degree > 0;
      return n.degree > 0 || n.morphicScore > 0.3;
    });
    const existingLinks = this.connections.filter((c2) => !this.activeFilter || (c2.record.connectionType || "related") === this.activeFilter).map((c2) => ({
      source: resolveUrl(c2.record.source),
      target: resolveUrl(c2.record.target),
      type: c2.record.connectionType || "related",
      isSuggestion: false,
      isForeign: false,
      count: 1
    }));
    const suggestedLinks = this.showSuggestions ? this.candidates.filter((c2) => !this.activeFilter || c2.proposedType === this.activeFilter).map((c2) => ({
      source: resolveUrl(c2.source),
      target: resolveUrl(c2.target),
      type: c2.proposedType,
      isSuggestion: true,
      isForeign: false,
      count: 1,
      candidate: c2
    })) : [];
    const foreignLinks = [];
    if (this.showImports) {
      for (const connections of this.foreignConnections.values()) {
        for (const c2 of connections) {
          foreignLinks.push({
            source: resolveUrl(c2.record.source),
            target: resolveUrl(c2.record.target),
            type: c2.record.connectionType || "related",
            isSuggestion: false,
            isForeign: true,
            count: 1
          });
        }
      }
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const rawLinks = [...existingLinks, ...suggestedLinks, ...foreignLinks].filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );
    const linkMap = /* @__PURE__ */ new Map();
    for (const link of rawLinks) {
      const key = `${link.source}|${link.target}|${link.type}`;
      const existing = linkMap.get(key);
      if (existing) {
        existing.count += link.count;
        if (link.isSuggestion && link.candidate) {
          existing.isSuggestion = true;
          existing.candidate = link.candidate;
        }
        if (!link.isForeign) {
          existing.isForeign = false;
        }
      } else {
        linkMap.set(key, { ...link });
      }
    }
    const links = Array.from(linkMap.values());
    this.svg.append("defs").selectAll("marker").data(["arrow", "arrow-suggested", "arrow-foreign"]).enter().append("marker").attr("id", (d) => d).attr("viewBox", "0 -5 10 10").attr("refX", 28).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr(
      "fill",
      (d) => d === "arrow-suggested" ? "#f39c12" : d === "arrow-foreign" ? "#95a5a6" : "#999"
    );
    this.simulation = simulation_default(nodes).force(
      "link",
      link_default(links).id((d) => d.id).distance((d) => d.isSuggestion ? 120 : d.isForeign ? 100 : 80)
    ).force("charge", manyBody_default().strength(-400)).force("center", center_default(this.width / 2, this.height / 2)).force("collide", collide_default().radius((d) => this.nodeRadius(d) + 8));
    const linkGroup = g.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", (d) => {
      if (d.isForeign) return "#95a5a6";
      if (d.isSuggestion) return "#f39c12";
      return PREDICATE_COLORS[d.type] || "#999";
    }).attr("stroke-width", (d) => {
      const base = d.isForeign ? 1 : d.isSuggestion ? 1.5 : 2;
      return base + (d.count - 1) * 0.8;
    }).attr("stroke-dasharray", (d) => d.isForeign ? "3,3" : d.isSuggestion ? "5,5" : "none").attr("stroke-opacity", (d) => d.isForeign ? 0.5 : d.isSuggestion ? 0.7 : 0.6).attr("marker-end", (d) => {
      if (d.isForeign) return "url(#arrow-foreign)";
      if (d.isSuggestion) return "url(#arrow-suggested)";
      return "url(#arrow)";
    }).style("cursor", (d) => d.isSuggestion ? "pointer" : "default").on("click", (event, d) => {
      if (d.isSuggestion && d.candidate) {
        this.createSuggestion(d.candidate);
      }
    });
    const labelGroup = g.append("g").selectAll("text").data(links.filter((d) => !d.isSuggestion && !d.isForeign)).enter().append("text").attr("font-size", "9px").attr("fill", "#666").attr("text-anchor", "middle").attr("dy", -3).text((d) => d.type);
    const nodeGroup = g.append("g").selectAll("g").data(nodes).enter().append("g").style("cursor", "pointer").call(
      drag_default().on("start", (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }).on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      }).on("end", (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );
    nodeGroup.filter((d) => d.isIsolated && d.morphicScore > 0.5).append("circle").attr("r", (d) => this.nodeRadius(d) + 10).attr("fill", "none").attr("stroke", "#e74c3c").attr("stroke-width", 2).attr("stroke-opacity", 0.3).append("animate").attr("attributeName", "stroke-opacity").attr("values", "0.1;0.5;0.1").attr("dur", "2s").attr("repeatCount", "indefinite");
    nodeGroup.append("circle").attr("r", (d) => this.nodeRadius(d)).attr("fill", (d) => {
      const base = TYPE_COLORS[d.card.semanticType] || "#7f8c8d";
      if (d.isForeign) {
        return base + "60";
      }
      return base;
    }).attr("stroke", (d) => {
      if (d.isForeign) return "#95a5a6";
      if (d.isIsolated) return d.morphicScore > 0.3 ? "#e74c3c" : "#bdc3c7";
      return "#fff";
    }).attr("stroke-width", (d) => {
      if (d.provenance.length > 1) return 2.5;
      return d.isForeign ? 1.5 : d.isIsolated ? 2 : 1.5;
    }).attr("stroke-dasharray", (d) => {
      if (d.isForeign) return "4,2";
      if (d.provenance.length > 1) return "6,2";
      return "none";
    }).attr("opacity", (d) => d.isForeign ? 0.7 : d.isIsolated && d.morphicScore < 0.3 ? 0.4 : 1);
    nodeGroup.filter((d) => d.provenance.length > 1).append("circle").attr("cx", (d) => this.nodeRadius(d) - 2).attr("cy", (d) => -this.nodeRadius(d) + 2).attr("r", 7).attr("fill", "#3498db").attr("stroke", "#fff").attr("stroke-width", 1);
    nodeGroup.filter((d) => d.provenance.length > 1).append("text").attr("x", (d) => this.nodeRadius(d) - 2).attr("y", (d) => -this.nodeRadius(d) + 5).attr("text-anchor", "middle").attr("font-size", "8px").attr("fill", "#fff").attr("font-weight", "bold").text((d) => String(d.provenance.length));
    nodeGroup.filter((d) => !d.isForeign && d.noteCount > 0 && d.provenance.length <= 1).append("circle").attr("cx", (d) => this.nodeRadius(d) - 2).attr("cy", (d) => -this.nodeRadius(d) + 2).attr("r", 7).attr("fill", "#f39c12").attr("stroke", "#fff").attr("stroke-width", 1);
    nodeGroup.filter((d) => d.provenance.length <= 1 && d.noteCount > 0).append("text").attr("x", (d) => this.nodeRadius(d) - 2).attr("y", (d) => -this.nodeRadius(d) + 5).attr("text-anchor", "middle").attr("font-size", "8px").attr("fill", "#fff").attr("font-weight", "bold").text((d) => d.noteCount > 9 ? "9+" : String(d.noteCount));
    nodeGroup.append("text").attr("dy", (d) => this.nodeRadius(d) + 12).attr("text-anchor", "middle").attr("font-size", (d) => d.isForeign ? "9px" : "10px").attr("fill", (d) => d.isForeign ? "var(--text-faint)" : "var(--text-normal)").attr("font-style", (d) => d.isForeign ? "italic" : "normal").text((d) => {
      const label = d.card.title.slice(0, 20) + (d.card.title.length > 20 ? "\u2026" : "");
      if (d.isForeign && d.provenance.length > 0) {
        const handle = d.provenance[0].handle;
        return `[${handle}] ${label}`;
      }
      return label;
    });
    const tooltip = select_default2(this.contentEl).append("div").attr("class", "semblage-graph-tooltip").style("position", "absolute").style("visibility", "hidden").style("background", "var(--background-primary)").style("border", "1px solid var(--background-modifier-border)").style("border-radius", "4px").style("padding", "8px").style("font-size", "11px").style("pointer-events", "none").style("z-index", "100");
    nodeGroup.on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible").html(this.nodeTooltip(d));
    }).on("mousemove", (event) => {
      tooltip.style("top", event.pageY - 10 + "px").style("left", event.pageX + 10 + "px");
    }).on("mouseout", () => {
      tooltip.style("visibility", "hidden");
    }).on("click", (event, d) => {
      this.openSidePanel(d);
    });
    this.simulation.on("tick", () => {
      linkGroup.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      labelGroup.attr("x", (d) => (d.source.x + d.target.x) / 2).attr("y", (d) => (d.source.y + d.target.y) / 2);
      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }
  nodeRadius(d) {
    if (d.isIsolated) return 6 + d.morphicScore * 8;
    return 6 + Math.sqrt(d.degree) * 3;
  }
  nodeTooltip(d) {
    let html = `<strong>${d.card.title}</strong><br>`;
    html += `Type: ${d.card.semanticType}<br>`;
    html += `Degree: ${d.degree}`;
    if (d.noteCount > 0) {
      html += ` \xB7 Notes: ${d.noteCount}`;
    }
    html += `<br>`;
    if (d.provenance.length > 1) {
      const handles = d.provenance.map((p) => p.handle).join(", ");
      html += `<span style="color:#3498db">Clipped by: ${handles}</span><br>`;
    } else if (d.isForeign) {
      html += `<span style="color:#95a5a6;font-style:italic">Imported from ${d.provenance[0]?.handle || "unknown"}</span><br>`;
    }
    if (d.isIsolated) {
      html += `<span style="color:#e74c3c">Isolated</span>`;
      if (d.morphicScore > 0) {
        html += ` \xB7 Morphic potential: ${(d.morphicScore * 100).toFixed(0)}%`;
      }
    }
    return html;
  }
  openSidePanel(d) {
    this.selectedCardUri = d.card.uri;
    if (!this.sidePanel) return;
    this.sidePanel.removeClass("hidden");
    this.sidePanel.empty();
    const closeBtn = this.sidePanel.createEl("button", {
      text: "\xD7",
      cls: "semblage-graph-sidepanel-close"
    });
    closeBtn.addEventListener("click", () => this.closeSidePanel());
    const identity3 = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
    identity3.createEl("h4", { text: d.card.title, cls: "semblage-sidepanel-title" });
    identity3.createEl("span", {
      text: d.card.semanticType,
      cls: "semblage-sidepanel-type"
    });
    if (d.card.subtitle) {
      identity3.createEl("div", { text: d.card.subtitle, cls: "semblage-sidepanel-subtitle" });
    }
    const desc = d.card.record.content;
    if (desc?.metadata?.description) {
      identity3.createEl("div", {
        text: desc.metadata.description,
        cls: "semblage-sidepanel-desc"
      });
    }
    if (d.card.url) {
      const urlBtn = identity3.createEl("button", { text: "Open URL", cls: "semblage-sidepanel-btn" });
      urlBtn.addEventListener("click", () => window.open(d.card.url, "_blank"));
    }
    if (d.provenance.length > 0) {
      const prov = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
      prov.createEl("h5", { text: "Provenance" });
      for (const entry of d.provenance) {
        const row = prov.createDiv({ cls: "semblage-sidepanel-provenance" });
        const handleEl = row.createEl("span", { text: entry.handle, cls: "semblage-sidepanel-handle-link" });
        handleEl.addEventListener("click", () => {
          window.open(`https://semble.so/profile/${entry.handle}`, "_blank");
        });
        row.createEl("span", { text: " " });
        const aturiEl = row.createEl("code", { text: entry.aturi.slice(0, 40) + "\u2026", cls: "semblage-sidepanel-aturi" });
        aturiEl.style.fontSize = "0.75em";
        aturiEl.style.color = "var(--text-faint)";
      }
    }
    const existing = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
    existing.createEl("h5", { text: "Morphisms" });
    const outgoing = this.connections.filter((c2) => c2.record.source === d.card.uri || c2.record.source === d.card.url);
    const incoming = this.connections.filter((c2) => c2.record.target === d.card.uri || c2.record.target === d.card.url);
    if (outgoing.length === 0 && incoming.length === 0) {
      existing.createEl("div", { text: "No morphisms yet.", cls: "semblage-sidepanel-empty" });
    } else {
      for (const edge of outgoing) {
        const target = resolveCardReference(edge.record.target, this.cards);
        const row = existing.createDiv({ cls: "semblage-sidepanel-morphism" });
        row.createEl("span", { text: `${edge.record.connectionType || "related"} \u2192 ` });
        const targetEl = row.createEl("span", { text: target?.title || edge.record.target, cls: "semblage-sidepanel-link" });
        targetEl.addEventListener("click", () => {
          if (target) this.scrollToCard(target.uri);
        });
        if (edge.record.note) {
          row.createEl("span", { text: ` "${edge.record.note}"`, cls: "semblage-sidepanel-note" });
        }
      }
      for (const edge of incoming) {
        const source = resolveCardReference(edge.record.source, this.cards);
        const row = existing.createDiv({ cls: "semblage-sidepanel-morphism" });
        const sourceEl = row.createEl("span", { text: source?.title || edge.record.source, cls: "semblage-sidepanel-link" });
        sourceEl.addEventListener("click", () => {
          if (source) this.scrollToCard(source.uri);
        });
        row.createEl("span", { text: ` \u2192 ${edge.record.connectionType || "related"}` });
        if (edge.record.note) {
          row.createEl("span", { text: ` "${edge.record.note}"`, cls: "semblage-sidepanel-note" });
        }
      }
    }
    if (d.isIsolated) {
      const cardCandidates = this.candidates.filter((c2) => c2.source === d.card.uri).sort((a2, b) => b.score - a2.score);
      if (cardCandidates.length > 0) {
        const potential = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
        potential.createEl("h5", { text: "Morphic Potential" });
        for (const candidate of cardCandidates.slice(0, 3)) {
          const otherUri = candidate.source === d.card.uri ? candidate.target : candidate.source;
          const otherCard = this.cards.find((c2) => c2.uri === otherUri);
          const scorePCT = (candidate.score * 100).toFixed(0);
          const candidateEl = potential.createDiv({ cls: "semblage-sidepanel-candidate" });
          candidateEl.createEl("div", {
            text: `${scorePCT}% match with ${otherCard?.title || otherUri.slice(-20)}`,
            cls: "semblage-sidepanel-candidate-title"
          });
          const bars = candidateEl.createDiv({ cls: "semblage-sidepanel-heuristics" });
          for (const [key, value] of Object.entries(candidate.heuristics)) {
            if (value <= 0) continue;
            const label = HEURISTIC_LABELS[key] || key;
            const row = bars.createDiv({ cls: "semblage-sidepanel-heuristic" });
            row.createEl("span", { text: label, cls: "semblage-sidepanel-heuristic-label" });
            const barBg = row.createDiv({ cls: "semblage-sidepanel-heuristic-bar-bg" });
            const barFill = barBg.createDiv({ cls: "semblage-sidepanel-heuristic-bar-fill" });
            barFill.style.width = `${(value * 100).toFixed(0)}%`;
            row.createEl("span", { text: value.toFixed(2), cls: "semblage-sidepanel-heuristic-value" });
          }
          const connectBtn = candidateEl.createEl("button", { text: "Create morphism", cls: "semblage-sidepanel-btn" });
          connectBtn.addEventListener("click", () => {
            this.createConnectionFromCandidate(candidate);
          });
        }
      }
    }
    if (!d.isForeign) {
      const actions = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
      const connectBtn = actions.createEl("button", { text: "+ Connect to another card", cls: "semblage-sidepanel-btn primary" });
      connectBtn.addEventListener("click", () => {
        new ConnectionModal(this.app, this.client, this.did, this.cards, d.card.uri, void 0, () => this.loadData()).open();
      });
    } else {
      const actions = this.sidePanel.createDiv({ cls: "semblage-sidepanel-section" });
      actions.createEl("div", {
        text: "Imported card \u2014 create morphisms from your own cards to this one.",
        cls: "semblage-sidepanel-empty"
      });
      const connectBtn = actions.createEl("button", { text: "+ Connect from my card", cls: "semblage-sidepanel-btn primary" });
      connectBtn.addEventListener("click", () => {
        new ConnectionModal(this.app, this.client, this.did, this.cards, void 0, d.card.uri, () => this.loadData()).open();
      });
    }
  }
  closeSidePanel() {
    this.selectedCardUri = null;
    if (this.sidePanel) {
      this.sidePanel.addClass("hidden");
      this.sidePanel.empty();
    }
  }
  createConnectionFromCandidate(candidate) {
    new ConnectionModal(this.app, this.client, this.did, this.cards, candidate.source, candidate.target, () => {
      this.loadData();
    }).open();
  }
  createSuggestion(candidate) {
    new ConnectionModal(this.app, this.client, this.did, this.cards, candidate.source, candidate.target, () => {
      this.loadData();
    }).open();
  }
  scrollToCard(uri) {
    const el = this.contentEl.querySelector(`[data-uri="${CSS.escape(uri)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  async onClose() {
    this.simulation?.stop();
    this.contentEl.empty();
  }
};

// src/modals/clip-modal.ts
var import_obsidian9 = require("obsidian");
init_cosmik_api();
function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s\)\]\>\"]+/g);
  return matches ? [...new Set(matches)] : [];
}
async function fetchUrlMetadata(url) {
  try {
    const resp = await (0, import_obsidian9.requestUrl)({ url, method: "GET", throw: false });
    if (resp.status !== 200) return { type: "link" };
    const html = resp.text;
    const getMeta = (prop) => {
      const m1 = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, "i"));
      const m2 = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, "i"));
      return m1?.[1] || m2?.[1] || "";
    };
    const getMetaName = (name) => {
      const m1 = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, "i"));
      const m2 = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${name}"`, "i"));
      return m1?.[1] || m2?.[1] || "";
    };
    const title = getMeta("og:title") || getMetaName("twitter:title") || getMetaName("title") || "";
    const description = getMeta("og:description") || getMetaName("twitter:description") || getMetaName("description") || "";
    const imageUrl = getMeta("og:image") || getMetaName("twitter:image") || "";
    const siteName = getMeta("og:site_name") || "";
    const type2 = getMeta("og:type") || "link";
    const author = getMetaName("author") || getMeta("og:article:author") || "";
    const publishedDate = getMeta("og:article:published_time") || "";
    return {
      $type: "network.cosmik.card#urlMetadata",
      type: type2 === "article" ? "article" : type2 === "video" ? "video" : type2 === "book" ? "book" : "link",
      title: title || void 0,
      description: description || void 0,
      siteName: siteName || void 0,
      imageUrl: imageUrl || void 0,
      author: author || void 0,
      publishedDate: publishedDate || void 0,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (e) {
    console.error("Metadata fetch failed:", e);
    return { type: "link" };
  }
}
var ClipUrlModal = class extends import_obsidian9.Modal {
  client;
  did;
  urls;
  selectedUrl;
  onSaved;
  constructor(app, client, did, selection2, onSaved) {
    super(app);
    this.client = client;
    this.did = did;
    this.urls = extractUrls(selection2);
    this.selectedUrl = this.urls[0] || "";
    this.onSaved = onSaved;
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Clip URL Card" });
    let titleInput;
    let descInput;
    let typeSelect;
    let siteInput;
    let authorInput;
    let urlInput;
    if (this.urls.length > 1) {
      new import_obsidian9.Notice(`Found ${this.urls.length} URLs. Using first one.`);
    }
    contentEl.createEl("label", { text: "URL" });
    urlInput = contentEl.createEl("input", { type: "text", value: this.selectedUrl });
    urlInput.style.width = "100%";
    urlInput.addEventListener("input", () => {
      this.selectedUrl = urlInput.value;
    });
    contentEl.createEl("label", { text: "Type", attr: { style: "display:block;margin-top:10px;" } });
    typeSelect = contentEl.createEl("select");
    const types = ["link", "article", "research", "software", "video", "book", "social"];
    for (const t of types) {
      typeSelect.createEl("option", { text: t, value: t });
    }
    contentEl.createEl("label", { text: "Title", attr: { style: "display:block;margin-top:10px;" } });
    titleInput = contentEl.createEl("input", { type: "text" });
    titleInput.style.width = "100%";
    contentEl.createEl("label", { text: "Description", attr: { style: "display:block;margin-top:10px;" } });
    descInput = contentEl.createEl("textarea");
    descInput.style.width = "100%";
    descInput.style.height = "60px";
    contentEl.createEl("label", { text: "Site Name", attr: { style: "display:block;margin-top:10px;" } });
    siteInput = contentEl.createEl("input", { type: "text" });
    siteInput.style.width = "100%";
    contentEl.createEl("label", { text: "Author", attr: { style: "display:block;margin-top:10px;" } });
    authorInput = contentEl.createEl("input", { type: "text" });
    authorInput.style.width = "100%";
    const fetchBtn = contentEl.createEl("button", { text: "Auto-fetch metadata", attr: { style: "margin-top:10px;" } });
    fetchBtn.addEventListener("click", async () => {
      if (!this.selectedUrl) {
        new import_obsidian9.Notice("Enter a URL first");
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
    if (this.selectedUrl) {
      fetchBtn.click();
    }
    const saveBtn = contentEl.createEl("button", {
      text: "Save Card",
      attr: { style: "margin-top:15px;display:block;" }
    });
    saveBtn.addEventListener("click", async () => {
      const record2 = {
        $type: "network.cosmik.card",
        type: "URL",
        url: this.selectedUrl,
        content: {
          $type: "network.cosmik.card#urlContent",
          url: this.selectedUrl,
          metadata: {
            $type: "network.cosmik.card#urlMetadata",
            type: typeSelect.value,
            title: titleInput.value || void 0,
            description: descInput.value || void 0,
            siteName: siteInput.value || void 0,
            author: authorInput.value || void 0,
            retrievedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        },
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        await createCard(this.client, this.did, record2);
        new import_obsidian9.Notice("Card saved to PDS");
        this.onSaved?.();
        this.close();
      } catch (e) {
        new import_obsidian9.Notice("Failed to save card: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ClipNoteModal = class extends import_obsidian9.Modal {
  client;
  did;
  initialText;
  cards;
  onSaved;
  constructor(app, client, did, initialText, cards, onSaved) {
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
    contentEl.createEl("label", { text: "Note text" });
    const textArea = contentEl.createEl("textarea");
    textArea.value = this.initialText;
    textArea.style.width = "100%";
    textArea.style.height = "120px";
    contentEl.createEl("label", { text: "Attach to URL card *", attr: { style: "display:block;margin-top:10px;" } });
    const parentSelect = contentEl.createEl("select");
    parentSelect.createEl("option", { text: "\u2014 Select a card \u2014", value: "" });
    for (const c2 of this.cards) {
      parentSelect.createEl("option", { text: c2.title.slice(0, 60), value: c2.uri });
    }
    contentEl.createEl("label", { text: "Attach URL (optional)", attr: { style: "display:block;margin-top:10px;" } });
    const urlInput = contentEl.createEl("input", { type: "text" });
    urlInput.style.width = "100%";
    const saveBtn = contentEl.createEl("button", {
      text: "Save Note Card",
      attr: { style: "margin-top:15px;display:block;" }
    });
    saveBtn.addEventListener("click", async () => {
      const text = textArea.value.trim();
      if (!text) {
        new import_obsidian9.Notice("Note text is required");
        return;
      }
      if (!parentSelect.value) {
        new import_obsidian9.Notice("Please select a parent URL card \u2014 notes must be attached to an object");
        return;
      }
      const record2 = {
        $type: "network.cosmik.card",
        type: "NOTE",
        content: {
          $type: "network.cosmik.card#noteContent",
          text
        },
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (urlInput.value.trim()) {
        record2.url = urlInput.value.trim();
      }
      const parent = this.cards.find((c2) => c2.uri === parentSelect.value);
      if (parent) {
        record2.parentCard = { uri: parent.uri, cid: "" };
      }
      try {
        await createCard(this.client, this.did, record2);
        new import_obsidian9.Notice("Note card saved to PDS");
        this.onSaved?.();
        this.close();
      } catch (e) {
        new import_obsidian9.Notice("Failed to save note card: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
init_cosmik_api();
var METADATA_CACHE_BUST = "v=4";
var SemblagePlugin = class extends import_obsidian10.Plugin {
  settings = DEFAULT_SETTINGS;
  auth;
  async onload() {
    await this.loadSettings();
    this.auth = new AtpAuthManager({
      plugin: this,
      protocolScheme: "semblage-oauth",
      clientId: `https://codegod100.github.io/obsidian-callback/clients/semblage.json?${METADATA_CACHE_BUST}`,
      redirectUri: "https://codegod100.github.io/obsidian-callback/callback-semblage.html",
      scope: "atproto transition:generic"
    });
    await this.auth.initialize();
    this.registerView(VIEW_TYPE_SEMBLAGE_GALLERY, (leaf) => {
      return new CardGalleryView(leaf, this.auth.client, this.auth.did || "");
    });
    this.registerView(VIEW_TYPE_CATEGORY_GRAPH, (leaf) => {
      return new CategoryGraphView(leaf, this.auth.client, this.auth.did || "", this);
    });
    this.addRibbonIcon("network", "Open Semblage Gallery", () => {
      this.toggleGalleryView();
    });
    this.addCommand({
      id: "open-graph",
      name: "Open category graph",
      callback: () => this.toggleGraphView()
    });
    this.addCommand({
      id: "open-gallery",
      name: "Open card gallery",
      callback: () => this.toggleGalleryView()
    });
    this.addCommand({
      id: "clip-url-card-from-selection",
      name: "Clip URL card from selection",
      editorCallback: (editor) => {
        this.clipUrlFromSelection(editor.getSelection());
      }
    });
    this.addCommand({
      id: "clip-note-card-from-selection",
      name: "Clip note card from selection",
      editorCallback: (editor) => {
        this.clipNoteFromSelection(editor.getSelection());
      }
    });
    this.addCommand({
      id: "clip-active-note-as-url",
      name: "Clip active note as URL card",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.app.vault.read(file).then((text) => this.clipUrlFromSelection(text));
        }
        return true;
      }
    });
    this.addCommand({
      id: "clip-active-note-as-note",
      name: "Clip active note as note card",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.app.vault.read(file).then((text) => this.clipNoteFromSelection(text));
        }
        return true;
      }
    });
    this.addCommand({
      id: "connect-two-cards",
      name: "Connect two cards",
      callback: () => this.openConnectionModal()
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
  async clipUrlFromSelection(text) {
    if (!this.auth.isLoggedIn) {
      new import_obsidian10.Notice("Please log in first.");
      return;
    }
    new ClipUrlModal(this.app, this.auth.client, this.auth.did, text, () => {
      this.refreshGallery();
    }).open();
  }
  async clipNoteFromSelection(text) {
    if (!this.auth.isLoggedIn) {
      new import_obsidian10.Notice("Please log in first.");
      return;
    }
    const cards = await listCards(this.auth.client, this.auth.did);
    const urlCards = cards.filter((c2) => c2.record.type === "URL").map((c2) => ({ uri: c2.uri, title: c2.title }));
    new ClipNoteModal(this.app, this.auth.client, this.auth.did, text, urlCards, () => {
      this.refreshGallery();
    }).open();
  }
  async openConnectionModal() {
    if (!this.auth.isLoggedIn) {
      new import_obsidian10.Notice("Please log in first.");
      return;
    }
    const cards = await listCards(this.auth.client, this.auth.did);
    new ConnectionModal(this.app, this.auth.client, this.auth.did, cards, void 0, void 0, () => {
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
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
  }
};
