const crypto = require('crypto');

/**
 * Generate a cryptographically random code verifier (43-128 chars).
 * @param {number} [length=64] - Verifier length
 * @returns {string}
 */
function generateCodeVerifier(length = 64) {
    const bytes = crypto.randomBytes(length);
    return bytes
        .toString('base64url')
        .slice(0, Math.max(43, Math.min(length, 128)));
}

/**
 * Derive the S256 code challenge from a verifier.
 * @param {string} verifier
 * @returns {string}
 */
function generateCodeChallenge(verifier) {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
}

/**
 * Generate a PKCE pair (verifier + challenge).
 * @param {number} [length=64]
 * @returns {{ verifier: string, challenge: string, method: 'S256' }}
 */
function generatePKCE(length = 64) {
    const verifier = generateCodeVerifier(length);
    const challenge = generateCodeChallenge(verifier);
    return { verifier, challenge, method: 'S256' };
}

module.exports = { generateCodeVerifier, generateCodeChallenge, generatePKCE };
