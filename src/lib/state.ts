import type { ModelsResponse } from "~/services/copilot/get-models"

import { getTokenRotator, hasTokenRotator } from "./token-rotator"

export interface State {
  // Token properties (accessed via proxy for multi-token support)
  githubToken?: string
  copilotToken?: string

  // Internal storage for single token mode
  _githubToken?: string
  _copilotToken?: string

  accountType: string
  models?: ModelsResponse
  vsCodeVersion?: string

  manualApprove: boolean
  rateLimitWait: boolean
  showToken: boolean

  // Rate limiting configuration
  rateLimitSeconds?: number
  lastRequestTimestamp?: number
}

const internalState: Omit<State, "githubToken" | "copilotToken"> & {
  _githubToken?: string
  _copilotToken?: string
} = {
  accountType: "individual",
  manualApprove: false,
  rateLimitWait: false,
  showToken: false,
}

/**
 * Proxy for state that integrates with TokenRotator for token management.
 * When TokenRotator is initialized, it will use the rotator for githubToken and copilotToken.
 * Otherwise, falls back to single token mode.
 */
export const state: State = new Proxy(internalState as State, {
  get(target, prop: string | symbol) {
    if (prop === "githubToken") {
      if (hasTokenRotator()) {
        return getTokenRotator().getCurrentToken()
      }
      return (target as typeof internalState)._githubToken
    }

    if (prop === "copilotToken") {
      if (hasTokenRotator()) {
        return getTokenRotator().getCurrentCopilotToken()
      }
      return (target as typeof internalState)._copilotToken
    }

    return target[prop as keyof State]
  },

  set(target, prop: string | symbol, value: unknown) {
    if (prop === "githubToken") {
      // In multi-token mode, this is handled by TokenRotator initialization
      // In single token mode, store directly
      if (!hasTokenRotator()) {
        ; (target as typeof internalState)._githubToken = value as
          | string
          | undefined
      }
      return true
    }

    if (prop === "copilotToken") {
      if (hasTokenRotator()) {
        // Store copilot token with a default expiry (will be updated by setupCopilotToken)
        if (value) {
          getTokenRotator().setCopilotToken(
            value as string,
            Date.now() + 30 * 60 * 1000,
          )
        }
      } else {
        ; (target as typeof internalState)._copilotToken = value as
          | string
          | undefined
      }
      return true
    }

    // @ts-expect-error - dynamic property assignment
    target[prop] = value
    return true
  },
})

