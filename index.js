const { SeloraxOIDC } = require('./lib/selorax-oidc');
const { generatePKCE, generateCodeVerifier, generateCodeChallenge } = require('./lib/pkce');
const { createCallbackHandler, requireAuth } = require('./lib/express');
const { SCOPES, TOKEN_PREFIXES, ENDPOINTS, DEFAULT_SCOPES, RESOURCE_SCOPES, SCOPE_GROUPS, ALL_VALID_SCOPES } = require('./lib/constants');
const { SeloraxOIDCError, SeloraxTokenError, SeloraxAuthorizationError } = require('./lib/errors');

module.exports = {
    // ── Core ──
    SeloraxOIDC,

    // ── Express helpers ──
    createCallbackHandler,
    requireAuth,

    // ── PKCE utilities ──
    generatePKCE,
    generateCodeVerifier,
    generateCodeChallenge,

    // ── Constants ──
    SCOPES,
    TOKEN_PREFIXES,
    ENDPOINTS,
    DEFAULT_SCOPES,
    RESOURCE_SCOPES,
    SCOPE_GROUPS,
    ALL_VALID_SCOPES,

    // ── Error classes ──
    SeloraxOIDCError,
    SeloraxTokenError,
    SeloraxAuthorizationError,
};
