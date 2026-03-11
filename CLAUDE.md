# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`signin-with-selorax` (npm package name) is an OIDC client SDK implementing OAuth 2.0 Authorization Code flow with PKCE for the SeloraX identity platform. Zero runtime dependencies — uses Node.js built-in `crypto` and native `fetch` (Node 18+). The browser module uses the Web Crypto API.

## Commands

```bash
# Publish to npm (injects README into package.json metadata, publishes, restores)
./publish.sh

# No test suite, build step, or linter is configured
```

## Architecture

The SDK has two separate entry points for two environments:

- **Node.js** (`index.js` → `lib/`): `SeloraxOIDC` class handles full server-side OIDC flow (auth URL generation, code exchange, userinfo, token refresh/revocation, discovery). Express middleware helpers (`createCallbackHandler`, `requireAuth`) are provided in `lib/express.js`.
- **Browser** (`frontend/selorax-signin.js`): `SeloraxSignIn` class handles the redirect-based flow from the frontend using Web Crypto API for PKCE. Supports both CommonJS `module.exports` and `window.SeloraxSignIn` global.

The `package.json` `"main"` field points to `index.js` (Node) and `"browser"` field points to `frontend/selorax-signin.js`.

### Key design decisions

- **Public vs confidential clients**: `SeloraxOIDC` auto-detects based on whether `clientSecret` is provided. Public clients always enforce PKCE.
- **Config fallback**: `SeloraxOIDC` constructor falls back to `SELORAX_OIDC_*` environment variables when config values are omitted.
- **Error hierarchy**: `SeloraxOIDCError` (base) → `SeloraxTokenError` (token endpoint failures, includes raw `response`) and `SeloraxAuthorizationError`. All have a `code` property.
- **State validation**: Uses `crypto.timingSafeEqual` on the server; simple string comparison on the browser.
- **Express middleware**: `createCallbackHandler` expects `req.session.oauthState` and `req.session.oauthPkce` set by the login route. `requireAuth` sets `req.seloraxUser` on authenticated requests.

### API endpoints (constants.js)

All OAuth endpoints are under `/api/oauth/` (authorize, token, userinfo, revoke, clients) plus `/.well-known/openid-configuration` for discovery. The issuer URL defaults to `https://api.selorax.io`.

### Token prefixes

`sx_oc_` (client ID), `sx_os_` (client secret), `sx_ic_` (auth code), `sx_it_` (access token), `sx_ir_` (refresh token).
