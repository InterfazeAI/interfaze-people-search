import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

// readline handles terminal raw mode; muted output prevents credential echo.
// The key exists only in this process and the live test child's environment.
process.stdout.write("Interfaze API key (hidden input): ");
const muted = new Writable({
  write(_chunk, _encoding, done) {
    done();
  },
});
const prompt = createInterface({
  input: process.stdin,
  output: muted,
  terminal: !!process.stdin.isTTY,
});
const key = (await prompt.question("")).trim();
prompt.close();
process.stdout.write("\n");
if (!key || /\s/.test(key)) {
  process.stderr.write("A non-empty API key without spaces is required.\n");
  process.exit(1);
}
const child = spawn("pnpm", ["exec", "vitest", "run", "tests/live.test.ts"], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, INTERFAZE_LIVE_KEY: key },
});
child.on("error", () => {
  process.stderr.write(
    "Could not start pnpm. Install project dependencies first.\n",
  );
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
