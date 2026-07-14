/**
 * Map axios error to HTTP status code and error code
 */
export function mapErrorToStatusCode(error) {
    const code = error.code || error.response?.status;
    // Timeout errors → 504 Gateway Timeout
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        return {
            statusCode: 504,
            code: "GATEWAY_TIMEOUT",
            message: "Upstream service request timeout"
        };
    }
    // Connection refused → 502 Bad Gateway
    if (error.code === "ECONNREFUSED" ||
        error.code === "EHOSTUNREACH" ||
        error.code === "ENETUNREACH") {
        return {
            statusCode: 502,
            code: "SERVICE_UNAVAILABLE",
            message: "Upstream service unavailable or unreachable"
        };
    }
    // Invalid response from upstream
    if (error.response?.status) {
        return {
            statusCode: error.response.status >= 500 ? 502 : error.response.status,
            code: "UPSTREAM_ERROR",
            message: `Upstream service returned ${error.response.status}`
        };
    }
    // Network error
    if (error.isAxiosError || error.message?.includes("Network")) {
        return {
            statusCode: 502,
            code: "NETWORK_ERROR",
            message: "Network error communicating with upstream service"
        };
    }
    // Unknown error
    return {
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
    };
}
/**
 * Create standardized error response
 */
export function createErrorResponse(code, message, statusCode, path) {
    return {
        error: {
            code,
            message,
            timestamp: new Date().toISOString(),
            path,
            statusCode
        }
    };
}
/**
 * Global error handler middleware
 * Catches unhandled errors and returns unified error response
 */
export function errorHandler(error, request, response, _next) {
    console.error(`[error-handler] ${request.method} ${request.path}:`, error);
    const { statusCode, code, message } = mapErrorToStatusCode(error);
    const errorResponse = createErrorResponse(code, message, statusCode, request.path);
    response.status(statusCode).json(errorResponse);
}
