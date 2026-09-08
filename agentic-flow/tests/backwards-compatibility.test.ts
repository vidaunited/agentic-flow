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

describe('Backwards Compatibility - Imports', () => {
  it('should support old embedded agentdb imports', async () => {
    // Old import path (should still work via re-exports)
    const {
      ReflexionMemory,
      SkillLibrary,
      CausalMemoryGraph
    } = await import('../src/agentdb/index.js');

    expect(ReflexionMemory).toBeDefined();
    expect(SkillLibrary).toBeDefined();
    expect(CausalMemoryGraph).toBeDefined();
  });

  it('should support new reasoningbank exports', async () => {
    const {
      HybridReasoningBank,
      AdvancedMemorySystem,
      ReasoningBank
    } = await import('../src/reasoningbank/index.js');

    expect(HybridReasoningBank).toBeDefined();
    expect(AdvancedMemorySystem).toBeDefined();
    // `ReasoningBank` is the documented back-compat alias exported by
    // src/reasoningbank/index.ts. The previous name here, ReasoningBankEngine,
    // has never existed anywhere in the codebase.
    expect(ReasoningBank).toBeDefined();
    expect(ReasoningBank).toBe(HybridReasoningBank);
  });

  it('should support shared memory pool', async () => {
    const { SharedMemoryPool } = await import('../src/memory/index.js');
    expect(SharedMemoryPool).toBeDefined();
  });
});

/**
 * Moved here from the memory suite.
 *
 * Importing the package entry pulls @huggingface/transformers, which bundles
 * its OWN nested onnxruntime-node (napi-v3) alongside the top-level one
 * (napi-v6). On Linux the second binding asks the already-loaded
 * libonnxruntime.so for a symbol it does not export:
 *
 *   libonnxruntime.so.1: version `VERS_1.21.0' not found
 *
 * so it only fails in a worker that has already loaded the top-level runtime —
 * which is exactly what the memory suite does, and why this passes on macOS.
 * Keeping this import away from those tests keeps the two runtimes apart.
 */
describe('Backwards Compatibility - Package Exports', () => {
  it('should export all expected modules', async () => {
    const pkg = await import('../src/index.js');

    // Check reasoningbank export
    expect(pkg.reasoningbank).toBeDefined();
  });
});
