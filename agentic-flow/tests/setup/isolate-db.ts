/**
 * Per-test-file database isolation.
 *
 * SharedMemoryPool defaults to ~/.agentic-flow/reasoningbank.db — one database
 * shared by every run on the machine. Tests that assert on an empty store
 * ("a task never seen before returns no patterns") therefore passed only on a
 * machine that had never run them before, and polluted the developer's real
 * store on the way through.
 *
 * Vitest runs each test file in its own worker, so pointing the pool at a
 * unique temp path here gives every file a clean database and leaves the
 * user's own store alone.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';


const dir = mkdtempSync(join(tmpdir(), 'agentic-flow-test-'));
process.env.AGENTIC_FLOW_DB_PATH = join(dir, 'reasoningbank.db');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
