import consola from "consola"

import { getTokenRotator, hasTokenRotator } from "./token-rotator"

/**
 * HTTP status codes that indicate the token is invalid or rate limited.
 * These will trigger token rotation when multiple tokens are available.
 */
const TOKEN_ERROR_STATUSES = [
    401, // Unauthorized - token is invalid or expired
    403, // Forbidden - token doesn't have required permissions
    429, // Too Many Requests - rate limited
]

/**
 * Wrapper for fetch that automatically rotates tokens on specific errors.
 * Only active when multiple tokens are configured via TokenRotator.
 *
 * @param makeRequest - Function that performs the actual fetch request
 * @param maxRetries - Maximum number of retry attempts (defaults to number of available tokens)
 * @returns The response from a successful request
 */
export async function withTokenRotation<T>(
    makeRequest: () => Promise<T>,
    maxRetries?: number,
): Promise<T> {
    // If no token rotator, just execute the request normally
    if (!hasTokenRotator()) {
        return makeRequest()
    }

    const rotator = getTokenRotator()
    const retries = maxRetries ?? rotator.getAvailableCount()
    let lastError: unknown

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await makeRequest()
        } catch (error) {
            lastError = error

            // Check if this is a token-related error that should trigger rotation
            if (shouldRotateToken(error)) {
                const currentIndex = rotator.getCurrentIndex()
                consola.warn(
                    `Token ${currentIndex}/${rotator.getTotalCount()} failed, rotating to next token...`,
                )

                // Mark current token as bad and try to rotate
                const hasMore = rotator.markCurrentBad()

                if (!hasMore) {
                    consola.error("All tokens have been exhausted!")
                    break
                }

                // Continue to next attempt with the new token
                continue
            }

            // Not a token error, re-throw immediately
            throw error
        }
    }

    // All retries exhausted
    throw lastError
}

/**
 * Check if an error indicates we should rotate to the next token.
 */
function shouldRotateToken(error: unknown): boolean {
    // Check for fetch Response errors
    if (error && typeof error === "object" && "response" in error) {
        const response = (error as { response: Response }).response
        if (response && TOKEN_ERROR_STATUSES.includes(response.status)) {
            return true
        }
    }

    // Check for HTTPError class (our custom error)
    if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name: string }).name === "HTTPError"
    ) {
        const httpError = error as { response?: Response }
        if (
            httpError.response &&
            TOKEN_ERROR_STATUSES.includes(httpError.response.status)
        ) {
            return true
        }
    }

    // Check error message for common token-related patterns
    if (error instanceof Error) {
        const message = error.message.toLowerCase()
        if (
            message.includes("unauthorized") ||
            message.includes("forbidden") ||
            message.includes("rate limit") ||
            message.includes("quota exceeded") ||
            message.includes("token") ||
            message.includes("authentication")
        ) {
            return true
        }
    }

    return false
}

/**
 * Manually rotate to the next available token.
 * Useful for load balancing or proactive rotation.
 */
export function rotateToken(): boolean {
    if (!hasTokenRotator()) {
        return false
    }

    getTokenRotator().rotate()
    return true
}

/**
 * Get the current token status for logging/debugging.
 */
export function getTokenStatus(): {
    available: number
    total: number
    currentIndex: number
} | null {
    if (!hasTokenRotator()) {
        return null
    }

    const rotator = getTokenRotator()
    return {
        available: rotator.getAvailableCount(),
        total: rotator.getTotalCount(),
        currentIndex: rotator.getCurrentIndex(),
    }
}
