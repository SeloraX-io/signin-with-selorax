class SeloraxOIDCError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'SeloraxOIDCError';
        this.code = code;
    }
}

class SeloraxTokenError extends SeloraxOIDCError {
    constructor(message, code, response) {
        super(message, code || 'token_error');
        this.name = 'SeloraxTokenError';
        this.response = response;
    }
}

class SeloraxAuthorizationError extends SeloraxOIDCError {
    constructor(message, code) {
        super(message, code || 'authorization_error');
        this.name = 'SeloraxAuthorizationError';
    }
}

module.exports = {
    SeloraxOIDCError,
    SeloraxTokenError,
    SeloraxAuthorizationError,
};
