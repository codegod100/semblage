/* semblage-obsidian */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SemblagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian9 = require("obsidian");

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
        let now = Date.now();
        let changed = false;
        read();
        for (const key in store) {
          const item = store[key];
          const expiresAt2 = item.expiresAt;
          if (expiresAt2 !== null && now > expiresAt2) {
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
        const now = Date.now();
        if (!item) {
          return [void 0, Infinity];
        }
        const updatedAt = item.updatedAt;
        if (updatedAt === void 0) {
          return [item.value, Infinity];
        }
        return [item.value, now - updatedAt];
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
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
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
    const { crv, x, y } = privateJwk;
    return { kty: "EC", crv, x, y, kid, alg, use: "sig" };
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
    const now = Math.floor(Date.now() / 1e3);
    return signJwt({
      header: {
        typ: "dpop+jwt",
        jwk: publicJwk
      },
      payload: {
        htm,
        htu,
        iat: now,
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
  return [...algs].sort((a, b) => {
    const aIdx = PREFERRED_ALGORITHMS.indexOf(a);
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
    const min = tree.minLength;
    const max = tree.maxLength;
    message = `expected an array with `;
    if (min > 0) {
      if (max === min) {
        message += `${min}`;
      } else if (max !== void 0) {
        message += `between ${min} and ${max}`;
      } else {
        message += `at least ${min}`;
      }
    } else {
      message += `at most ${max !== null && max !== void 0 ? max : "\u221E"}`;
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
  constructor(type) {
    super();
    this.name = "optional";
    this.type = type;
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
function setBit(bits, index) {
  if (typeof bits !== "number") {
    const idx = index >> 5;
    for (let i = bits.length; i <= idx; i++) {
      bits.push(0);
    }
    bits[idx] |= 1 << index % 32;
    return bits;
  } else if (index < 32) {
    return bits | 1 << index;
  } else {
    return setBit([bits, 0], index);
  }
}
function getBit(bits, index) {
  if (typeof bits === "number") {
    return index < 32 ? bits >>> index & 1 : 0;
  } else {
    return bits[index >> 5] >>> index % 32 & 1;
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
  const indexedEntries = Object.keys(shape).map((key, index) => {
    const type = shape[key];
    let optional = false;
    type._toTerminals((t) => {
      optional || (optional = t.name === "optional");
    });
    return {
      key,
      index,
      matcher: type[MATCHER_SYMBOL],
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
            for (let m = 0; m < indexedEntries.length; m++) {
              if (getBit(seenBits, m)) {
                const k = indexedEntries[m].key;
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
              for (let m = 0; m < indexedEntries.length; m++) {
                if (getBit(seenBits, m)) {
                  const k = indexedEntries[m].key;
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
              for (let m = 0; m < indexedEntries.length; m++) {
                if (m < i || getBit(seenBits, m)) {
                  const k = indexedEntries[m].key;
                  set(output, k, obj[k]);
                }
              }
            } else {
              for (const k in obj) {
                set(output, k, obj[k]);
              }
              for (let m = 0; m < i; m++) {
                if (!getBit(seenBits, m)) {
                  const k = indexedEntries[m].key;
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
  concat(type) {
    if (this._rest) {
      if (type._rest) {
        throw new TypeError("can not concatenate two variadic types");
      }
      return new _ArrayOrTupleType(this._prefix, this._rest, [
        ...this._suffix,
        ...type._prefix,
        ...type._suffix
      ]);
    } else if (type._rest) {
      return new _ArrayOrTupleType([...this._prefix, ...this._suffix, ...type._prefix], type._rest, type._suffix);
    } else {
      return new _ArrayOrTupleType([...this._prefix, ...this._suffix, ...type._prefix, ...type._suffix], type._rest, type._suffix);
    }
  }
};
function toInputType(v) {
  const type = typeof v;
  if (type !== "object") {
    return type;
  } else if (v === null) {
    return "null";
  } else if (Array.isArray(v)) {
    return "array";
  } else {
    return type;
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
  for (const { root, terminal } of terminals) {
    order.set(root, (_a = order.get(root)) !== null && _a !== void 0 ? _a : order.size);
    if (terminal.name === "never") {
    } else if (terminal.name === "optional") {
      optionals.push(root);
    } else if (terminal.name === "unknown") {
      unknowns.push(root);
    } else if (terminal.name === "literal") {
      const roots = (_b = literals.get(terminal.value)) !== null && _b !== void 0 ? _b : [];
      roots.push(root);
      literals.set(terminal.value, roots);
      expectedTypes.push(toInputType(terminal.value));
    } else {
      const roots = (_c = types.get(terminal.name)) !== null && _c !== void 0 ? _c : [];
      roots.push(root);
      types.set(terminal.name, roots);
      expectedTypes.push(terminal.name);
    }
  }
  const byOrder = (a, b) => {
    var _a2, _b2;
    return ((_a2 = order.get(a)) !== null && _a2 !== void 0 ? _a2 : 0) - ((_b2 = order.get(b)) !== null && _b2 !== void 0 ? _b2 : 0);
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
  for (const [type, roots] of types) {
    types.set(type, dedup(roots.concat(unknowns)).sort(byOrder));
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
  for (const { root, terminal } of objects) {
    terminal.shape[key]._toTerminals((t) => list.push({ root, terminal: t }));
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
    for (const [type, options] of types) {
      byType[type] = options[0][MATCHER_SYMBOL];
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
  for (const { root, terminal } of terminals) {
    if (terminal.name === "unknown") {
      return void 0;
    }
    if (terminal.name === "object") {
      for (const key in terminal.shape) {
        keyCounts.set(key, ((_a = keyCounts.get(key)) !== null && _a !== void 0 ? _a : 0) + 1);
      }
      objects.push({ root, terminal });
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
    for (const [type, options] of types) {
      byType[type] = options.map((t) => t[MATCHER_SYMBOL]);
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
  constructor(transformed, transform) {
    super();
    this.name = "transform";
    this._transformed = transformed;
    this._transform = transform;
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
  const identity = await identityResolver.resolve(ident);
  return {
    identity,
    metadata: await getMetadataFromResourceServer(identity.pds)
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
  return async (input, init) => {
    const request = new Request(input, init);
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
      if (input === request || init?.body instanceof ReadableStream) {
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
      const nextRequest = new Request(input, init);
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
  const { identity, metadata } = resolved;
  const loginHint = identity ? identity.handle !== "handle.invalid" ? identity.handle : identity.did : void 0;
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
  async handle(pathname, init) {
    await this.#getSessionPromise;
    const headers = new Headers(init?.headers);
    let session = this.session;
    let url = new URL(pathname, session.info.aud);
    headers.set("authorization", `${session.token.type} ${session.token.access}`);
    let response = await this.#fetch(url.href, { ...init, headers });
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
    if (init?.body instanceof ReadableStream) {
      return response;
    }
    url = new URL(pathname, session.info.aud);
    headers.set("authorization", `${session.token.type} ${session.token.access}`);
    return await this.#fetch(url.href, { ...init, headers });
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
var isAsciiAlpha = /* @__NO_SIDE_EFFECTS__ */ (c) => {
  return c >= 65 && c <= 90 || c >= 97 && c <= 122;
};
var isAsciiAlphaNum = /* @__NO_SIDE_EFFECTS__ */ (c) => {
  return /* @__PURE__ */ isAsciiAlpha(c) || c >= 48 && c <= 57;
};

// node_modules/@atcute/lexicons/dist/syntax/handle.js
var isValidLabel = (input, start, end) => {
  const len = end - start;
  if (len === 0 || len > 63) {
    return false;
  }
  const first = input.charCodeAt(start);
  if (!isAsciiAlphaNum(first)) {
    return false;
  }
  if (len > 1) {
    if (!isAsciiAlphaNum(input.charCodeAt(end - 1)))
      return false;
    for (let j = start + 1; j < end - 1; j++) {
      const c = input.charCodeAt(j);
      if (!isAsciiAlphaNum(c) && c !== 45) {
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
      let id = service2.id;
      if (id[0] === "#") {
        id = did + id;
      }
      identifiers[i] = id;
    }
    for (let i = 0; i < len; i++) {
      const id = identifiers[i];
      for (let j = 0; j < i; j++) {
        if (id === identifiers[j]) {
          return err({
            message: `duplicate "${id}" service`,
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
    const { id, type, serviceEndpoint } = services[idx];
    if (id !== predicate.id && id !== doc.id + predicate.id) {
      continue;
    }
    if (predicate.type !== void 0) {
      if (Array.isArray(type)) {
        if (!type.includes(predicate.type)) {
          continue;
        }
      } else {
        if (type !== predicate.type) {
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
  const type = response.headers.get("content-type")?.split(";", 1)[0].trim();
  if (type === void 0) {
    if (response.body) {
      await response.body.cancel();
    }
    throw new ImproperContentTypeError(null, `missing response content-type`);
  }
  if (!typeRegex.test(type)) {
    if (response.body) {
      await response.body.cancel();
    }
    throw new ImproperContentTypeError(type, `unexpected response content-type`);
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
  return async (pathname, init) => {
    const url = new URL(pathname, service2);
    return await _fetch(url.href, init);
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
      const type = headers2.get("content-type");
      if (status !== 200) {
        let json;
        if (type != null && JSON_CONTENT_TYPE_RE.test(type)) {
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
            if (type != null && JSON_CONTENT_TYPE_RE.test(type)) {
              data = await response.json();
            } else {
              await response.body?.cancel();
              throw new TypeError(`Invalid response content-type (got ${type})`);
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
var _mergeHeaders = (init, defaults) => {
  let headers;
  for (const name in defaults) {
    const value = defaults[name];
    if (value !== null) {
      headers ??= new Headers(init);
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    }
  }
  return headers ?? init;
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
  async handle(pathname, init) {
    const cacheKey = `${init?.method || "GET"}:${pathname}`;
    if (init?.method?.toLowerCase() === "get") {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached.clone();
    }
    let resp;
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

// src/types.ts
var SEMANTIC_TYPES = [
  "article",
  "research",
  "software",
  "video",
  "book",
  "social",
  "link"
];
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

// src/api/cosmik-api.ts
var CARD_COLLECTION = "network.cosmik.card";
var CONNECTION_COLLECTION = "network.cosmik.connection";
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
function buildConnectionIndex(cards, connections) {
  const index = /* @__PURE__ */ new Map();
  for (const card of cards) {
    const empty = { outgoing: [], incoming: [] };
    index.set(card.uri, empty);
    if (card.url) {
      index.set(card.url, empty);
    }
  }
  for (const edge of connections) {
    const source = edge.record.source;
    const target = edge.record.target;
    if (!index.has(source)) {
      index.set(source, { outgoing: [], incoming: [] });
    }
    if (!index.has(target)) {
      index.set(target, { outgoing: [], incoming: [] });
    }
    const sourceEntry = index.get(source);
    if (sourceEntry) sourceEntry.outgoing.push(edge);
    const targetEntry = index.get(target);
    if (targetEntry) targetEntry.incoming.push(edge);
  }
  return index;
}
function resolveCardReference(ref, cards) {
  return cards.find((c) => c.uri === ref || c.url === ref);
}

// src/modals/connection-modal.ts
var import_obsidian6 = require("obsidian");
var PRESET_TYPES = ["RELATED", "SUPPORTS", "SUPPLEMENT", "cites", "inspired-by", "contradicts", "extends", "references"];
var ConnectionModal = class extends import_obsidian6.Modal {
  client;
  did;
  cards;
  preferredSource;
  onSaved;
  constructor(app, client, did, cards, preferredSource, onSaved) {
    super(app);
    this.client = client;
    this.did = did;
    this.cards = cards;
    this.preferredSource = preferredSource;
    this.onSaved = onSaved;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Connect Two Cards" });
    contentEl.createEl("label", { text: "Source card" });
    const sourceSelect = contentEl.createEl("select");
    sourceSelect.style.width = "100%";
    for (const c of this.cards) {
      sourceSelect.createEl("option", {
        text: `[${c.semanticType}] ${c.title.slice(0, 60)}`,
        value: c.uri
      });
    }
    if (this.preferredSource) {
      sourceSelect.value = this.preferredSource;
    }
    contentEl.createEl("label", { text: "Target card", attr: { style: "display:block;margin-top:10px;" } });
    const targetSelect = contentEl.createEl("select");
    targetSelect.style.width = "100%";
    for (const c of this.cards) {
      targetSelect.createEl("option", {
        text: `[${c.semanticType}] ${c.title.slice(0, 60)}`,
        value: c.uri
      });
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
    const grouped = /* @__PURE__ */ new Map();
    for (const card of this.cards) {
      const list = grouped.get(card.semanticType) || [];
      list.push(card);
      grouped.set(card.semanticType, list);
    }
    for (const type of GROUP_ORDER) {
      const groupCards = grouped.get(type);
      if (!groupCards || groupCards.length === 0) continue;
      this.renderGroup(type, groupCards);
    }
  }
  renderGroup(type, cards) {
    const groupEl = this.contentEl.createDiv({ cls: "semblage-group collapsed" });
    const heading = groupEl.createEl("h4", { cls: "semblage-group-title", text: `${type} (${cards.length})` });
    heading.addEventListener("click", () => {
      groupEl.toggleClass("collapsed", !groupEl.hasClass("collapsed"));
    });
    const listEl = groupEl.createDiv({ cls: "semblage-group-list" });
    for (const card of cards) {
      this.renderCard(listEl, card);
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
      new ConnectionModal(this.app, this.client, this.did, this.cards, card.uri, () => this.loadData()).open();
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
    const type = edge.record.connectionType || "related";
    if (direction === "out") {
      const target = resolveCardReference(edge.record.target, this.cards);
      const label = target ? target.title.slice(0, 40) : edge.record.target.slice(-20);
      chip.createEl("span", {
        cls: "semblage-connection-predicate",
        text: `${type.toLowerCase()}`
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
        text: `${type.toLowerCase()}`
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

// src/modals/clip-modal.ts
var import_obsidian8 = require("obsidian");
function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s\)\]\>\"]+/g);
  return matches ? [...new Set(matches)] : [];
}
async function fetchUrlMetadata(url) {
  try {
    const resp = await (0, import_obsidian8.requestUrl)({ url, method: "GET", throw: false });
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
    const type = getMeta("og:type") || "link";
    const author = getMetaName("author") || getMeta("og:article:author") || "";
    const publishedDate = getMeta("og:article:published_time") || "";
    return {
      $type: "network.cosmik.card#urlMetadata",
      type: type === "article" ? "article" : type === "video" ? "video" : type === "book" ? "book" : "link",
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
var ClipUrlModal = class extends import_obsidian8.Modal {
  client;
  did;
  urls;
  selectedUrl;
  onSaved;
  constructor(app, client, did, selection, onSaved) {
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
    let titleInput;
    let descInput;
    let typeSelect;
    let siteInput;
    let authorInput;
    let urlInput;
    if (this.urls.length > 1) {
      new import_obsidian8.Notice(`Found ${this.urls.length} URLs. Using first one.`);
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
        new import_obsidian8.Notice("Enter a URL first");
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
        new import_obsidian8.Notice("Card saved to PDS");
        this.onSaved?.();
        this.close();
      } catch (e) {
        new import_obsidian8.Notice("Failed to save card: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ClipNoteModal = class extends import_obsidian8.Modal {
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
    contentEl.createEl("label", { text: "Reply to URL card (optional)", attr: { style: "display:block;margin-top:10px;" } });
    const parentSelect = contentEl.createEl("select");
    parentSelect.createEl("option", { text: "\u2014 None \u2014", value: "" });
    for (const c of this.cards) {
      parentSelect.createEl("option", { text: c.title.slice(0, 60), value: c.uri });
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
        new import_obsidian8.Notice("Note text is required");
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
      if (parentSelect.value) {
        const parent = this.cards.find((c) => c.uri === parentSelect.value);
        if (parent) {
          record2.parentCard = { uri: parent.uri, cid: "" };
        }
      }
      try {
        await createCard(this.client, this.did, record2);
        new import_obsidian8.Notice("Note card saved to PDS");
        this.onSaved?.();
        this.close();
      } catch (e) {
        new import_obsidian8.Notice("Failed to save note card: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var METADATA_CACHE_BUST = "v=4";
var SemblagePlugin = class extends import_obsidian9.Plugin {
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
    this.addRibbonIcon("network", "Open Semblage Gallery", () => {
      this.toggleGalleryView();
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
  async clipUrlFromSelection(text) {
    if (!this.auth.isLoggedIn) {
      new import_obsidian9.Notice("Please log in first.");
      return;
    }
    new ClipUrlModal(this.app, this.auth.client, this.auth.did, text, () => {
      this.refreshGallery();
    }).open();
  }
  async clipNoteFromSelection(text) {
    if (!this.auth.isLoggedIn) {
      new import_obsidian9.Notice("Please log in first.");
      return;
    }
    const cards = await listCards(this.auth.client, this.auth.did);
    const urlCards = cards.filter((c) => c.record.type === "URL").map((c) => ({ uri: c.uri, title: c.title }));
    new ClipNoteModal(this.app, this.auth.client, this.auth.did, text, urlCards, () => {
      this.refreshGallery();
    }).open();
  }
  async openConnectionModal() {
    if (!this.auth.isLoggedIn) {
      new import_obsidian9.Notice("Please log in first.");
      return;
    }
    const cards = await listCards(this.auth.client, this.auth.did);
    new ConnectionModal(this.app, this.auth.client, this.auth.did, cards, void 0, () => {
      this.refreshGallery();
    }).open();
  }
  refreshGallery() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SEMBLAGE_GALLERY);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof CardGalleryView) {
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
