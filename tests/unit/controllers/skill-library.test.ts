/**
 * SkillLibraryController - Unit Tests (TDD London School)
 *
 * Tests the skill storage, evolution, and composition system
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SkillLibraryController } from '../../../src/controllers/skill-library';
import type { AgentDBWrapper } from '../../../src/types/agentdb';

const createMockAgentDB = (): AgentDBWrapper => ({
  insert: vi.fn().mockResolvedValue({ id: 'skill-1', success: true }),
  vectorSearch: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue({ success: true }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  query: vi.fn().mockResolvedValue([]),
  embed: vi.fn().mockResolvedValue(new Float32Array(384)),
  stats: vi.fn().mockResolvedValue({ totalVectors: 0, dimensions: 384 }),
  clearCache: vi.fn()
});

describe('SkillLibraryController', () => {
  let mockAgentDB: AgentDBWrapper;
  let controller: SkillLibraryController;

  beforeEach(() => {
    mockAgentDB = createMockAgentDB();
    controller = new SkillLibraryController(mockAgentDB);
  });

  describe('addSkill', () => {
    it('should add new skill with metadata', async () => {
      const skill = {
        id: 'input-validation',
        name: 'User Input Validation',
        description: 'Validate and sanitize user input',
        category: 'security',
        code: 'function validate(input) { return true; }',
        version: '1.0.0',
        tags: ['validation', 'security']
      };

      await controller.addSkill(skill);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('User Input Validation'),
          metadata: expect.objectContaining({
            skillId: 'input-validation',
            name: 'User Input Validation',
            category: 'security',
            version: '1.0.0',
            type: 'skill'
          })
        })
      );
    });

    it('should store code and test cases', async () => {
      const skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test description',
        code: 'function test() { return true; }',
        testCases: [
          { input: 'test', expected: true }
        ],
        version: '1.0.0'
      };

      await controller.addSkill(skill);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            code: 'function test() { return true; }',
            testCases: expect.arrayContaining([
              expect.objectContaining({ input: 'test', expected: true })
            ])
          })
        })
      );
    });

    it('should handle dependencies', async () => {
      const skill = {
        id: 'composite-skill',
        name: 'Composite Skill',
        description: 'Uses other skills',
        code: 'function composite() {}',
        version: '1.0.0',
        dependencies: ['skill-1', 'skill-2']
      };

      await controller.addSkill(skill);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            dependencies: ['skill-1', 'skill-2']
          })
        })
      );
    });
  });

  describe('getSkill', () => {
    it('should retrieve skill by ID', async () => {
      const mockResult = {
        id: 'skill-1',
        content: 'Input Validation',
        metadata: {
          skillId: 'input-validation',
          name: 'Input Validation',
          description: 'Validates input',
          code: 'function validate() {}',
          version: '1.0.0',
          successRate: 0.95,
          usageCount: 47
        }
      };

      (mockAgentDB.query as Mock).mockResolvedValue([mockResult]);

      const skill = await controller.getSkill('input-validation');

      expect(skill).toBeDefined();
      expect(skill?.id).toBe('input-validation');
      expect(skill?.successRate).toBe(0.95);
    });

    it('should return null for non-existent skill', async () => {
      (mockAgentDB.query as Mock).mockResolvedValue([]);

      const skill = await controller.getSkill('non-existent');

      expect(skill).toBeNull();
    });
  });

  describe('recordSkillUsage', () => {
    it('should track skill execution success', async () => {
      const usage = {
        skillId: 'input-validation',
        taskId: 'form-submission',
        success: true,
        executionTimeMs: 2,
        feedback: 'Correctly validated email'
      };

      // recordSkillUsage updates an existing skill's statistics, so the skill
      // has to exist -- otherwise the controller correctly returns without
      // writing. The sibling test below sets its fixture up the same way.
      (mockAgentDB.query as Mock).mockResolvedValue([
        {
          metadata: {
            skillId: 'input-validation',
            type: 'skill',
            version: '1.0.0',
            successRate: 0.8,
            usageCount: 4
          }
        }
      ]);

      await controller.recordSkillUsage(usage);

      expect(mockAgentDB.update).toHaveBeenCalled();
    });

    it('should update success rate based on outcomes', async () => {
      const mockSkill = {
        metadata: {
          successRate: 0.90,
          usageCount: 10
        }
      };

      (mockAgentDB.query as Mock).mockResolvedValue([mockSkill]);

      await controller.recordSkillUsage({
        skillId: 'test-skill',
        success: true,
        executionTimeMs: 5
      });

      expect(mockAgentDB.update).toHaveBeenCalled();
    });
  });

  describe('evolveSkill', () => {
    it('should create new version of skill', async () => {
      const evolution = {
        skillId: 'input-validation',
        version: '1.1.0',
        changes: 'Added Unicode support',
        code: 'function validate(input) { /* new code */ }',
        testCases: [
          { input: 'user@übung.de', expected: true }
        ]
      };

      // The skill being evolved has to exist, and has to carry the version the
      // new one records as its parent.
      (mockAgentDB.query as Mock).mockResolvedValue([
        {
          metadata: {
            skillId: 'input-validation',
            type: 'skill',
            version: '1.0.0',
            name: 'Input validation',
            description: 'Validates user input',
            code: 'function validate(input) { /* old code */ }'
          }
        }
      ]);

      await controller.evolveSkill(evolution);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            version: '1.1.0',
            changes: 'Added Unicode support',
            parentVersion: expect.any(String)
          })
        })
      );
    });

    it('should link to previous version', async () => {
      const mockSkill = {
        metadata: {
          skillId: 'test-skill',
          version: '1.0.0'
        }
      };

      (mockAgentDB.query as Mock).mockResolvedValue([mockSkill]);

      await controller.evolveSkill({
        skillId: 'test-skill',
        version: '1.1.0',
        changes: 'Bug fixes',
        code: 'function test() {}'
      });

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parentVersion: '1.0.0'
          })
        })
      );
    });
  });

  describe('getSkillHistory', () => {
    it('should retrieve all versions of a skill', async () => {
      const mockVersions = [
        {
          metadata: {
            skillId: 'test-skill',
            version: '1.0.0',
            usageCount: 47,
            successRate: 0.94,
            changes: 'Initial implementation'
          }
        },
        {
          metadata: {
            skillId: 'test-skill',
            version: '1.1.0',
            usageCount: 23,
            successRate: 0.98,
            changes: 'Added Unicode support'
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockVersions);

      const history = await controller.getSkillHistory('test-skill');

      expect(history.length).toBe(2);
      expect(history[0].version).toBe('1.0.0');
      expect(history[1].version).toBe('1.1.0');
      expect(history[1].successRate).toBeGreaterThan(history[0].successRate);
    });
  });

  describe('composeSkill', () => {
    it('should create composite skill from components', async () => {
      const composition = {
        id: 'secure-form-handler',
        name: 'Secure Form Handler',
        description: 'Complete form handling pipeline',
        components: [
          { skillId: 'input-validation', order: 1 },
          { skillId: 'csrf-protection', order: 2 },
          { skillId: 'rate-limiting', order: 3 }
        ],
        compositionLogic: 'sequential' as const,
        version: '1.0.0'
      };

      await controller.composeSkill(composition);

      expect(mockAgentDB.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            isComposite: true,
            components: expect.arrayContaining([
              expect.objectContaining({ skillId: 'input-validation', order: 1 })
            ]),
            compositionLogic: 'sequential'
          })
        })
      );
    });
  });

  describe('recommendSkills', () => {
    it('should find relevant skills for task', async () => {
      const mockResults = [
        {
          id: 'skill-1',
          similarity: 0.95,
          metadata: {
            skillId: 'input-validation',
            name: 'Input Validation',
            successRate: 0.95,
            capabilities: ['email-validation']
          }
        },
        {
          id: 'skill-2',
          similarity: 0.88,
          metadata: {
            skillId: 'password-hashing',
            name: 'Password Hashing',
            successRate: 0.92,
            capabilities: ['password-hashing']
          }
        }
      ];

      (mockAgentDB.vectorSearch as Mock).mockResolvedValue(mockResults);
      (mockAgentDB.embed as Mock).mockResolvedValue(new Float32Array(384));

      const recommendations = await controller.recommendSkills({
        taskDescription: 'Build user registration form',
        requiredCapabilities: ['email-validation', 'password-hashing']
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('skillId');
      expect(recommendations[0]).toHaveProperty('relevance');
    });

    it('should rank by success rate and relevance', async () => {
      const mockResults = [
        {
          similarity: 0.90,
          metadata: { skillId: 'skill-1', successRate: 0.95 }
        },
        {
          similarity: 0.95,
          metadata: { skillId: 'skill-2', successRate: 0.85 }
        }
      ];

      (mockAgentDB.vectorSearch as Mock).mockResolvedValue(mockResults);

      const recommendations = await controller.recommendSkills({
        taskDescription: 'Test task'
      });

      // Should prioritize higher success rate despite slightly lower similarity
      expect(recommendations[0].skillId).toBe('skill-1');
    });
  });

  describe('searchSkills', () => {
    it('should search by tags', async () => {
      const mockResults = [
        {
          metadata: {
            skillId: 'skill-1',
            tags: ['security', 'validation'],
            successRate: 0.95
          }
        }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const skills = await controller.searchSkills({
        tags: ['security'],
        minSuccessRate: 0.8
      });

      expect(skills.length).toBeGreaterThan(0);
      expect(skills[0].tags).toContain('security');
    });

    it('should filter by minimum success rate', async () => {
      const mockResults = [
        { metadata: { skillId: 'skill-1', successRate: 0.95 } },
        { metadata: { skillId: 'skill-2', successRate: 0.70 } }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockResults);

      const skills = await controller.searchSkills({
        minSuccessRate: 0.8
      });

      expect(skills.every(s => s.successRate >= 0.8)).toBe(true);
    });
  });

  describe('integration with AgentDB v2', () => {
    it('should use vector search for skill discovery', async () => {
      await controller.recommendSkills({
        taskDescription: 'Test task'
      });

      expect(mockAgentDB.embed).toHaveBeenCalled();
      expect(mockAgentDB.vectorSearch).toHaveBeenCalled();
    });

    it('should track skill evolution over time', async () => {
      const mockHistory = [
        { metadata: { version: '1.0.0', timestamp: 1000 } },
        { metadata: { version: '1.1.0', timestamp: 2000 } },
        { metadata: { version: '1.2.0', timestamp: 3000 } }
      ];

      (mockAgentDB.query as Mock).mockResolvedValue(mockHistory);

      const history = await controller.getSkillHistory('test-skill');

      expect(history.length).toBe(3);
      expect(history.map(h => h.version)).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    });
  });
});
