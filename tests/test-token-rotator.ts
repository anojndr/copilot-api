// Test TokenRotator class
import { TokenRotator } from "../src/lib/token-rotator";

console.log("Testing TokenRotator class...\n");

// Test 1: Basic initialization
console.log("Test 1: Basic initialization");
const rotator = new TokenRotator({ tokens: ["token1", "token2", "token3"] });
console.log(`  Current token: ${rotator.getCurrentToken()}`);
console.log(`  Total count: ${rotator.getTotalCount()}`);
console.log(`  Available count: ${rotator.getAvailableCount()}`);
console.assert(rotator.getCurrentToken() === "token1", "Should start with first token");
console.assert(rotator.getTotalCount() === 3, "Should have 3 tokens");
console.log("  ✓ PASS\n");

// Test 2: Rotation
console.log("Test 2: Rotation");
rotator.rotate();
console.log(`  After rotate: ${rotator.getCurrentToken()}`);
console.assert(rotator.getCurrentToken() === "token2", "Should be on second token");
rotator.rotate();
console.log(`  After rotate: ${rotator.getCurrentToken()}`);
console.assert(rotator.getCurrentToken() === "token3", "Should be on third token");
rotator.rotate();
console.log(`  After rotate (wrap): ${rotator.getCurrentToken()}`);
console.assert(rotator.getCurrentToken() === "token1", "Should wrap to first token");
console.log("  ✓ PASS\n");

// Test 3: Mark bad and rotate
console.log("Test 3: Mark current bad");
const rotator2 = new TokenRotator({ tokens: ["bad1", "good2", "good3"] });
console.log(`  Current: ${rotator2.getCurrentToken()}`);
rotator2.markCurrentBad();
console.log(`  After mark bad: ${rotator2.getCurrentToken()}`);
console.assert(rotator2.getCurrentToken() === "good2", "Should rotate to next good token");
console.log(`  Available count: ${rotator2.getAvailableCount()}`);
console.assert(rotator2.getAvailableCount() === 2, "Should have 2 available tokens");
console.log("  ✓ PASS\n");

// Test 4: All tokens bad
console.log("Test 4: All tokens become bad");
const rotator3 = new TokenRotator({ tokens: ["a", "b"] });
rotator3.markCurrentBad();
console.log(`  After first bad: ${rotator3.getCurrentToken()}, available: ${rotator3.getAvailableCount()}`);
const result = rotator3.markCurrentBad();
console.log(`  After second bad - hasGood: ${result}`);
console.assert(result === false, "Should return false when all tokens are bad");
console.assert(rotator3.hasGoodTokens() === false, "hasGoodTokens should be false");
console.log("  ✓ PASS\n");

// Test 5: Copilot token storage
console.log("Test 5: Copilot token storage per GitHub token");
const rotator4 = new TokenRotator({ tokens: ["gh1", "gh2"] });
rotator4.setCopilotToken("copilot1", Date.now() + 60000);
console.log(`  Token 1 copilot: ${rotator4.getCurrentCopilotToken()}`);
rotator4.rotate();
console.log(`  Token 2 copilot (undefined): ${rotator4.getCurrentCopilotToken()}`);
rotator4.setCopilotToken("copilot2", Date.now() + 60000);
console.log(`  Token 2 copilot (set): ${rotator4.getCurrentCopilotToken()}`);
rotator4.rotate();
console.log(`  Back to token 1 copilot: ${rotator4.getCurrentCopilotToken()}`);
console.assert(rotator4.getCurrentCopilotToken() === "copilot1", "Should retain copilot token per GitHub token");
console.log("  ✓ PASS\n");

// Test 6: Reset all
console.log("Test 6: Reset all tokens");
const rotator5 = new TokenRotator({ tokens: ["x", "y", "z"] });
rotator5.markCurrentBad();
rotator5.markCurrentBad();
console.log(`  Before reset - available: ${rotator5.getAvailableCount()}`);
rotator5.resetAll();
console.log(`  After reset - available: ${rotator5.getAvailableCount()}`);
console.assert(rotator5.getAvailableCount() === 3, "All tokens should be available after reset");
console.log("  ✓ PASS\n");

console.log("All tests passed!");
