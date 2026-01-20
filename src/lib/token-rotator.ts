import consola from "consola"

export interface TokenRotatorConfig {
  tokens: string[]
  onTokenChange?: (token: string, index: number) => void
}

export interface TokenEntry {
  token: string
  isBad: boolean
  lastUsed?: number
  copilotToken?: string
  copilotTokenExpiresAt?: number
}

/**
 * A token rotator that cycles through multiple GitHub tokens.
 * Supports marking tokens as bad and automatically rotating to the next available token.
 */
export class TokenRotator {
  private entries: TokenEntry[]
  private currentIndex: number = 0
  private onTokenChange?: (token: string, index: number) => void

  constructor(config: TokenRotatorConfig) {
    if (config.tokens.length === 0) {
      throw new Error("TokenRotator requires at least one token")
    }

    this.entries = config.tokens.map((token) => ({
      token: token.trim(),
      isBad: false,
    }))
    this.onTokenChange = config.onTokenChange

    consola.info(
      `TokenRotator initialized with ${this.entries.length} token(s)`,
    )
  }

  /**
   * Get the current active token entry.
   */
  getCurrentEntry(): TokenEntry {
    return this.entries[this.currentIndex]
  }

  /**
   * Get the current active GitHub token.
   */
  getCurrentToken(): string {
    return this.entries[this.currentIndex].token
  }

  /**
   * Get the current copilot token if available.
   */
  getCurrentCopilotToken(): string | undefined {
    return this.entries[this.currentIndex].copilotToken
  }

  /**
   * Set the copilot token for the current GitHub token.
   */
  setCopilotToken(copilotToken: string, expiresAt: number): void {
    this.entries[this.currentIndex].copilotToken = copilotToken
    this.entries[this.currentIndex].copilotTokenExpiresAt = expiresAt
  }

  /**
   * Get the number of available (non-bad) tokens.
   */
  getAvailableCount(): number {
    return this.entries.filter((entry) => !entry.isBad).length
  }

  /**
   * Get the total number of tokens.
   */
  getTotalCount(): number {
    return this.entries.length
  }

  /**
   * Get the current token index (1-indexed for display).
   */
  getCurrentIndex(): number {
    return this.currentIndex + 1
  }

  /**
   * Mark the current token as bad and rotate to the next available one.
   * Returns true if a good token was found, false if all tokens are bad.
   */
  markCurrentBad(): boolean {
    const currentEntry = this.entries[this.currentIndex]
    currentEntry.isBad = true
    consola.warn(
      `Token ${this.currentIndex + 1}/${this.entries.length} marked as bad`,
    )

    return this.rotateToNextGood()
  }

  /**
   * Rotate to the next available good token.
   * Returns true if a good token was found, false if all tokens are bad.
   */
  rotateToNextGood(): boolean {
    const startIndex = this.currentIndex
    let attempts = 0

    while (attempts < this.entries.length) {
      this.currentIndex = (this.currentIndex + 1) % this.entries.length
      attempts++

      if (!this.entries[this.currentIndex].isBad) {
        this.entries[this.currentIndex].lastUsed = Date.now()

        if (this.currentIndex !== startIndex) {
          consola.info(
            `Rotated to token ${this.currentIndex + 1}/${this.entries.length}`,
          )
          this.onTokenChange?.(this.getCurrentToken(), this.currentIndex)
        }

        return true
      }
    }

    consola.error("All tokens have been marked as bad!")
    return false
  }

  /**
   * Simple round-robin rotation to the next token (regardless of status).
   * Useful for load balancing across tokens.
   */
  rotate(): void {
    const previousIndex = this.currentIndex
    this.currentIndex = (this.currentIndex + 1) % this.entries.length
    this.entries[this.currentIndex].lastUsed = Date.now()

    if (previousIndex !== this.currentIndex) {
      consola.debug(
        `Rotated to token ${this.currentIndex + 1}/${this.entries.length}`,
      )
      this.onTokenChange?.(this.getCurrentToken(), this.currentIndex)
    }
  }

  /**
   * Reset all tokens to good status.
   */
  resetAll(): void {
    for (const entry of this.entries) {
      entry.isBad = false
    }
    consola.info("All tokens reset to good status")
  }

  /**
   * Check if there are any good tokens available.
   */
  hasGoodTokens(): boolean {
    return this.entries.some((entry) => !entry.isBad)
  }

  /**
   * Get status information for all tokens.
   */
  getStatus(): { index: number; isBad: boolean; isCurrent: boolean }[] {
    return this.entries.map((entry, index) => ({
      index: index + 1,
      isBad: entry.isBad,
      isCurrent: index === this.currentIndex,
    }))
  }
}

// Global token rotator instance
let tokenRotator: TokenRotator | null = null

/**
 * Initialize the global token rotator with the given tokens.
 */
export function initTokenRotator(tokens: string[]): TokenRotator {
  tokenRotator = new TokenRotator({ tokens })
  return tokenRotator
}

/**
 * Get the global token rotator instance.
 */
export function getTokenRotator(): TokenRotator {
  if (!tokenRotator) {
    throw new Error(
      "TokenRotator not initialized. Call initTokenRotator first.",
    )
  }
  return tokenRotator
}

/**
 * Check if the token rotator is initialized.
 */
export function hasTokenRotator(): boolean {
  return tokenRotator !== null
}
