/**
 * Memory Controllers - Integration Tests
 *
 * Tests the integration of all memory controllers with AgentDB v2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ReasoningBankController,
  ReflexionMemoryController,
  SkillLibraryController,
  CausalMemoryGraphController
} from '../../../src/controllers';
import type { AgentDBWrapper } from '../../../src/types/agentdb';

// Mock AgentDB implementation for integration tests
class MockAgentDB implements AgentDBWrapper {
  private documents: Map<string, any> = new Map();
  private nextId = 1;

  async insert(document: any): Promise<{ id: string; success: boolean }> {
    const id = `doc-${this.nextId++}`;
    this.documents.set(id, { ...document, id });
    return { id, success: true };
  }

  async vectorSearch(
    queryEmbedding: Float32Array,
    k: number,
    options?: any
  ): Promise<any[]> {
    const results: any[] = [];

    this.documents.forEach((doc, id) => {
      // Simple cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);

      if (!options?.filter || options.filter(doc.metadata)) {
        results.push({
          id,
          content: doc.content,
          similarity,
          metadata: doc.metadata,
          embedding: doc.embedding
        });
      }
    });

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  async update(options: any): Promise<{ success: boolean; count?: number }> {
    let count = 0;

    this.documents.forEach((doc) => {
      if (options.filter(doc.metadata)) {
        Object.assign(doc.metadata, options.updates);
        count++;
      }
    });

    return { success: true, count };
  }

  async delete(options: any): Promise<{ success: boolean; count?: number }> {
    let count = 0;
    const toDelete: string[] = [];

    this.documents.forEach((doc, id) => {
      if (options.filter(doc.metadata)) {
        toDelete.push(id);
        count++;
      }
    });

    toDelete.forEach(id => this.documents.delete(id));
    return { success: true, count };
  }

  async query(options: any): Promise<any[]> {
    const results: any[] = [];

    this.documents.forEach((doc) => {
      if (!options.filter || options.filter(doc.metadata)) {
        results.push(doc);
      }
    });

    return results;
  }

  async embed(text: string): Promise<Float32Array> {
    // Simple hash-based embedding for testing
    const arr = new Float32Array(384);
    for (let i = 0; i < text.length && i < 384; i++) {
      arr[i] = (text.charCodeAt(i) % 256) / 256;
    }
    return arr;
  }

  async stats(): Promise<any> {
    return {
      totalVectors: this.documents.size,
      dimensions: 384,
      indexType: 'mock'
    };
  }

  async clearCache(): Promise<void> {
    // Mock implementation
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

describe('Memory Controllers Integration', () => {
  let agentDB: AgentDBWrapper;
  let reasoningBank: ReasoningBankController;
  let reflexionMemory: ReflexionMemoryController;
  let skillLibrary: SkillLibraryController;
  let causalGraph: CausalMemoryGraphController;

  beforeAll(async () => {
    agentDB = new MockAgentDB();
    reasoningBank = new ReasoningBankController(agentDB);
    reflexionMemory = new ReflexionMemoryController(agentDB);
    skillLibrary = new SkillLibraryController(agentDB);
    causalGraph = new CausalMemoryGraphController(agentDB);
  });

  describe('ReasoningBank + ReflexionMemory Integration', () => {
    it('should store patterns and reflexions for complete learning cycle', async () => {
      // Store failed attempt in reflexion
      await reflexionMemory.storeReflexion({
        taskId: 'auth-impl-1',
        attempt: 1,
        action: 'Implemented JWT without expiration',
        observation: 'Security vulnerability detected',
        reflection: 'Must add token expiration',
        success: false,
        reward: 0.3
      });

      // Store successful pattern in reasoning bank
      await reasoningBank.storePattern({
        sessionId: 'auth-impl-2',
        task: 'JWT authentication with expiration',
        reward: 0.95,
        success: true,
        critique: 'Good implementation with proper security'
      });

      // Retrieve both for comparison
      const reflexions = await reflexionMemory.getReflexionsForTask('auth-impl');
      const patterns = await reasoningBank.searchPatterns('JWT authentication', 5);

      expect(reflexions.length).toBeGreaterThan(0);
      expect(patterns.length).toBeGreaterThan(0);

      // Should show improvement from reflexion to successful pattern
      const failedReflexion = reflexions.find(r => !r.success);
      const successfulPattern = patterns.find(p => p.success);

      expect(failedReflexion?.reward).toBeLessThan(successfulPattern?.reward || 0);
    });
  });

  describe('SkillLibrary + ReasoningBank Integration', () => {
    it('should evolve skills based on reasoning patterns', async () => {
      // Add initial skill
      await skillLibrary.addSkill({
        id: 'input-validation',
        name: 'Input Validation',
        description: 'Basic input validation',
        code: 'function validate(input) { return true; }',
        version: '1.0.0',
        tags: ['validation']
      });

      // Record usage pattern
      await reasoningBank.storePattern({
        sessionId: 'validation-1',
        task: 'Input validation needs Unicode support',
        reward: 0.7,
        success: true,
        critique: 'Works but doesn\'t handle international characters'
      });

      // Evolve skill based on feedback
      await skillLibrary.evolveSkill({
        skillId: 'input-validation',
        version: '1.1.0',
        changes: 'Added Unicode support based on pattern feedback',
        code: 'function validate(input) { /* with Unicode */ return true; }'
      });

      // Verify evolution
      const history = await skillLibrary.getSkillHistory('input-validation');
      expect(history.length).toBe(2);
      expect(history[1].version).toBe('1.1.0');
    });
  });

  describe('CausalGraph + ReasoningBank Integration', () => {
    it('should build causal explanations from reasoning patterns', async () => {
      // Store pattern with outcome
      await reasoningBank.storePattern({
        sessionId: 'caching-1',
        task: 'Add Redis caching',
        input: 'Slow database queries',
        output: 'Reduced response time by 60%',
        reward: 0.92,
        success: true
      });

      // Add causal relationship
      await causalGraph.addCausalEdge({
        cause: 'added-redis-caching',
        effect: 'reduced-response-time',
        confidence: 0.95,
        mechanism: 'Caching reduces database query load',
        evidence: ['pattern-caching-1']
      });

      // Query causal effects
      const effects = await causalGraph.forwardInference(
        'added-redis-caching',
        { maxDepth: 2, minConfidence: 0.8 }
      );

      expect(effects.length).toBeGreaterThan(0);
      expect(effects[0].effect).toBe('reduced-response-time');
      expect(effects[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Full Learning Cycle Integration', () => {
    it('should complete full learning cycle: Reflexion → Pattern → Skill → Causal', async () => {
      const taskId = 'complete-cycle-test';

      // 1. Failed attempt with reflexion
      await reflexionMemory.storeReflexion({
        taskId,
        attempt: 1,
        action: 'Implemented feature without tests',
        observation: 'Bugs in production',
        reflection: 'Must write tests before deployment',
        success: false,
        reward: 0.2
      });

      // 2. Successful retry, reflected on.
      //
      // The assertion at the end of this test is on getImprovementChain, which
      // is last attempt's reward minus the first's -- so it needs at least two
      // ATTEMPTS. Previously the cycle stored one failed reflexion and then a
      // successful *pattern*, which is a different store; the chain saw a
      // single attempt and correctly reported 0 improvement against an
      // expectation of > 0.5. The retry the narrative describes was never
      // actually written.
      await reflexionMemory.storeReflexion({
        taskId,
        attempt: 2,
        action: 'Wrote tests first, then implemented the feature',
        observation: 'Zero bugs in production',
        reflection: 'Writing tests first caught the regressions early',
        success: true,
        reward: 0.95
      });

      // 3. Successful attempt with pattern
      await reasoningBank.storePattern({
        sessionId: `${taskId}-success`,
        task: 'TDD implementation',
        input: 'Feature requirements',
        output: 'Zero bugs in production',
        reward: 0.98,
        success: true,
        critique: 'TDD prevented all issues'
      });

      // 4. Create reusable skill
      await skillLibrary.addSkill({
        id: 'tdd-workflow',
        name: 'TDD Workflow',
        description: 'Test-driven development workflow',
        code: 'function tdd() { writeTest(); writeCode(); refactor(); }',
        version: '1.0.0',
        tags: ['testing', 'tdd']
      });

      // 5. Establish causal relationship
      await causalGraph.addCausalEdge({
        cause: 'tdd-workflow',
        effect: 'zero-production-bugs',
        confidence: 0.98,
        mechanism: 'Tests catch bugs before deployment',
        evidence: [`${taskId}-success`]
      });

      // Verify complete cycle
      const reflexions = await reflexionMemory.getReflexionsForTask(taskId);
      const patterns = await reasoningBank.searchPatterns('TDD implementation', 5);
      const skill = await skillLibrary.getSkill('tdd-workflow');
      const effects = await causalGraph.forwardInference('tdd-workflow', {
        maxDepth: 2
      });

      expect(reflexions.length).toBeGreaterThan(0);
      expect(patterns.length).toBeGreaterThan(0);
      expect(skill).toBeDefined();
      expect(effects.length).toBeGreaterThan(0);

      // Verify learning improvement
      const improvementChain = await reflexionMemory.getImprovementChain(taskId);
      expect(improvementChain.totalImprovement).toBeGreaterThan(0.5);
    });
  });

  describe('Cross-Controller Recommendations', () => {
    it('should provide comprehensive recommendations using all controllers', async () => {
      const taskDescription = 'Build secure API with authentication';

      // Search all controllers
      const [patterns, skills, reflexions] = await Promise.all([
        reasoningBank.searchPatterns(taskDescription, 3),
        skillLibrary.recommendSkills({ taskDescription }),
        reflexionMemory.getReflexionsForTask('auth')
      ]);

      // Should get relevant data from multiple sources
      expect(patterns.length + skills.length + reflexions.length).toBeGreaterThan(0);

      // Get causal predictions for proposed approach
      if (patterns.length > 0) {
        const approach = patterns[0].task;
        const stats = await reasoningBank.getPatternStats(approach, 5);
        expect(stats).toBeDefined();
      }
    });
  });
});
