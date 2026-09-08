/**
 * Split from backwards-compatibility.test.ts.
 *
 * These cases open real better-sqlite3 databases and an ONNX embedder. Run in
 * the same worker as the package-import cases, that combination aborts the
 * process at exit (SIGABRT, rc=134) even though every test passes — a native
 * teardown fault in the agentdb / transformers.js / better-sqlite3 stack, not a
 * test failure. Vitest isolates per FILE, so keeping the two groups in separate
 * files gives each its own worker and the abort does not occur.
 */
/**
 * Backwards Compatibility Test Suite
 *
 * Ensures all existing code continues to work after AgentDB integration
 *
 * Tests:
 * 1. Import paths (both old and new work)
 * 2. API signatures (methods accept same parameters)
 * 3. Return types (return same data structures)
 * 4. CLI commands (all commands still work)
 * 5. Memory operations (produce same results)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applySharedMemorySchema } from '../src/memory/index.js';
import * as fs from 'fs';
import * as path from 'path';

// agentdb's EmbeddingService loads a fresh Transformers.js/ONNX session per
// instance (the cached variant in src/agentdb/controllers is not the one this
// barrel exports). Four sessions plus several better-sqlite3 handles in one
// worker aborted the process at teardown — SIGABRT, rc=134, after every test
// had passed. Share a single embedder across the suite.
let sharedEmbedder: any;
const getEmbedder = async () => {
  if (!sharedEmbedder) {
    // Reuse the pool's embedder rather than constructing a second one: the
    // HybridReasoningBank tests initialise the pool anyway, so borrowing it
    // keeps the whole file down to a single ONNX session.
    const { SharedMemoryPool } = await import('../src/memory/index.js');
    const pool = SharedMemoryPool.getInstance();
    await pool.ensureInitialized();
    sharedEmbedder = pool.getEmbedder();
  }
  return sharedEmbedder;
};

describe('Backwards Compatibility - API Signatures', () => {
  let testDbPath: string;


  beforeAll(() => {
    testDbPath = path.join(process.cwd(), 'test-compat.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(async () => {
    // Release the pool's database handle and ONNX embedder rather than leaving
    // them live at worker exit.
    const { SharedMemoryPool } = await import('../src/memory/index.js');
    SharedMemoryPool.reset();

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should maintain ReflexionMemory API', async () => {
    const Database = (await import('better-sqlite3')).default;
    const { ReflexionMemory } = await import('../src/agentdb/index.js');

    const db = new Database(testDbPath);
    // A raw handle has no tables: ReflexionMemory expects the shared schema.
    applySharedMemorySchema(db);
    const embedder = await getEmbedder();
    const reflexion = new ReflexionMemory(db, embedder);

    // Test old API signature
    const episodeId = await reflexion.storeEpisode({
      sessionId: 'test-session',
      task: 'test task',
      input: 'input data',
      output: 'output data',
      critique: 'test critique',
      reward: 0.85,
      success: true,
      latencyMs: 100,
      tokensUsed: 50
    });

    expect(episodeId).toBeGreaterThan(0);

    // Test retrieval
    const results = await reflexion.retrieveRelevant({
      task: 'test',
      k: 5
    });

    expect(Array.isArray(results)).toBe(true);

    db.close();
  });

  it('should maintain HybridReasoningBank API', async () => {
    const { HybridReasoningBank } = await import('../src/reasoningbank/HybridBackend.js');
    const { SharedMemoryPool } = await import('../src/memory/index.js');

    // NOTE: no SharedMemoryPool.reset() here. Tearing the pool down mid-run
    // closes a live better-sqlite3 handle and an ONNX session and then opens
    // fresh ones; doing that repeatedly in one worker aborted the process at
    // exit (SIGABRT / rc=134) after every test had passed. Each test file
    // already gets its own database via tests/setup/isolate-db.ts.

    const rb = new HybridReasoningBank({ preferWasm: false });

    // Test pattern storage
    const patternId = await rb.storePattern({
      sessionId: 'test-hybrid',
      task: 'test hybrid task',
      success: true,
      reward: 0.9
    });

    expect(patternId).toBeGreaterThan(0);

    // Test pattern retrieval
    const patterns = await rb.retrievePatterns('test', { k: 5 });
    expect(Array.isArray(patterns)).toBe(true);

    SharedMemoryPool.getInstance().close();
  });
});

describe('Backwards Compatibility - Memory Operations', () => {
  it('should produce consistent results between old and new APIs', async () => {
    const Database = (await import('better-sqlite3')).default;
    const { EmbeddingService, ReflexionMemory } = await import('../src/agentdb/index.js');
    const { HybridReasoningBank } = await import('../src/reasoningbank/HybridBackend.js');
    const { SharedMemoryPool } = await import('../src/memory/index.js');

    const testDbPath1 = path.join(process.cwd(), 'test-old.db');
    const testDbPath2 = path.join(process.cwd(), 'test-new.db');

    // Clean up
    [testDbPath1, testDbPath2].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    try {
      // Old API
      const db1 = new Database(testDbPath1);
      applySharedMemorySchema(db1);
      const embedder1 = await getEmbedder();
      const reflexion = new ReflexionMemory(db1, embedder1);

      await reflexion.storeEpisode({
        sessionId: 'test',
        task: 'authentication',
        input: '',
        output: '',
        critique: 'test',
        reward: 0.85,
        success: true,
        latencyMs: 0,
        tokensUsed: 0
      });

      const oldResults = await reflexion.retrieveRelevant({
        task: 'auth',
        k: 5
      });

      // New API — reuse the already-initialised pool rather than resetting it
      // onto a second path (see the note above; the reset is what aborted the
      // worker, and this assertion is about API shape, not storage location).
      const pool = SharedMemoryPool.getInstance();
      await pool.ensureInitialized();

      const rb = new HybridReasoningBank({ preferWasm: false });
      await rb.storePattern({
        sessionId: 'test',
        task: 'authentication',
        success: true,
        reward: 0.85
      });

      const newResults = await rb.retrievePatterns('auth', { k: 5 });

      // Both should return arrays with at least one result
      expect(oldResults.length).toBeGreaterThan(0);
      expect(newResults.length).toBeGreaterThan(0);

      // Both should have similar structure
      expect(oldResults[0]).toHaveProperty('task');
      expect(newResults[0]).toHaveProperty('task');

      db1.close();
      pool.close();
    } finally {
      [testDbPath1, testDbPath2].forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }
  });
});
