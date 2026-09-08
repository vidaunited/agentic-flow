/**
 * Public surface for the shared memory pool.
 *
 * Mirrors the barrel that every sibling module (src/reasoningbank, src/router,
 * …) already exposes, so `import { SharedMemoryPool } from '../src/memory'`
 * resolves the same way as its neighbours.
 */
export { SharedMemoryPool, applySharedMemorySchema } from './SharedMemoryPool.js';
export type {
  SharedMemoryPoolOptions,
  SharedMemoryPoolStats,
} from './SharedMemoryPool.js';
