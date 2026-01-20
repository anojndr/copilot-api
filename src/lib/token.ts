import consola from "consola"
import fs from "node:fs/promises"

import { PATHS } from "~/lib/paths"
import { getCopilotToken } from "~/services/github/get-copilot-token"
import { getDeviceCode } from "~/services/github/get-device-code"
import { getGitHubUser } from "~/services/github/get-user"
import { pollAccessToken } from "~/services/github/poll-access-token"

import { HTTPError } from "./error"
import { state } from "./state"
import { getTokenRotator, hasTokenRotator } from "./token-rotator"

const readGithubToken = () => fs.readFile(PATHS.GITHUB_TOKEN_PATH, "utf8")

const writeGithubToken = (token: string) =>
  fs.writeFile(PATHS.GITHUB_TOKEN_PATH, token)

/**
 * Set up copilot tokens for all GitHub tokens in the rotator.
 * Each GitHub token gets its own copilot token.
 */
async function setupAllCopilotTokens(): Promise<number> {
  const rotator = getTokenRotator()
  const totalTokens = rotator.getTotalCount()
  let refreshInterval = 1800 // Default 30 minutes

  consola.info(`Setting up Copilot tokens for ${totalTokens} GitHub token(s)...`)

  for (let i = 0; i < totalTokens; i++) {
    try {
      // The state proxy uses the current token from rotator
      const { token, refresh_in } = await getCopilotToken()
      rotator.setCopilotToken(token, Date.now() + refresh_in * 1000)

      consola.debug(
        `Copilot token ${i + 1}/${totalTokens} fetched successfully!`,
      )
      if (state.showToken) {
        consola.info(`Copilot token ${i + 1}:`, token)
      }

      // Use the smallest refresh interval among all tokens
      refreshInterval = Math.min(refreshInterval, refresh_in)

      // Rotate to next token for setup
      if (i < totalTokens - 1) {
        rotator.rotate()
      }
    } catch (error) {
      consola.error(`Failed to get Copilot token for GitHub token ${i + 1}:`, error)
      rotator.markCurrentBad()
    }
  }

  // Reset to first good token
  rotator.rotateToNextGood()

  return refreshInterval
}

export const setupCopilotToken = async () => {
  if (hasTokenRotator()) {
    // Multi-token mode: setup copilot tokens for all GitHub tokens
    const refreshInterval = await setupAllCopilotTokens()

    // Set up refresh interval to refresh all tokens
    const intervalMs = (refreshInterval - 60) * 1000
    setInterval(async () => {
      consola.debug("Refreshing all Copilot tokens")
      try {
        await setupAllCopilotTokens()
        consola.debug("All Copilot tokens refreshed")
      } catch (error) {
        consola.error("Failed to refresh Copilot tokens:", error)
      }
    }, intervalMs)

    return
  }

  // Single token mode (backwards compatible)
  const { token, refresh_in } = await getCopilotToken()
  state.copilotToken = token

  // Display the Copilot token to the screen
  consola.debug("GitHub Copilot Token fetched successfully!")
  if (state.showToken) {
    consola.info("Copilot token:", token)
  }

  const refreshInterval = (refresh_in - 60) * 1000
  setInterval(async () => {
    consola.debug("Refreshing Copilot token")
    try {
      const { token } = await getCopilotToken()
      state.copilotToken = token
      consola.debug("Copilot token refreshed")
      if (state.showToken) {
        consola.info("Refreshed Copilot token:", token)
      }
    } catch (error) {
      consola.error("Failed to refresh Copilot token:", error)
      throw error
    }
  }, refreshInterval)
}

interface SetupGitHubTokenOptions {
  force?: boolean
}

export async function setupGitHubToken(
  options?: SetupGitHubTokenOptions,
): Promise<void> {
  try {
    const githubToken = await readGithubToken()

    if (githubToken && !options?.force) {
      state.githubToken = githubToken
      if (state.showToken) {
        consola.info("GitHub token:", githubToken)
      }
      await logUser()

      return
    }

    consola.info("Not logged in, getting new access token")
    const response = await getDeviceCode()
    consola.debug("Device code response:", response)

    consola.info(
      `Please enter the code "${response.user_code}" in ${response.verification_uri}`,
    )

    const token = await pollAccessToken(response)
    await writeGithubToken(token)
    state.githubToken = token

    if (state.showToken) {
      consola.info("GitHub token:", token)
    }
    await logUser()
  } catch (error) {
    if (error instanceof HTTPError) {
      consola.error("Failed to get GitHub token:", await error.response.json())
      throw error
    }

    consola.error("Failed to get GitHub token:", error)
    throw error
  }
}

async function logUser() {
  const user = await getGitHubUser()
  consola.info(`Logged in as ${user.login}`)
}
