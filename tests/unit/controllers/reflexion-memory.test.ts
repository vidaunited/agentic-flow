/**
 * ReflexionMemoryController - Unit Tests (TDD London School)
 *
 * Tests the reflexion memory system for learning from failures
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ReflexionMemoryController } from '../../../src/controllers/reflexion-memory';
import type { AgentDBWrapper } from '../../../src/types/agentdb';

const createMockAgentDB = (): AgentDBWrapper => ({
  insert: vi.fn().mockResolvedValue({ id: 'reflexion-1', success: true }),
  vectorSearch: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue({ success: true }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  query: vi.fn().mockResolvedValue([]),
  embed: vi.fn().mockResolvedValue(new Float32Array(384)),
  stats: vi.fn().mockResolvedValue({ totalVectors: 0, dimensions: 384 }),
  clearCache: vi.fn()
});

describe('ReflexionMemoryController', () => {
  let mockAgentDB: AgentDBWrapper;
  let controller: ReflexionMemoryController;

  beforeEach(() => {
    mockAgentDB = createMockAgentDB();
    controller = new ReflexionMemoryController(mockAgentDB);
  });

  describe('storeReflexion', () => {
    it('should store failed attempt with self-critique', async () => {
      const reflexion = {
        taskId: 'auth-implementation',
        attempt: 1,
        action: 'Implemented JWT authentication',
        observation: 'Security vulnerability: tokens never expire',
        reflection: 'I failed to implement token expiration. Next time: 1) Add expiration, 2) Add refresh tokens',
        success: false,
        reward: 0.3
      };

      await controller.storeReflexion(reflexion);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('JWT authentication'),
          metadata: expect.objectContaining({
            taskId: 'auth-implementation',
            attempt: 1,
            success: false,
            reward: 0.3,
            type: 'reflexion'
          })
        })
      );
    });

    it('should store successful attempt after learning', async () => {
      const reflexion = {
        taskId: 'auth-implementation',
        attempt: 2,
        action: 'Implemented JWT with expiration and refresh tokens',
        observation: 'All security tests passing',
        reflection: 'Success! By learning from previous mistake, I added expiration',
        success: true,
        reward: 1.0
      };

      await controller.storeReflexion(reflexion);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            success: true,
            reward: 1.0,
            attempt: 2
          })
        })
      );
    });

    it('should generate embedding from action and reflection', async () => {
      const reflexion = {
        taskId: 'task-1',
        attempt: 1,
        action: 'Test action',
        reflection: 'Test reflection',
        success: false,
        reward: 0.5
      };

      (mockAgentDB.embed as Mock).mockResolvedValue(new Float32Array(384).fill(0.5));

      await controller.storeReflexion(reflexion);

      expect(mockAgentDB.embed).toHaveBeenCalledWith(
        expect.stringContaining('Test action')
      );
      expect(mockAgentDB.embed).toHaveBeenCalledWith(
        expect.stringContaining('Test reflection')
      );
    });
  });

  describe('getReflexionsForTask', () => {
    it('should retrieve reflexions for similar tasks', async () => {
      const mockResults = [
        {
          id: 'reflexion-1',
          content: 'JWT auth implementation',
          similarity: 0.92,
          metadata: {
            taskId: 'auth-impl-1',
            attempt: 1,
            action: 'Implemented JWT',
            observation: 'Missing expiration',
            reflection: 'Add token expiration',
            success: false,
            reward: 0.3
          }
        },
        {
          id: 'reflexion-2',
          similarity: 0.88,
          metadata: {
            taskId: 'auth-impl-2',
            attempt: 2,
            action: 'JWT with expiration',
            observation: 'Tests pass',
            reflection: 'Success after learning',
            success: true,
            reward: 1.0
          }
        }
      ];

      (mockAgentDB.vectorSearch as Mock).mockResolvedValue(mockResults);
      (mockAgentDB.embed as Mock).mockResolvedValue(new Float32Array(384));

      const reflexions = await controller.getReflexionsForTask('auth-implementation');

      expect(reflexions.length).toBeGreaterThan(0);
      expect(reflexions[0]).toHaveProperty('reflection');
    });
  });

  describe('findErrorPatterns', () => {
    it('should identify recurring error patterns', async () => {
      const mockResults = [
        {
          metadata: {
            taskId: 'task-1',
            reflection: 'Forgot to validate user input',
            success: false,
            reward: 0.2,
            category: 'validation'
          }
        },
        {
          metadata: {
            taskId: 'task-2',
            reflection: 'Forgot to validate user input',
            success: false,
            reward: 0.15,
            category: 'validation'
          }
        },
        {
          metadata: {
            taskId: 'task-3',
            reflection: 'Forgot to validate user input',
            success: false,
            reward: 0.25,
            category: 'validation'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const patterns = await controller.findErrorPatterns({
        minOccurrences: 3,
        timeWindow: '30d'
      });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('pattern');
      expect(patterns[0]).toHaveProperty('occurrences');
      expect(patterns[0].occurrences).toBeGreaterThanOrEqual(3);
    });

    it('should filter by category when provided', async () => {
      (mockAgentDB.query as Mock).mockResolvedValue([
        {
          metadata: {
            reflection: 'Security issue',
            success: false,
            category: 'security'
          }
        }
      ]);

      await controller.findErrorPatterns({
        minOccurrences: 1,
        category: 'security'
      });

      expect(mockAgentDB.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.any(Function)
        })
      );
    });
  });

  describe('getImprovementChain', () => {
    it('should track improvement over multiple attempts', async () => {
      const mockResults = [
        {
          metadata: {
            taskId: 'auth-impl',
            attempt: 1,
            reward: 0.3,
            success: false,
            observation: 'No token expiration'
          }
        },
        {
          metadata: {
            taskId: 'auth-impl',
            attempt: 2,
            reward: 1.0,
            success: true,
            observation: 'All tests passed'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const chain = await controller.getImprovementChain('auth-impl');

      expect(chain).toHaveProperty('attempts');
      expect(chain).toHaveProperty('totalImprovement');
      expect(chain.totalImprovement).toBeGreaterThan(0);
      expect(chain.attempts.length).toBe(2);
    });

    it('should calculate improvement metrics correctly', async () => {
      const mockResults = [
        { metadata: { attempt: 1, reward: 0.2, success: false } },
        { metadata: { attempt: 2, reward: 0.5, success: false } },
        { metadata: { attempt: 3, reward: 0.9, success: true } }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const chain = await controller.getImprovementChain('task-1');

      expect(chain.totalImprovement).toBeCloseTo(0.7, 1);
      expect(chain.attemptsNeeded).toBe(3);
    });
  });

  describe('shareReflexion', () => {
    it('should share successful reflexions across agents', async () => {
      const shareRequest = {
        reflexionId: 'reflexion-1',
        targetAgents: ['agent-2', 'agent-3'],
        shareLevel: 'successful-only' as const
      };

      // The reflexion being shared has to exist; without this the controller
      // correctly finds nothing and returns before inserting anything. The
      // sibling test below ('should not share if reflexion is unsuccessful')
      // already sets its fixture up this way.
      (mockAgentDB.query as Mock).mockResolvedValue([
        {
          content: 'Reflection: write tests first',
          embedding: new Float32Array(384),
          metadata: {
            id: 'reflexion-1',
            type: 'reflexion',
            taskId: 'task-1',
            success: true,
            reward: 0.9
          }
        }
      ]);

      await controller.shareReflexion(shareRequest);

      expect(mockAgentDB.insert).toHaveBeenCalledTimes(2);
      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            sharedFrom: 'reflexion-1',
            targetAgent: expect.stringMatching(/agent-[23]/)
          })
        })
      );
    });

    it('should not share if reflexion is unsuccessful and level is successful-only', async () => {
      const mockReflexion = {
        metadata: { success: false }
      };

      (mockAgentDB.query as Mock).mockResolvedValue([mockReflexion]);

      await controller.shareReflexion({
        reflexionId: 'reflexion-1',
        targetAgents: ['agent-2'],
        shareLevel: 'successful-only'
      });

      expect(mockAgentDB.insert).not.toHaveBeenCalled();
    });
  });

  describe('getSharedReflexions', () => {
    it('should query shared reflexions from specific agents', async () => {
      const mockResults = [
        {
          metadata: {
            taskCategory: 'authentication',
            reward: 0.95,
            sharedFrom: 'experienced-agent-1',
            success: true
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const shared = await controller.getSharedReflexions({
        taskCategory: 'authentication',
        minReward: 0.8,
        fromAgents: ['experienced-agent-1']
      });

      expect(shared.length).toBeGreaterThan(0);
      expect(shared[0].reward).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('integration with AgentDB v2', () => {
    it('should leverage vector search for similar task matching', async () => {
      await controller.getReflexionsForTask('test-task');

      expect(mockAgentDB.embed).toHaveBeenCalled();
      expect(mockAgentDB.vectorSearch).toHaveBeenCalled();
    });

    it('should use query for structured filtering', async () => {
      await controller.findErrorPatterns({ minOccurrences: 2 });

      expect(mockAgentDB.query).toHaveBeenCalled();
    });
  });
});
