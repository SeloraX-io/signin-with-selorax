/**
 * SeloraX OIDC Client — "Sign in with SeloraX"
 *
 * Full OAuth 2.0 Authorization Code flow with PKCE support.
 * Works for both confidential (with client_secret) and public clients.
 *
 * Usage:
 *   const { SeloraxOIDC } = require('signin-with-selorax');
 *
 *   const oidc = new SeloraxOIDC({
 *       issuer: 'https://api.selorax.io',
 *       clientId: 'sx_oc_...',
 *       clientSecret: 'sx_os_...',  // omit for public clients
 *       redirectUri: 'https://yourapp.com/auth/callback',
 *   });
 *
 *   // 1. Generate authorization URL
 *   const { url, state, pkce } = oidc.getAuthorizationUrl();
 *
 *   // 2. Exchange code for tokens
 *   const tokens = await oidc.exchangeCode(code, pkce.verifier);
 *
 *   // 3. Get user info
 *   const user = await oidc.getUserInfo(tokens.access_token);
 */

const crypto = require('crypto');
const { generatePKCE } = require('./pkce');
const { ENDPOINTS, DEFAULT_SCOPES } = require('./constants');
const { SeloraxOIDCError, SeloraxTokenError, SeloraxAuthorizationError } = require('./errors');

class SeloraxOIDC {
    /**
     * @param {object} config
     * @param {string} config.issuer - SeloraX platform URL (e.g. 'https://api.selorax.io')
     * @param {string} config.clientId - OAuth client ID (sx_oc_...)
     * @param {string} [config.clientSecret] - OAuth client secret (sx_os_...). Required for confidential clients.
     * @param {string} config.redirectUri - Your callback URL
     * @param {string[]} [config.scopes] - Requested scopes (default: ['openid', 'profile', 'email'])
     * @param {number} [config.timeout=10000] - Request timeout in ms
     */
    constructor(config = {}) {
        this.issuer = (config.issuer || process.env.SELORAX_OIDC_ISSUER || '').replace(/\/$/, '');
        this.clientId = config.clientId || process.env.SELORAX_OIDC_CLIENT_ID;
        this.clientSecret = config.clientSecret || process.env.SELORAX_OIDC_CLIENT_SECRET;
        this.redirectUri = config.redirectUri || process.env.SELORAX_OIDC_REDIRECT_URI;
        this.scopes = config.scopes || DEFAULT_SCOPES;
        this.timeout = config.timeout || 10000;

        if (!this.issuer) throw new SeloraxOIDCError('issuer is required', 'missing_config');
        if (!this.clientId) throw new SeloraxOIDCError('clientId is required', 'missing_config');
        if (!this.redirectUri) throw new SeloraxOIDCError('redirectUri is required', 'missing_config');

        this.isPublicClient = !this.clientSecret;
    }

    // ── Authorization ──

    /**
     * Generate the authorization URL to redirect the user to.
     *
     * @param {object} [options]
     * @param {string[]} [options.scopes] - Override default scopes
     * @param {string} [options.state] - Custom state value (auto-generated if omitted)
     * @param {string} [options.nonce] - OIDC nonce
     * @param {number} [options.storeId] - Specific store ID to request consent for
     * @param {boolean} [options.usePKCE=true] - Generate PKCE challenge (always true for public clients)
     * @returns {{ url: string, state: string, pkce: { verifier: string, challenge: string, method: string } | null }}
     */
    getAuthorizationUrl(options = {}) {
        const state = options.state || crypto.randomBytes(24).toString('hex');
        const scopes = options.scopes || this.scopes;
        const usePKCE = this.isPublicClient ? true : (options.usePKCE !== false);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: scopes.join(' '),
            state,
        });

        let pkce = null;
        if (usePKCE) {
            pkce = generatePKCE();
            params.set('code_challenge', pkce.challenge);
            params.set('code_challenge_method', pkce.method);
        }

        if (options.nonce) params.set('nonce', options.nonce);
        if (options.storeId) params.set('store_id', String(options.storeId));

        const url = `${this.issuer}${ENDPOINTS.AUTHORIZE}?${params.toString()}`;

        return { url, state, pkce };
    }

    // ── Token Exchange ──

    /**
     * Exchange an authorization code for tokens.
     *
     * @param {string} code - Authorization code from callback
     * @param {string} [codeVerifier] - PKCE code verifier (required if PKCE was used)
     * @returns {Promise<{ access_token: string, refresh_token: string, token_type: string, expires_in: number, scope: string }>}
     */
    async exchangeCode(code, codeVerifier) {
        const body = {
            grant_type: 'authorization_code',
            client_id: this.clientId,
            code,
            redirect_uri: this.redirectUri,
        };

        if (this.clientSecret) body.client_secret = this.clientSecret;
        if (codeVerifier) body.code_verifier = codeVerifier;

        const res = await this._fetch(ENDPOINTS.TOKEN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new SeloraxTokenError(
                err.message || `Token exchange failed (${res.status})`,
                err.code || 'token_exchange_failed',
                err
            );
        }

        return res.json();
    }

    /**
     * Refresh an access token using a refresh token.
     *
     * @param {string} refreshToken - The refresh token
     * @returns {Promise<{ access_token: string, refresh_token: string, token_type: string, expires_in: number, scope: string }>}
     */
    async refreshToken(refreshToken) {
        const body = {
            grant_type: 'refresh_token',
            client_id: this.clientId,
            refresh_token: refreshToken,
        };

        if (this.clientSecret) body.client_secret = this.clientSecret;

        const res = await this._fetch(ENDPOINTS.TOKEN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new SeloraxTokenError(
                err.message || `Token refresh failed (${res.status})`,
                err.code || 'token_refresh_failed',
                err
            );
        }

        return res.json();
    }

    // ── User Info ──

    /**
     * Get user info using a Bearer access token (client-side pattern).
     *
     * @param {string} accessToken
     * @returns {Promise<{ sub: string, name?: string, email?: string, store_id?: number, ... }>}
     */
    async getUserInfo(accessToken) {
        const res = await this._fetch(ENDPOINTS.USERINFO, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new SeloraxTokenError(
                err.message || `UserInfo request failed (${res.status})`,
                err.code || 'userinfo_failed',
                err
            );
        }

        return res.json();
    }

    /**
     * Get user info using client credentials (server-to-server pattern).
     * Like Google's tokeninfo — validates the token belongs to your client.
     *
     * @param {string} accessToken
     * @returns {Promise<{ sub: string, name?: string, email?: string, store_id?: number, ... }>}
     */
    async getUserInfoServer(accessToken) {
        if (!this.clientSecret) {
            throw new SeloraxOIDCError(
                'clientSecret is required for server-to-server userinfo',
                'missing_secret'
            );
        }

        const res = await this._fetch(ENDPOINTS.USERINFO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                access_token: accessToken,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new SeloraxTokenError(
                err.message || `UserInfo request failed (${res.status})`,
                err.code || 'userinfo_failed',
                err
            );
        }

        return res.json();
    }

    // ── Token Revocation ──

    /**
     * Revoke an access or refresh token.
     *
     * @param {string} token - The token to revoke
     * @param {'access_token' | 'refresh_token'} [tokenTypeHint]
     * @returns {Promise<void>}
     */
    async revokeToken(token, tokenTypeHint) {
        const body = {
            token,
            client_id: this.clientId,
        };

        if (tokenTypeHint) body.token_type_hint = tokenTypeHint;
        if (this.clientSecret) body.client_secret = this.clientSecret;

        await this._fetch(ENDPOINTS.REVOKE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    // ── Discovery ──

    /**
     * Fetch the OpenID Connect discovery document.
     *
     * @returns {Promise<object>}
     */
    async getDiscovery() {
        const res = await this._fetch(ENDPOINTS.DISCOVERY, { method: 'GET' });

        if (!res.ok) {
            throw new SeloraxOIDCError(
                `Discovery request failed (${res.status})`,
                'discovery_failed'
            );
        }

        return res.json();
    }

    // ── Helpers ──

    /**
     * Parse the user type and ID from a userinfo `sub` claim.
     *
     * @param {string} sub - e.g. "merchant:7" or "customer:42"
     * @returns {{ userType: 'merchant' | 'customer', userId: number }}
     */
    static parseSubject(sub) {
        const [userType, id] = sub.split(':');
        return { userType, userId: Number(id) };
    }

    /**
     * Validate a callback URL's state parameter against the expected state.
     *
     * @param {string} received - State from callback query params
     * @param {string} expected - State you generated with getAuthorizationUrl()
     * @returns {boolean}
     */
    static validateState(received, expected) {
        if (!received || !expected) return false;
        try {
            return crypto.timingSafeEqual(
                Buffer.from(received),
                Buffer.from(expected)
            );
        } catch {
            return false;
        }
    }

    /**
     * Check if a callback URL contains an error response.
     *
     * @param {object} query - Parsed query parameters from callback URL
     * @returns {{ error: string, description?: string } | null}
     */
    static checkCallbackError(query) {
        if (query.error) {
            return {
                error: query.error,
                description: query.error_description,
            };
        }
        return null;
    }

    // ── Internal ──

    async _fetch(path, options) {
        const url = `${this.issuer}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new SeloraxOIDCError(`Request timed out: ${path}`, 'timeout');
            }
            throw new SeloraxOIDCError(`Network error: ${err.message}`, 'network_error');
        } finally {
            clearTimeout(timer);
        }
    }
}

module.exports = { SeloraxOIDC };
