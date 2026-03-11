/**
 * Express Middleware & Route Helpers for "Sign in with SeloraX"
 *
 * Usage:
 *   const { SeloraxOIDC, createCallbackHandler, requireAuth } = require('selorax-oidc-sdk');
 *
 *   const oidc = new SeloraxOIDC({ ... });
 *
 *   // Login route — redirects to SeloraX
 *   app.get('/auth/login', (req, res) => {
 *       const { url, state, pkce } = oidc.getAuthorizationUrl();
 *       req.session.oauthState = state;
 *       req.session.oauthPkce = pkce?.verifier;
 *       res.redirect(url);
 *   });
 *
 *   // Callback route — exchanges code, fetches user
 *   app.get('/auth/callback', createCallbackHandler(oidc, {
 *       onSuccess: (req, res, { tokens, user }) => {
 *           req.session.user = user;
 *           res.redirect('/dashboard');
 *       },
 *       onError: (req, res, error) => {
 *           res.redirect('/login?error=' + error.code);
 *       },
 *   }));
 */

const { SeloraxOIDC } = require('./selorax-oidc');

/**
 * Create an Express route handler for the OAuth callback.
 *
 * Expects `req.session.oauthState` and optionally `req.session.oauthPkce`
 * to be set from the login route.
 *
 * @param {SeloraxOIDC} oidc - Configured OIDC client
 * @param {object} options
 * @param {Function} options.onSuccess - (req, res, { tokens, user }) => void
 * @param {Function} [options.onError] - (req, res, error) => void
 * @param {boolean} [options.fetchUser=true] - Auto-fetch userinfo after code exchange
 * @param {boolean} [options.serverSideUserInfo=false] - Use server-to-server userinfo (POST with client credentials)
 * @returns {Function} Express route handler
 */
function createCallbackHandler(oidc, options = {}) {
    const {
        onSuccess,
        onError,
        fetchUser = true,
        serverSideUserInfo = false,
    } = options;

    return async (req, res, next) => {
        try {
            // Check for error in callback
            const callbackError = SeloraxOIDC.checkCallbackError(req.query);
            if (callbackError) {
                if (onError) return onError(req, res, callbackError);
                return res.status(400).json({ error: callbackError.error, description: callbackError.description });
            }

            const { code, state } = req.query;

            // Validate state (CSRF protection)
            const expectedState = req.session?.oauthState;
            if (!SeloraxOIDC.validateState(state, expectedState)) {
                const err = { error: 'invalid_state', description: 'State mismatch — possible CSRF attack.' };
                if (onError) return onError(req, res, err);
                return res.status(400).json(err);
            }

            // Exchange code for tokens
            const codeVerifier = req.session?.oauthPkce;
            const tokens = await oidc.exchangeCode(code, codeVerifier);

            // Clean up session state
            if (req.session) {
                delete req.session.oauthState;
                delete req.session.oauthPkce;
            }

            // Optionally fetch user info
            let user = null;
            if (fetchUser) {
                user = serverSideUserInfo
                    ? await oidc.getUserInfoServer(tokens.access_token)
                    : await oidc.getUserInfo(tokens.access_token);
            }

            if (onSuccess) return onSuccess(req, res, { tokens, user });
            res.json({ tokens, user });

        } catch (err) {
            if (onError) return onError(req, res, { error: err.code || 'callback_error', description: err.message });
            next(err);
        }
    };
}

/**
 * Express middleware that protects routes — checks for a valid user session.
 *
 * @param {object} [options]
 * @param {Function} [options.getUser] - Custom function to extract user from request (default: req.session.user)
 * @param {string} [options.loginUrl] - Redirect URL for unauthenticated requests (default: return 401)
 * @param {string} [options.userType] - Required user type ('merchant' or 'customer')
 * @returns {Function} Express middleware
 */
function requireAuth(options = {}) {
    return (req, res, next) => {
        const user = options.getUser
            ? options.getUser(req)
            : req.session?.user;

        if (!user) {
            if (options.loginUrl) return res.redirect(options.loginUrl);
            return res.status(401).json({
                message: 'Authentication required.',
                code: 'unauthenticated',
                status: 401,
            });
        }

        if (options.userType && user.sub) {
            const { userType } = SeloraxOIDC.parseSubject(user.sub);
            if (userType !== options.userType) {
                return res.status(403).json({
                    message: `Access restricted to ${options.userType} accounts.`,
                    code: 'forbidden',
                    status: 403,
                });
            }
        }

        req.seloraxUser = user;
        next();
    };
}

module.exports = { createCallbackHandler, requireAuth };
