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
 * Maximum number of full cycles through all tokens before giving up.
 */
const MAX_RETRY_ROUNDS = 5

/**
 * Wrapper for fetch that automatically rotates tokens on specific errors.
 * Only active when multiple tokens are configured via TokenRotator.
 *
 * Retry strategy:
 * - On error, rotate to the next token
 * - After trying all tokens, reset and start a new round
 * - Repeat for up to MAX_RETRY_ROUNDS (5) complete cycles
 *
 * @param makeRequest - Function that performs the actual fetch request
 * @param maxRounds - Maximum number of complete cycles through all tokens (default: 5)
 * @returns The response from a successful request
 */
export async function withTokenRotation<T>(
    makeRequest: () => Promise<T>,
    maxRounds: number = MAX_RETRY_ROUNDS,
): Promise<T> {
    // If no token rotator, just execute the request normally
    if (!hasTokenRotator()) {
        return makeRequest()
    }

    const rotator = getTokenRotator()
    const totalTokens = rotator.getTotalCount()
    let lastError: unknown

    for (let round = 0; round < maxRounds; round++) {
        // Reset all tokens at the start of each round (except first)
        if (round > 0) {
            consola.warn(
                `Round ${round}/${maxRounds} failed. Starting retry round ${round + 1}...`,
            )
            rotator.resetAll()
        }

        // Try each token in this round
        for (let tokenIdx = 0; tokenIdx < totalTokens; tokenIdx++) {
            try {
                return await makeRequest()
            } catch (error) {
                lastError = error

                // Check if this is a token-related error that should trigger rotation
                if (shouldRotateToken(error)) {
                    const currentIndex = rotator.getCurrentIndex()
                    consola.warn(
                        `Token ${currentIndex}/${totalTokens} failed (round ${round + 1}/${maxRounds}), trying next...`,
                    )

                    // Try to rotate to next token
                    rotator.rotate()

                    // Continue to next token in this round
                    continue
                }

                // Not a token error, re-throw immediately
                throw error
            }
        }

        // All tokens in this round failed, will reset and try again
        consola.warn(`All ${totalTokens} tokens failed in round ${round + 1}`)
    }

    // All rounds exhausted
    consola.error(
        `All ${maxRounds} retry rounds exhausted with ${totalTokens} tokens. Giving up.`,
    )
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
