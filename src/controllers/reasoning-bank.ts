/**
 * ReasoningBankController - Pattern Storage and Retrieval with AgentDB v2
 *
 * Integrates with AgentDB v2 for high-performance pattern matching using:
 * - RuVector backend for 150x faster vector search
 * - ReasoningBank for meta-learning from past experiences
 * - Semantic search for finding similar successful patterns
 *
 * @example
 * ```typescript
 * const agentDB = new AgentDBWrapper(config);
 * const controller = new ReasoningBankController(agentDB);
 *
 * // Store a successful pattern
 * await controller.storePattern({
 *   sessionId: 'session-1',
 *   task: 'Build REST API with authentication',
 *   reward: 0.95,
 *   success: true,
 *   critique: 'Good implementation, consider rate limiting'
 * });
 *
 * // Search for similar patterns
 * const patterns = await controller.searchPatterns('Build REST API', 5);
 * ```
 */

import type { AgentDBWrapper } from '../types/agentdb';

export interface ReasoningPattern {
  sessionId: string;
  task: string;
  input?: string;
  output?: string;
  reward: number;
  success: boolean;
  critique?: string;
  tokensUsed?: number;
  latencyMs?: number;
  timestamp?: number;
  similarity?: number;
}

export interface PatternSearchOptions {
  minReward?: number;
  onlySuccesses?: boolean;
  onlyFailures?: boolean;
}

export interface PatternStats {
  totalAttempts: number;
  successRate: number;
  avgReward: number;
  recentPatterns: ReasoningPattern[];
  critiques: string[];
}

/**
 * ReasoningBankController
 *
 * Manages reasoning patterns with AgentDB v2 for semantic similarity search.
 * Enables agents to learn from past experiences and improve over time.
 */
export class ReasoningBankController {
  constructor(private agentDB: AgentDBWrapper) {}

  /**
   * Store a reasoning pattern with vector embedding
   *
   * @param pattern - The reasoning pattern to store
   * @returns Promise resolving when pattern is stored
   */
  async storePattern(pattern: ReasoningPattern): Promise<void> {
    // Create content for embedding
    const content = this.buildPatternContent(pattern);

    // Generate embedding using AgentDB
    const embedding = await this.agentDB.embed(content);

    // Store in AgentDB with metadata
    await this.agentDB.insert({
      content,
      embedding,
      metadata: {
        sessionId: pattern.sessionId,
        task: pattern.task,
        input: pattern.input,
        output: pattern.output,
        reward: pattern.reward,
        success: pattern.success,
        critique: pattern.critique,
        tokensUsed: pattern.tokensUsed,
        latencyMs: pattern.latencyMs,
        timestamp: pattern.timestamp || Date.now(),
        type: 'reasoning_pattern'
      }
    });
  }

  /**
   * Search for similar reasoning patterns
   *
   * @param task - Task description to search for
   * @param k - Number of results to return (default: 5)
   * @param options - Search filtering options
   * @returns Array of similar patterns with similarity scores
   */
  async searchPatterns(
    task: string,
    k: number = 5,
    options: PatternSearchOptions = {}
  ): Promise<ReasoningPattern[]> {
    // Generate embedding for search query
    const queryEmbedding = await this.agentDB.embed(task);

    // Perform vector search
    const results = await this.agentDB.vectorSearch(queryEmbedding, k, {
      filter: (metadata: any) => {
        // Filter by type
        if (metadata.type !== 'reasoning_pattern') return false;

        // Filter by success/failure
        if (options.onlySuccesses && !metadata.success) return false;
        if (options.onlyFailures && metadata.success) return false;

        // Filter by minimum reward
        if (options.minReward !== undefined && metadata.reward < options.minReward) {
          return false;
        }

        return true;
      }
    });

    // Map results to ReasoningPattern interface
    const patterns = results.map(result => ({
      sessionId: result.metadata.sessionId,
      task: result.metadata.task,
      input: result.metadata.input,
      output: result.metadata.output,
      reward: result.metadata.reward,
      success: result.metadata.success,
      critique: result.metadata.critique,
      tokensUsed: result.metadata.tokensUsed,
      latencyMs: result.metadata.latencyMs,
      timestamp: result.metadata.timestamp,
      similarity: result.similarity
    }));

    // Enforce the caller's predicates on what came back. The filter handed to
    // vectorSearch above is a push-down optimisation, not a guarantee:
    // AgentDBWrapper is an interface with no implementation in this repo, and a
    // backend that cannot evaluate an arbitrary JS predicate would silently
    // return rows the caller explicitly excluded. Re-applying is idempotent
    // when the backend did honour it.
    return patterns.filter(p => this.matchesSearchOptions(p, options));
  }

  /**
   * Whether a pattern satisfies the caller-supplied search predicates.
   *
   * Deliberately does not re-check the `type` discriminator: that is a
   * storage-layer concern already applied in the query, whereas these are the
   * promises made to the caller.
   */
  private matchesSearchOptions(
    pattern: ReasoningPattern,
    options: PatternSearchOptions
  ): boolean {
    if (options.onlySuccesses && !pattern.success) return false;
    if (options.onlyFailures && pattern.success) return false;
    // Written as !(>=) so a missing or NaN reward is excluded rather than kept.
    if (options.minReward !== undefined && !(pattern.reward >= options.minReward)) {
      return false;
    }
    return true;
  }

  /**
   * Get aggregated statistics for task-related patterns
   *
   * @param task - Task description to analyze
   * @param k - Number of recent patterns to analyze (default: 5)
   * @returns Aggregated statistics and insights
   */
  async getPatternStats(task: string, k: number = 5): Promise<PatternStats> {
    // Search for all related patterns
    const patterns = await this.searchPatterns(task, k * 2);

    if (patterns.length === 0) {
      return {
        totalAttempts: 0,
        successRate: 0,
        avgReward: 0,
        recentPatterns: [],
        critiques: []
      };
    }

    // Calculate statistics
    const totalAttempts = patterns.length;
    const successes = patterns.filter(p => p.success).length;
    const successRate = successes / totalAttempts;
    const avgReward = patterns.reduce((sum, p) => sum + p.reward, 0) / totalAttempts;
    const recentPatterns = patterns.slice(0, k);
    const critiques = patterns
      .filter(p => p.critique)
      .map(p => p.critique as string);

    return {
      totalAttempts,
      successRate,
      avgReward,
      recentPatterns,
      critiques
    };
  }

  /**
   * Clear the AgentDB query cache
   */
  async clearCache(): Promise<void> {
    await this.agentDB.clearCache();
  }

  /**
   * Build content string from pattern for embedding
   */
  private buildPatternContent(pattern: ReasoningPattern): string {
    const parts = [
      `Task: ${pattern.task}`,
      pattern.input ? `Input: ${pattern.input}` : null,
      pattern.output ? `Output: ${pattern.output}` : null,
      pattern.critique ? `Critique: ${pattern.critique}` : null,
      `Success: ${pattern.success}`,
      `Reward: ${pattern.reward}`
    ];

    return parts.filter(Boolean).join('\n');
  }
}
