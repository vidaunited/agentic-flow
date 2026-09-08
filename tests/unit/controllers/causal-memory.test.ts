/**
 * CausalMemoryGraphController - Unit Tests (TDD London School)
 *
 * Tests the causal reasoning graph system
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { CausalMemoryGraphController } from '../../../src/controllers/causal-memory';
import type { AgentDBWrapper } from '../../../src/types/agentdb';

const createMockAgentDB = (): AgentDBWrapper => ({
  insert: vi.fn().mockResolvedValue({ id: 'causal-1', success: true }),
  vectorSearch: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue({ success: true }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  query: vi.fn().mockResolvedValue([]),
  embed: vi.fn().mockResolvedValue(new Float32Array(384)),
  stats: vi.fn().mockResolvedValue({ totalVectors: 0, dimensions: 384 }),
  clearCache: vi.fn()
});

describe('CausalMemoryGraphController', () => {
  let mockAgentDB: AgentDBWrapper;
  let controller: CausalMemoryGraphController;

  beforeEach(() => {
    mockAgentDB = createMockAgentDB();
    controller = new CausalMemoryGraphController(mockAgentDB);
  });

  describe('addCausalEdge', () => {
    it('should add causal relationship with confidence', async () => {
      const edge = {
        cause: 'memory-id-123',
        effect: 'memory-id-456',
        confidence: 0.95,
        mechanism: 'Added error handling to auth module',
        evidence: ['test-results-id', 'metrics-id'],
        strength: 0.8
      };

      await controller.addCausalEdge(edge);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Added error handling'),
          metadata: expect.objectContaining({
            cause: 'memory-id-123',
            effect: 'memory-id-456',
            confidence: 0.95,
            strength: 0.8,
            type: 'causal_edge'
          })
        })
      );
    });

    it('should store evidence for causal relationship', async () => {
      const edge = {
        cause: 'action-1',
        effect: 'result-1',
        confidence: 0.9,
        mechanism: 'Caching reduced query time',
        evidence: ['benchmark-1', 'metrics-1']
      };

      await controller.addCausalEdge(edge);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            evidence: ['benchmark-1', 'metrics-1']
          })
        })
      );
    });
  });

  describe('getEffects', () => {
    it('should query effects of a cause', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'memory-id-123',
            effect: 'memory-id-456',
            confidence: 0.95,
            mechanism: 'Added caching'
          }
        },
        {
          metadata: {
            cause: 'memory-id-123',
            effect: 'memory-id-789',
            confidence: 0.88,
            mechanism: 'Reduced latency'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const effects = await controller.getEffects('memory-id-123', {
        maxDepth: 3,
        minConfidence: 0.7
      });

      expect(effects.length).toBeGreaterThan(0);
      expect(effects.every(e => e.confidence >= 0.7)).toBe(true);
    });

    it('should apply minConfidence to the decayed confidence of a multi-hop path', async () => {
      // Two edges that each clear the floor on their own, but whose combined
      // path does not: 0.8 * 0.8 = 0.64 against a floor of 0.7.
      //
      // minConfidence used to be applied only to the raw edge as it came out
      // of the query, never to the composite confidence computed during
      // traversal, so this path was returned to a caller who had explicitly
      // asked not to see anything below 0.7.
      const mockResults = [
        { metadata: { cause: 'a', effect: 'b', confidence: 0.8 } },
        { metadata: { cause: 'b', effect: 'c', confidence: 0.8 } }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const effects = await controller.getEffects('a', {
        maxDepth: 3,
        minConfidence: 0.7
      });

      // The direct edge survives; the 0.64 two-hop path does not.
      expect(effects.map(e => e.effect)).toContain('b');
      expect(effects.map(e => e.effect)).not.toContain('c');
      expect(effects.every(e => e.confidence >= 0.7)).toBe(true);
    });

    it('should traverse multi-level effects', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'a',
            effect: 'b',
            confidence: 0.9
          }
        },
        {
          metadata: {
            cause: 'b',
            effect: 'c',
            confidence: 0.85
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const effects = await controller.getEffects('a', { maxDepth: 2 });

      // Should include both direct (b) and indirect (c) effects
      expect(effects.length).toBeGreaterThan(0);
    });
  });

  describe('getRootCauses', () => {
    it('should find root causes for an effect', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'root-1',
            effect: 'intermediate-1',
            confidence: 0.9
          }
        },
        {
          metadata: {
            cause: 'intermediate-1',
            effect: 'final-effect',
            confidence: 0.85
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const rootCauses = await controller.getRootCauses('final-effect', {
        maxDepth: 5,
        minConfidence: 0.8
      });

      expect(rootCauses.length).toBeGreaterThan(0);
    });
  });

  describe('computeCausalStrength', () => {
    it('should calculate total causal strength across all paths', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'a',
            effect: 'b',
            strength: 0.9,
            confidence: 0.95
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const strength = await controller.computeCausalStrength({
        cause: 'a',
        effect: 'b'
      });

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1.0);
    });

    it('should combine multiple paths with decay', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'a',
            effect: 'b',
            strength: 0.8,
            confidence: 0.9
          }
        },
        {
          metadata: {
            cause: 'b',
            effect: 'c',
            strength: 0.7,
            confidence: 0.85
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const strength = await controller.computeCausalStrength({
        cause: 'a',
        effect: 'c'
      });

      // Should be less than direct strength due to path length
      expect(strength).toBeLessThan(0.8);
    });
  });

  describe('findCommonCauses', () => {
    it('should identify confounding variables', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'common-cause',
            effect: 'effect-1',
            confidence: 0.9
          }
        },
        {
          metadata: {
            cause: 'common-cause',
            effect: 'effect-2',
            confidence: 0.85
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const commonCauses = await controller.findCommonCauses([
        'effect-1',
        'effect-2'
      ]);

      expect(commonCauses.length).toBeGreaterThan(0);
      expect(commonCauses[0]).toHaveProperty('cause');
    });
  });

  describe('detectCausalLoops', () => {
    it('should detect circular dependencies', async () => {
      const mockResults = [
        { metadata: { cause: 'a', effect: 'b' } },
        { metadata: { cause: 'b', effect: 'c' } },
        { metadata: { cause: 'c', effect: 'a' } } // Loop!
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const loops = await controller.detectCausalLoops();

      expect(loops.length).toBeGreaterThan(0);
    });
  });

  describe('exportGraph', () => {
    it('should export graph in specified format', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'a',
            effect: 'b',
            confidence: 0.9,
            mechanism: 'Test mechanism'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const graph = await controller.exportGraph({
        format: 'json',
        includeMetadata: true
      });

      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should highlight specific paths when requested', async () => {
      const mockResults = [
        { metadata: { cause: 'a', effect: 'b' } }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const graph = await controller.exportGraph({
        format: 'json',
        highlightPaths: [{ from: 'a', to: 'b' }]
      });

      expect(graph).toBeDefined();
    });
  });

  describe('forwardInference', () => {
    it('should predict likely effects of an action', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'action-1',
            effect: 'effect-1',
            confidence: 0.9,
            mechanism: 'Prediction mechanism'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const predictions = await controller.forwardInference('action-1', {
        maxDepth: 3,
        minConfidence: 0.7
      });

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0]).toHaveProperty('effect');
      expect(predictions[0]).toHaveProperty('confidence');
    });
  });

  describe('backwardInference', () => {
    it('should identify likely causes of an observation', async () => {
      const mockResults = [
        {
          metadata: {
            cause: 'cause-1',
            effect: 'observation-1',
            confidence: 0.85
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const causes = await controller.backwardInference('observation-1', {
        maxDepth: 5,
        minConfidence: 0.6
      });

      expect(causes.length).toBeGreaterThan(0);
      expect(causes[0]).toHaveProperty('cause');
    });
  });

  describe('integration with AgentDB v2', () => {
    it('should store causal relationships as graph edges', async () => {
      await controller.addCausalEdge({
        cause: 'a',
        effect: 'b',
        confidence: 0.9,
        mechanism: 'Test'
      });

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'causal_edge'
          })
        })
      );
    });

    it('should use query for graph traversal', async () => {
      await controller.getEffects('test-id', {});

      expect(mockAgentDB.query).toHaveBeenCalled();
    });
  });
});
