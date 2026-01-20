// Quick test to verify token parsing logic
const testCases = [
    // Comma-separated
    { input: "token1,token2,token3", expected: ["token1", "token2", "token3"] },

    // Newline-separated
    { input: "token1\ntoken2\ntoken3", expected: ["token1", "token2", "token3"] },

    // Mixed with whitespace
    { input: "  token1 ,  token2  \n  token3  ", expected: ["token1", "token2", "token3"] },

    // With comments
    { input: "token1\n# comment\ntoken2\ntoken3", expected: ["token1", "token2", "token3"] },

    // With empty lines
    { input: "token1\n\n\ntoken2\n\ntoken3", expected: ["token1", "token2", "token3"] },

    // Multi-line with quotes (simulating .env format)
    { input: "\ntoken1\ntoken2\ntoken3\n", expected: ["token1", "token2", "token3"] },

    // Single token
    { input: "single_token", expected: ["single_token"] },
];

function parseTokens(tokenSource: string): string[] {
    return tokenSource
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !t.startsWith("#"));
}

let passed = 0;
let failed = 0;

for (const { input, expected } of testCases) {
    const result = parseTokens(input);
    const match = JSON.stringify(result) === JSON.stringify(expected);

    if (match) {
        console.log(`✓ PASS: "${input.replace(/\n/g, '\\n').substring(0, 40)}..."`);
        passed++;
    } else {
        console.log(`✗ FAIL: "${input.replace(/\n/g, '\\n').substring(0, 40)}..."`);
        console.log(`  Expected: ${JSON.stringify(expected)}`);
        console.log(`  Got:      ${JSON.stringify(result)}`);
        failed++;
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
