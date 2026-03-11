/**
 * SeloraX Sign-In — Browser Helper
 *
 * Handles the redirect-based OAuth flow from the frontend.
 * Works with any framework (React, Vue, vanilla JS).
 *
 * Usage:
 *   import { SeloraxSignIn } from 'signin-with-selorax/frontend/selorax-signin';
 *
 *   const signIn = new SeloraxSignIn({
 *       issuer: 'https://api.selorax.io',
 *       clientId: 'sx_oc_...',
 *       redirectUri: 'https://yourapp.com/auth/callback',
 *   });
 *
 *   // On login button click
 *   signIn.login();
 *
 *   // On callback page
 *   const { code, state, error } = signIn.parseCallback();
 */

const STORAGE_KEY_STATE = 'selorax_oidc_state';
const STORAGE_KEY_VERIFIER = 'selorax_oidc_verifier';
const STORAGE_KEY_NONCE = 'selorax_oidc_nonce';

class SeloraxSignIn {
    /**
     * @param {object} config
     * @param {string} config.issuer - SeloraX platform URL
     * @param {string} config.clientId - OAuth client ID
     * @param {string} config.redirectUri - Your callback URL
     * @param {string[]} [config.scopes] - Requested scopes (default: ['openid', 'profile', 'email'])
     * @param {boolean} [config.usePKCE=true] - Enable PKCE (recommended for browser clients)
     * @param {Storage} [config.storage=sessionStorage] - Storage for state/verifier
     */
    constructor(config = {}) {
        this.issuer = (config.issuer || '').replace(/\/$/, '');
        this.clientId = config.clientId;
        this.redirectUri = config.redirectUri;
        this.scopes = config.scopes || ['openid', 'profile', 'email'];
        this.usePKCE = config.usePKCE !== false;
        this.storage = config.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);

        if (!this.issuer) throw new Error('SeloraxSignIn: issuer is required');
        if (!this.clientId) throw new Error('SeloraxSignIn: clientId is required');
        if (!this.redirectUri) throw new Error('SeloraxSignIn: redirectUri is required');
    }

    /**
     * Redirect the user to SeloraX authorization page.
     *
     * @param {object} [options]
     * @param {string[]} [options.scopes] - Override scopes
     * @param {number} [options.storeId] - Specific store to authorize
     */
    async login(options = {}) {
        const state = this._generateRandom(48);
        const scopes = options.scopes || this.scopes;

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: scopes.join(' '),
            state,
        });

        if (this.usePKCE) {
            const verifier = this._generateRandom(64);
            const challenge = await this._sha256Base64Url(verifier);
            params.set('code_challenge', challenge);
            params.set('code_challenge_method', 'S256');
            this._store(STORAGE_KEY_VERIFIER, verifier);
        }

        if (options.storeId) params.set('store_id', String(options.storeId));

        this._store(STORAGE_KEY_STATE, state);

        window.location.href = `${this.issuer}/api/oauth/authorize?${params.toString()}`;
    }

    /**
     * Parse the callback URL after redirect.
     * Validates state automatically.
     *
     * @param {string} [url=window.location.href]
     * @returns {{ code: string, state: string, verifier: string | null } | { error: string, description?: string }}
     */
    parseCallback(url) {
        const searchParams = new URL(url || window.location.href).searchParams;

        // Check for error
        if (searchParams.has('error')) {
            this._cleanup();
            return {
                error: searchParams.get('error'),
                description: searchParams.get('error_description'),
            };
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const expectedState = this._retrieve(STORAGE_KEY_STATE);

        if (!state || !expectedState || state !== expectedState) {
            this._cleanup();
            return {
                error: 'invalid_state',
                description: 'State mismatch. Please try logging in again.',
            };
        }

        const verifier = this._retrieve(STORAGE_KEY_VERIFIER);
        this._cleanup();

        return { code, state, verifier };
    }

    /**
     * Get the stored PKCE verifier (for manual flows).
     * @returns {string | null}
     */
    getVerifier() {
        return this._retrieve(STORAGE_KEY_VERIFIER);
    }

    /**
     * Get the stored state (for manual flows).
     * @returns {string | null}
     */
    getState() {
        return this._retrieve(STORAGE_KEY_STATE);
    }

    /**
     * Build a logout URL (clear local session, no SeloraX endpoint needed).
     * @param {string} postLogoutRedirectUri - Where to go after logout
     * @returns {string}
     */
    getLogoutUrl(postLogoutRedirectUri) {
        return postLogoutRedirectUri;
    }

    // ── Internal ──

    _generateRandom(length) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return this._base64UrlEncode(array);
    }

    async _sha256Base64Url(input) {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this._base64UrlEncode(new Uint8Array(hash));
    }

    _base64UrlEncode(buffer) {
        let binary = '';
        for (const byte of buffer) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    _store(key, value) {
        if (this.storage) this.storage.setItem(key, value);
    }

    _retrieve(key) {
        if (!this.storage) return null;
        return this.storage.getItem(key);
    }

    _cleanup() {
        if (!this.storage) return;
        this.storage.removeItem(STORAGE_KEY_STATE);
        this.storage.removeItem(STORAGE_KEY_VERIFIER);
        this.storage.removeItem(STORAGE_KEY_NONCE);
    }
}

// Support both ESM import and script tag
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeloraxSignIn };
}
if (typeof window !== 'undefined') {
    window.SeloraxSignIn = SeloraxSignIn;
}
