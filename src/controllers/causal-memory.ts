/**
 * CausalMemoryGraphController - Causal Reasoning and Explainable Recall
 *
 * Implements causal graph for understanding cause-effect relationships:
 * - Track causal edges with confidence scores
 * - Forward inference (cause → effect prediction)
 * - Backward inference (effect → cause analysis)
 * - Counterfactual reasoning
 * - Explainable decision making
 *
 * @example
 * ```typescript
 * const controller = new CausalMemoryGraphController(agentDB);
 *
 * // Add causal relationship
 * await controller.addCausalEdge({
 *   cause: 'added-caching',
 *   effect: 'reduced-latency',
 *   confidence: 0.95,
 *   mechanism: 'Caching reduces database queries',
 *   evidence: ['benchmark-results', 'metrics']
 * });
 *
 * // Predict effects
 * const effects = await controller.forwardInference('deploy-new-auth', {
 *   maxDepth: 3,
 *   minConfidence: 0.7
 * });
 * ```
 */

import type { AgentDBWrapper } from '../types/agentdb';

export interface CausalEdge {
  cause: string;
  effect: string;
  confidence: number;
  mechanism?: string;
  evidence?: string[];
  strength?: number;
  timestamp?: number;
}

export interface CausalEffect {
  effect: string;
  /**
   * The cause node. Populated by backward traversal (getRootCauses /
   * backwardInference), where the node being reported IS a cause -- previously
   * such results carried it in `effect`, so a caller inspecting a backward
   * result could not tell a cause from an effect.
   */
  cause?: string;
  confidence: number;
  mechanism?: string;
  path?: string[];
}

export interface CausalPath {
  nodes: string[];
  totalConfidence: number;
  mechanisms: string[];
}

export interface CommonCause {
  cause: string;
  effects: string[];
  confidence: number;
}

export interface GraphExportOptions {
  format: 'json' | 'cytoscape' | 'graphviz' | 'd3';
  includeMetadata?: boolean;
  highlightPaths?: Array<{ from: string; to: string }>;
}

export interface InferenceOptions {
  maxDepth?: number;
  minConfidence?: number;
  includeUncertain?: boolean;
  rankByCausalStrength?: boolean;
}

/**
 * CausalMemoryGraphController
 *
 * Manages causal relationships for explainable AI and reasoning
 */
export class CausalMemoryGraphController {
  constructor(private agentDB: AgentDBWrapper) {}

  /**
   * Add a causal edge to the graph
   *
   * @param edge - The causal relationship
   */
  async addCausalEdge(edge: CausalEdge): Promise<void> {
    // Build content for embedding
    const content = this.buildEdgeContent(edge);

    // Generate embedding
    const embedding = await this.agentDB.embed(content);

    // Store in AgentDB
    await this.agentDB.insert({
      content,
      embedding,
      metadata: {
        cause: edge.cause,
        effect: edge.effect,
        confidence: edge.confidence,
        mechanism: edge.mechanism,
        evidence: edge.evidence,
        strength: edge.strength || edge.confidence,
        timestamp: edge.timestamp || Date.now(),
        type: 'causal_edge'
      }
    });
  }

  /**
   * Get effects of a cause (forward inference)
   *
   * @param cause - The cause node ID
   * @param options - Inference options
   * @returns Array of effects
   */
  async getEffects(cause: string, options: InferenceOptions): Promise<CausalEffect[]> {
    const maxDepth = options.maxDepth || 3;
    const minConfidence = options.minConfidence || 0.0;

    // Query direct effects
    const results = await this.agentDB.query({
      filter: (metadata: any) =>
        metadata.type === 'causal_edge' &&
        metadata.cause === cause &&
        metadata.confidence >= minConfidence
    });

    const effects: CausalEffect[] = [];

    // Verify the rows actually describe edges out of `cause` at or above the
    // confidence floor. The predicate handed to query() is a push-down
    // optimisation, not a guarantee -- a backend that cannot evaluate it would
    // otherwise have unrelated edges treated as effects of this node.
    const edges = results.filter((r: any) =>
      r.metadata?.cause === cause && r.metadata?.confidence >= minConfidence
    );

    for (const result of edges) {
      effects.push({
        effect: result.metadata.effect,
        confidence: result.metadata.confidence,
        mechanism: result.metadata.mechanism,
        path: [cause, result.metadata.effect]
      });

      // Recursive traversal for indirect effects
      if (maxDepth > 1) {
        const indirectEffects = await this.getEffects(
          result.metadata.effect,
          { ...options, maxDepth: maxDepth - 1 }
        );

        indirectEffects.forEach(ie => {
          const decayed = ie.confidence * result.metadata.confidence;
          // minConfidence was only ever applied to the raw edge, never to the
          // composite confidence of a multi-hop path. A caller asking for
          // >= 0.7 could therefore be handed a 0.5 path built from two 0.7
          // edges, with no indication it was below the floor they set.
          if (decayed < minConfidence) return;

          effects.push({
            effect: ie.effect,
            confidence: decayed,
            mechanism: ie.mechanism,
            path: [cause, ...ie.path!]
          });
        });
      }
    }

    return effects;
  }

  /**
   * Get root causes of an effect (backward inference)
   *
   * @param effect - The effect node ID
   * @param options - Inference options
   * @returns Array of causes
   */
  async getRootCauses(effect: string, options: InferenceOptions): Promise<CausalEffect[]> {
    const maxDepth = options.maxDepth || 5;
    const minConfidence = options.minConfidence || 0.0;

    // Query direct causes
    const results = await this.agentDB.query({
      filter: (metadata: any) =>
        metadata.type === 'causal_edge' &&
        metadata.effect === effect &&
        metadata.confidence >= minConfidence
    });

    const causes: CausalEffect[] = [];

    // Same verification as getEffects, on the incoming side of the edge.
    const edges = results.filter((r: any) =>
      r.metadata?.effect === effect && r.metadata?.confidence >= minConfidence
    );

    for (const result of edges) {
      causes.push({
        effect: result.metadata.cause,
        cause: result.metadata.cause,
        confidence: result.metadata.confidence,
        mechanism: result.metadata.mechanism,
        path: [result.metadata.cause, effect]
      });

      // Recursive traversal for root causes
      if (maxDepth > 1) {
        const rootCauses = await this.getRootCauses(
          result.metadata.cause,
          { ...options, maxDepth: maxDepth - 1 }
        );

        rootCauses.forEach(rc => {
          const decayed = rc.confidence * result.metadata.confidence;
          if (decayed < minConfidence) return;

          causes.push({
            effect: rc.effect,
            cause: rc.cause ?? rc.effect,
            confidence: decayed,
            mechanism: rc.mechanism,
            path: [...rc.path!, effect]
          });
        });
      }
    }

    return causes;
  }

  /**
   * Compute total causal strength between cause and effect
   *
   * @param options - Nodes to analyze
   * @returns Total causal strength (0-1)
   */
  async computeCausalStrength(options: {
    cause: string;
    effect: string;
  }): Promise<number> {
    const effects = await this.getEffects(options.cause, {
      maxDepth: 5,
      minConfidence: 0.0
    });

    // Find all paths to the target effect
    const pathsToEffect = effects.filter(e => e.effect === options.effect);

    if (pathsToEffect.length === 0) return 0;

    // Combine strengths from all paths
    let totalStrength = 0;
    pathsToEffect.forEach(path => {
      totalStrength += path.confidence * (0.9 ** (path.path!.length - 2)); // Decay by path length
    });

    return Math.min(1.0, totalStrength);
  }

  /**
   * Find common causes (confounders) for multiple effects
   *
   * @param effects - Array of effect node IDs
   * @returns Array of common causes
   */
  async findCommonCauses(effects: string[]): Promise<CommonCause[]> {
    const causeMaps = await Promise.all(
      effects.map(effect =>
        this.getRootCauses(effect, { maxDepth: 3, minConfidence: 0.5 })
      )
    );

    // Find causes that appear in multiple effect chains
    const causeFrequency = new Map<string, { effects: Set<string>; confidence: number }>();

    causeMaps.forEach((causes, effectIndex) => {
      causes.forEach(cause => {
        if (!causeFrequency.has(cause.effect)) {
          causeFrequency.set(cause.effect, {
            effects: new Set(),
            confidence: 0
          });
        }

        const entry = causeFrequency.get(cause.effect)!;
        entry.effects.add(effects[effectIndex]);
        entry.confidence = Math.max(entry.confidence, cause.confidence);
      });
    });

    // Filter to causes affecting multiple effects
    const commonCauses: CommonCause[] = [];
    causeFrequency.forEach((data, cause) => {
      if (data.effects.size > 1) {
        commonCauses.push({
          cause,
          effects: Array.from(data.effects),
          confidence: data.confidence
        });
      }
    });

    return commonCauses.sort((a, b) => b.effects.length - a.effects.length);
  }

  /**
   * Detect causal loops (circular dependencies)
   *
   * @returns Array of detected loops
   */
  async detectCausalLoops(): Promise<string[][]> {
    const allEdges = await this.agentDB.query({
      filter: (metadata: any) => metadata.type === 'causal_edge'
    });

    // Build adjacency list
    const graph = new Map<string, string[]>();
    allEdges.forEach((edge: any) => {
      if (!graph.has(edge.metadata.cause)) {
        graph.set(edge.metadata.cause, []);
      }
      graph.get(edge.metadata.cause)!.push(edge.metadata.effect);
    });

    // Detect cycles using DFS
    const loops: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      if (stack.has(node)) {
        // Found a loop
        const loopStart = path.indexOf(node);
        loops.push(path.slice(loopStart));
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      neighbors.forEach(neighbor => dfs(neighbor, [...path]));

      stack.delete(node);
    };

    graph.forEach((_, node) => {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    });

    return loops;
  }

  /**
   * Export causal graph for visualization
   *
   * @param options - Export options
   * @returns Graph data in specified format
   */
  async exportGraph(options: GraphExportOptions): Promise<any> {
    const allEdges = await this.agentDB.query({
      filter: (metadata: any) => metadata.type === 'causal_edge'
    });

    // Extract unique nodes
    const nodes = new Set<string>();
    allEdges.forEach((edge: any) => {
      nodes.add(edge.metadata.cause);
      nodes.add(edge.metadata.effect);
    });

    if (options.format === 'json') {
      return {
        nodes: Array.from(nodes).map(id => ({ id })),
        edges: allEdges.map((edge: any) => ({
          source: edge.metadata.cause,
          target: edge.metadata.effect,
          confidence: edge.metadata.confidence,
          mechanism: options.includeMetadata ? edge.metadata.mechanism : undefined
        }))
      };
    }

    // Add support for other formats as needed
    throw new Error(`Format ${options.format} not yet implemented`);
  }

  /**
   * Forward inference (predict effects)
   *
   * @param action - The action/cause ID
   * @param options - Inference options
   * @returns Predicted effects
   */
  async forwardInference(action: string, options: InferenceOptions): Promise<CausalEffect[]> {
    return this.getEffects(action, options);
  }

  /**
   * Backward inference (identify causes)
   *
   * @param observation - The observation/effect ID
   * @param options - Inference options
   * @returns Likely causes
   */
  async backwardInference(observation: string, options: InferenceOptions): Promise<CausalEffect[]> {
    return this.getRootCauses(observation, options);
  }

  /**
   * Build content string from causal edge for embedding
   */
  private buildEdgeContent(edge: CausalEdge): string {
    const parts = [
      `Cause: ${edge.cause}`,
      `Effect: ${edge.effect}`,
      edge.mechanism ? `Mechanism: ${edge.mechanism}` : null,
      `Confidence: ${edge.confidence}`
    ];

    return parts.filter(Boolean).join('\n');
  }
}
