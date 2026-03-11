# Sign in with SeloraX

![npm version](https://img.shields.io/npm/v/signin-with-selorax?color=0a0a0a&label=npm) ![downloads](https://img.shields.io/npm/dm/signin-with-selorax?color=0a0a0a) ![dependencies](https://img.shields.io/badge/dependencies-0-0a0a0a) ![node](https://img.shields.io/badge/node-%3E%3D18-0a0a0a) ![license](https://img.shields.io/badge/license-MIT-0a0a0a)

Official SDK for integrating SeloraX identity into your application.
OAuth 2.0 Authorization Code flow with PKCE — for Node.js and the browser.

---

## Overview

`signin-with-selorax` lets users authenticate with their SeloraX merchant or customer account — similar to "Sign in with Google". The SDK handles the full OpenID Connect flow: authorization URL generation, PKCE challenges, token exchange, user info retrieval, token refresh, and revocation.

**Two modules, one package:**

| Module | Environment | Import |
|--------|-------------|--------|
| `SeloraxOIDC` | Node.js (Express, Fastify, etc.) | `require('signin-with-selorax')` |
| `SeloraxSignIn` | Browser (React, Next.js, Vue, vanilla) | `require('signin-with-selorax/frontend/selorax-signin')` |

---

## Installation

```bash
npm install signin-with-selorax
```

---

## How It Works

```
┌──────────┐     1. Redirect      ┌──────────────┐
│          │ ──────────────────>   │              │
│   Your   │                      │   SeloraX    │
│   App    │     2. Code           │   Identity   │
│          │ <──────────────────   │   Provider   │
└──────────┘                      └──────────────┘
      │
      │  3. Exchange code for tokens
      │  4. Fetch user info
      │
      v
┌──────────┐
│  Tokens  │  access_token (1hr)
│  + User  │  refresh_token (30d)
│  Info    │  sub: "merchant:7"
└──────────┘
```

---

## Node.js — Quick Start

```js
const express = require('express');
const session = require('express-session');
const { SeloraxOIDC, createCallbackHandler, requireAuth } = require('signin-with-selorax');

const app = express();
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: false }));

const oidc = new SeloraxOIDC({
    issuer: 'https://api.selorax.io',
    clientId: 'sx_oc_...',
    clientSecret: 'sx_os_...',
    redirectUri: 'http://localhost:3000/auth/callback',
});

// Redirect to SeloraX
app.get('/auth/login', (req, res) => {
    const { url, state, pkce } = oidc.getAuthorizationUrl();
    req.session.oauthState = state;
    req.session.oauthPkce = pkce?.verifier;
    res.redirect(url);
});

// Handle callback
app.get('/auth/callback', createCallbackHandler(oidc, {
    serverSideUserInfo: true,
    onSuccess: (req, res, { tokens, user }) => {
        req.session.user = user;
        req.session.tokens = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
        };
        res.redirect('/dashboard');
    },
    onError: (req, res, error) => {
        res.redirect('/auth/login?error=' + encodeURIComponent(error.error));
    },
}));

// Protected route
app.get('/dashboard', requireAuth({ loginUrl: '/auth/login' }), (req, res) => {
    res.json({ user: req.seloraxUser });
});

// Logout
app.get('/auth/logout', async (req, res) => {
    if (req.session.tokens?.access_token) {
        await oidc.revokeToken(req.session.tokens.access_token).catch(() => {});
    }
    req.session.destroy(() => res.redirect('/'));
});

app.listen(3000);
```

---

## Browser — Quick Start

```js
import { SeloraxSignIn } from 'signin-with-selorax/frontend/selorax-signin';

const signIn = new SeloraxSignIn({
    issuer: 'https://api.selorax.io',
    clientId: 'sx_oc_...',
    redirectUri: window.location.origin + '/auth/callback',
});
```

**Login page:**

```js
document.getElementById('login-btn').addEventListener('click', () => {
    signIn.login();
});
```

**Callback page:**

```js
const result = signIn.parseCallback();

if (result.error) {
    console.error(result.error, result.description);
} else {
    // Send code + verifier to your backend for token exchange
    const res = await fetch('/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.code, verifier: result.verifier }),
    });
}
```

---

## API Reference

### `SeloraxOIDC` — Server-Side Client

#### Constructor

```js
new SeloraxOIDC(config)
```

<table>
<tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
<tr><td><code>issuer</code></td><td>string</td><td>Yes</td><td>SeloraX platform URL</td></tr>
<tr><td><code>clientId</code></td><td>string</td><td>Yes</td><td>OAuth client ID (<code>sx_oc_...</code>)</td></tr>
<tr><td><code>clientSecret</code></td><td>string</td><td>Confidential only</td><td>OAuth client secret (<code>sx_os_...</code>)</td></tr>
<tr><td><code>redirectUri</code></td><td>string</td><td>Yes</td><td>Registered callback URL</td></tr>
<tr><td><code>scopes</code></td><td>string[]</td><td>No</td><td>Default: <code>['openid', 'profile', 'email']</code></td></tr>
<tr><td><code>timeout</code></td><td>number</td><td>No</td><td>Request timeout in ms. Default: <code>10000</code></td></tr>
</table>

Falls back to environment variables when config values are omitted:

```env
SELORAX_OIDC_ISSUER=https://api.selorax.io
SELORAX_OIDC_CLIENT_ID=sx_oc_...
SELORAX_OIDC_CLIENT_SECRET=sx_os_...
SELORAX_OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
```

#### Methods

---

**`getAuthorizationUrl(options?)`** — Generate the login redirect URL.

```js
const { url, state, pkce } = oidc.getAuthorizationUrl({
    scopes: ['openid', 'profile', 'email', 'store'],  // optional override
    storeId: 22,   // optional: request access for a specific store
    nonce: '...',   // optional: OIDC nonce
    usePKCE: true,  // default: true (always true for public clients)
});
// url    → full authorization URL to redirect to
// state  → CSRF token to validate on callback
// pkce   → { verifier, challenge, method } or null
```

---

**`exchangeCode(code, codeVerifier?)`** — Exchange authorization code for tokens.

```js
const tokens = await oidc.exchangeCode(code, pkce.verifier);
// {
//   access_token:  "sx_it_...",
//   refresh_token: "sx_ir_...",
//   token_type:    "Bearer",
//   expires_in:    3600,
//   scope:         "openid profile email"
// }
```

---

**`getUserInfo(accessToken)`** — Fetch user info with Bearer token (GET request).

```js
const user = await oidc.getUserInfo(tokens.access_token);
```

---

**`getUserInfoServer(accessToken)`** — Fetch user info with client credentials (POST request). Validates that the token was issued to your client. Requires `clientSecret`.

```js
const user = await oidc.getUserInfoServer(tokens.access_token);
// {
//   sub:            "merchant:7",
//   name:           "John Doe",
//   picture:        "https://...",
//   email:          "john@example.com",
//   email_verified: true,
//   store_id:       22,
//   store_name:     "My Store",
//   role:           "admin"
// }
```

---

**`refreshToken(refreshToken)`** — Get a new access token.

```js
const newTokens = await oidc.refreshToken(tokens.refresh_token);
```

---

**`revokeToken(token, tokenTypeHint?)`** — Revoke an access or refresh token.

```js
await oidc.revokeToken(tokens.access_token, 'access_token');
await oidc.revokeToken(tokens.refresh_token, 'refresh_token');
```

---

**`getDiscovery()`** — Fetch the OpenID Connect discovery document.

```js
const config = await oidc.getDiscovery();
// config.authorization_endpoint, config.scopes_supported, etc.
```

---

#### Static Helpers

**`SeloraxOIDC.parseSubject(sub)`** — Extract user type and ID from the `sub` claim.

```js
const { userType, userId } = SeloraxOIDC.parseSubject('merchant:7');
// userType: 'merchant', userId: 7
```

**`SeloraxOIDC.validateState(received, expected)`** — Timing-safe state comparison.

```js
if (!SeloraxOIDC.validateState(req.query.state, req.session.oauthState)) {
    return res.status(400).send('Invalid state');
}
```

**`SeloraxOIDC.checkCallbackError(query)`** — Check if the callback URL contains an OAuth error.

```js
const error = SeloraxOIDC.checkCallbackError(req.query);
if (error) console.error(error.error, error.description);
```

---

### `SeloraxSignIn` — Browser Client

#### Constructor

```js
new SeloraxSignIn(config)
```

<table>
<tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
<tr><td><code>issuer</code></td><td>string</td><td>Yes</td><td>SeloraX platform URL</td></tr>
<tr><td><code>clientId</code></td><td>string</td><td>Yes</td><td>OAuth client ID</td></tr>
<tr><td><code>redirectUri</code></td><td>string</td><td>Yes</td><td>Your callback URL</td></tr>
<tr><td><code>scopes</code></td><td>string[]</td><td>No</td><td>Default: <code>['openid', 'profile', 'email']</code></td></tr>
<tr><td><code>usePKCE</code></td><td>boolean</td><td>No</td><td>Default: <code>true</code></td></tr>
<tr><td><code>storage</code></td><td>Storage</td><td>No</td><td>Default: <code>sessionStorage</code></td></tr>
</table>

#### Methods

**`login(options?)`** — Redirect the user to SeloraX authorization. Generates state + PKCE automatically and stores them in `sessionStorage`.

```js
await signIn.login();
await signIn.login({ scopes: ['openid', 'store'], storeId: 22 });
```

**`parseCallback(url?)`** — Parse the callback URL after redirect. Validates state and returns the authorization code + PKCE verifier.

```js
const result = signIn.parseCallback();

// Success: { code: "sx_ic_...", state: "...", verifier: "..." }
// Error:   { error: "access_denied", description: "..." }
```

**`getVerifier()`** / **`getState()`** — Access stored values for manual flows.

---

### Express Middleware

#### `createCallbackHandler(oidc, options)`

Creates an Express route handler that processes the OAuth callback automatically: validates state, exchanges the code, optionally fetches user info, and calls your callback.

```js
app.get('/auth/callback', createCallbackHandler(oidc, {
    onSuccess: (req, res, { tokens, user }) => { ... },
    onError: (req, res, error) => { ... },
    fetchUser: true,            // default: true
    serverSideUserInfo: false,  // default: false
}));
```

<table>
<tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr>
<tr><td><code>onSuccess</code></td><td>Function</td><td>—</td><td>Called with <code>{ tokens, user }</code> on success</td></tr>
<tr><td><code>onError</code></td><td>Function</td><td>—</td><td>Called with <code>{ error, description }</code> on failure</td></tr>
<tr><td><code>fetchUser</code></td><td>boolean</td><td><code>true</code></td><td>Auto-fetch user info after code exchange</td></tr>
<tr><td><code>serverSideUserInfo</code></td><td>boolean</td><td><code>false</code></td><td>Use POST userinfo (validates token ownership)</td></tr>
</table>

Expects `req.session.oauthState` and `req.session.oauthPkce` to be set by the login route.

---

#### `requireAuth(options?)`

Middleware that protects routes by checking for an authenticated session.

```js
// Return 401 if not authenticated
app.get('/api/me', requireAuth(), handler);

// Redirect to login page
app.get('/dashboard', requireAuth({ loginUrl: '/auth/login' }), handler);

// Restrict to merchants only
app.get('/admin', requireAuth({ userType: 'merchant' }), handler);

// Custom user extraction
app.get('/api/data', requireAuth({ getUser: (req) => req.customSession?.user }), handler);
```

Sets `req.seloraxUser` on authenticated requests.

---

## Scopes

SeloraX supports two categories of scopes: **identity scopes** (control which user claims are returned) and **resource scopes** (control access to store data via the API).

### Identity Scopes

<table>
<tr><th>Scope</th><th>Claims Returned</th></tr>
<tr><td><code>openid</code></td><td><code>sub</code></td></tr>
<tr><td><code>profile</code></td><td><code>name</code>, <code>picture</code></td></tr>
<tr><td><code>email</code></td><td><code>email</code>, <code>email_verified</code></td></tr>
<tr><td><code>phone</code></td><td><code>phone_number</code>, <code>phone_number_verified</code></td></tr>
<tr><td><code>store</code></td><td><code>store_id</code>, <code>store_name</code>, <code>role</code></td></tr>
</table>

### Resource Scopes

Resource scopes follow the `read:resource` / `write:resource` pattern. Requesting `write:X` implies `read:X` — you don't need to request both.

<table>
<tr><th>Resource</th><th>Read Scope</th><th>Write Scope</th><th>Description</th></tr>
<tr><td>Orders</td><td><code>read:orders</code></td><td><code>write:orders</code></td><td>View, create, update orders</td></tr>
<tr><td>Products</td><td><code>read:products</code></td><td><code>write:products</code></td><td>View, create, update products</td></tr>
<tr><td>Customers</td><td><code>read:customers</code></td><td><code>write:customers</code></td><td>View, create, update customers</td></tr>
<tr><td>Categories</td><td><code>read:categories</code></td><td><code>write:categories</code></td><td>View, create, update categories</td></tr>
<tr><td>Inventory</td><td><code>read:inventory</code></td><td><code>write:inventory</code></td><td>View and update stock levels</td></tr>
<tr><td>Analytics</td><td><code>read:analytics</code></td><td>—</td><td>View store analytics (read-only)</td></tr>
<tr><td>Settings</td><td><code>read:settings</code></td><td><code>write:settings</code></td><td>View and modify store config</td></tr>
<tr><td>Pages</td><td><code>read:pages</code></td><td><code>write:pages</code></td><td>View, create, update pages</td></tr>
<tr><td>Tickets</td><td><code>read:tickets</code></td><td><code>write:tickets</code></td><td>View and manage support tickets</td></tr>
<tr><td>Coupons</td><td><code>read:coupons</code></td><td><code>write:coupons</code></td><td>View, create, update coupons</td></tr>
<tr><td>Shipping</td><td><code>read:shipping</code></td><td><code>write:shipping</code></td><td>View and modify shipping config</td></tr>
</table>

### Requesting Resource Scopes

Pass resource scopes alongside identity scopes when generating the authorization URL:

```js
const { url, state, pkce } = oidc.getAuthorizationUrl({
    scopes: ['openid', 'profile', 'email', 'read:orders', 'write:products'],
});
```

The store owner will see a consent screen listing the requested permissions. If the app later requests additional scopes, the user is re-prompted for consent only for the new scopes.

### Consent Behavior

- **First authorization**: User sees all requested scopes and must approve
- **Returning authorization**: If all scopes were previously granted, consent is skipped
- **Scope changes**: If the app requests new scopes not previously granted, the consent screen re-appears with "NEW" badges on the additional permissions
- **Token refresh**: Refreshed tokens receive the intersection of the originally granted scopes and the client's current `allowed_scopes` — if a scope is removed from the client, refreshed tokens no longer include it

---

## User Types

The `sub` claim identifies the user type and ID:

| Format | Description |
|--------|-------------|
| `merchant:7` | Store administrator |
| `customer:42` | Store customer |

```js
const { userType, userId } = SeloraxOIDC.parseSubject(user.sub);
```

---

## Token Lifetimes

| Token | Lifetime | Prefix |
|-------|----------|--------|
| Authorization code | 60 seconds | `sx_ic_` |
| Access token | 1 hour | `sx_it_` |
| Refresh token | 30 days | `sx_ir_` |

---

## Client Types

<table>
<tr><th></th><th>Confidential</th><th>Public</th></tr>
<tr><td><strong>Has client secret</strong></td><td>Yes</td><td>No</td></tr>
<tr><td><strong>PKCE required</strong></td><td>Optional (recommended)</td><td>Required (enforced)</td></tr>
<tr><td><strong>Server-side userinfo</strong></td><td>Supported</td><td>Not available</td></tr>
<tr><td><strong>Use case</strong></td><td>Backend apps, server-to-server</td><td>SPAs, mobile apps</td></tr>
</table>

---

## Error Handling

The SDK throws typed errors for different failure scenarios:

```js
const { SeloraxOIDCError, SeloraxTokenError, SeloraxAuthorizationError } = require('signin-with-selorax');

try {
    const tokens = await oidc.exchangeCode(code, verifier);
} catch (err) {
    if (err instanceof SeloraxTokenError) {
        // Token exchange or refresh failed
        console.error(err.code);       // e.g. 'invalid_grant'
        console.error(err.response);   // raw server response
    } else if (err instanceof SeloraxOIDCError) {
        // Network error, timeout, or config issue
        console.error(err.code);       // e.g. 'timeout', 'network_error'
    }
}
```

| Error Class | Codes | When |
|-------------|-------|------|
| `SeloraxOIDCError` | `missing_config`, `timeout`, `network_error`, `discovery_failed` | Configuration or network issues |
| `SeloraxTokenError` | `token_exchange_failed`, `token_refresh_failed`, `userinfo_failed`, `invalid_grant` | Token endpoint failures |
| `SeloraxAuthorizationError` | `authorization_error` | Authorization flow errors |

---

## PKCE Utilities

For advanced use cases, PKCE functions are exported directly:

```js
const { generatePKCE, generateCodeVerifier, generateCodeChallenge } = require('signin-with-selorax');

const { verifier, challenge, method } = generatePKCE();
// method is always 'S256'

// Or individually
const verifier = generateCodeVerifier(64);
const challenge = generateCodeChallenge(verifier);
```

---

## Constants

```js
const {
    SCOPES, TOKEN_PREFIXES, ENDPOINTS,
    RESOURCE_SCOPES, SCOPE_GROUPS, ALL_VALID_SCOPES,
} = require('signin-with-selorax');

// Identity scope names
SCOPES.OPENID       // 'openid'
SCOPES.STORE         // 'store'

// Token prefixes
TOKEN_PREFIXES.ACCESS_TOKEN   // 'sx_it_'
TOKEN_PREFIXES.CLIENT_ID      // 'sx_oc_'

// API endpoints
ENDPOINTS.AUTHORIZE  // '/api/oauth/authorize'
ENDPOINTS.TOKEN      // '/api/oauth/token'
ENDPOINTS.USERINFO   // '/api/oauth/userinfo'

// Resource scope metadata (keyed by scope string)
RESOURCE_SCOPES['read:orders']
// { resource: 'orders', action: 'read', label: 'Read Orders', description: 'View orders and order details' }

// Scope groups (keyed by resource name, useful for building scope selection UIs)
SCOPE_GROUPS.orders
// { label: 'Orders', description: 'Access to store orders', read: 'read:orders', write: 'write:orders', icon: 'Package' }

// All 27 valid scopes (5 identity + 22 resource)
ALL_VALID_SCOPES  // ['openid', 'profile', 'email', 'phone', 'store', 'read:orders', ...]
```

---

## Discovery

The OpenID Connect discovery document is available at:

```
GET {issuer}/.well-known/openid-configuration
```

```js
const discovery = await oidc.getDiscovery();
```

Returns all supported endpoints, scopes, grant types, and claim types as defined by the [OpenID Connect Discovery spec](https://openid.net/specs/openid-connect-discovery-1_0.html).

---

## Project Structure

```
signin-with-selorax/
  index.js                         Main entry point
  lib/
    selorax-oidc.js                Core OIDC client (Node.js)
    express.js                     Express callback handler + auth middleware
    pkce.js                        PKCE S256 utilities
    constants.js                   Scopes, endpoints, token prefixes
    errors.js                      Error classes
  frontend/
    selorax-signin.js              Browser client (PKCE via Web Crypto API)
```

**Zero runtime dependencies.** Uses Node.js built-in `crypto` module and native `fetch` (Node 18+). The browser module uses the Web Crypto API.

---

## License

[MIT](LICENSE)
