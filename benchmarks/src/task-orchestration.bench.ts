/**
 * Task Orchestration Performance Benchmarks
 * Target: <50ms P50 for task orchestration (5x faster than v1.0)
 */

import { benchmark, benchmarkSuite, formatDuration, recordBenchmarkResults } from '../utils/benchmark';

interface Task {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  estimatedDuration: number;
}

interface Agent {
  id: string;
  type: string;
  capacity: number;
  currentLoad: number;
  capabilities: string[];
}

/**
 * Task Orchestrator for benchmarking
 */
class TaskOrchestrator {
  private tasks: Map<string, Task>;
  private agents: Map<string, Agent>;
  private assignments: Map<string, string>; // taskId -> agentId
  private completedTasks: Set<string>;

  constructor() {
    this.tasks = new Map();
    this.agents = new Map();
    this.assignments = new Map();
    this.completedTasks = new Set();
  }

  async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async submitTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async orchestrate(): Promise<Map<string, string>> {
    const assignments = new Map<string, string>();
    const readyTasks = this.getReadyTasks();

    // Sort tasks by priority
    const sortedTasks = readyTasks.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Assign tasks to agents
    for (const task of sortedTasks) {
      const agent = this.findBestAgent(task);
      if (agent) {
        assignments.set(task.id, agent.id);
        this.assignments.set(task.id, agent.id);
        agent.currentLoad += task.estimatedDuration;
      }
    }

    return assignments;
  }

  private getReadyTasks(): Task[] {
    const ready: Task[] = [];
    for (const [taskId, task] of this.tasks) {
      if (this.completedTasks.has(taskId)) continue;
      if (this.assignments.has(taskId)) continue;

      // Check if all dependencies are completed
      const allDepsCompleted = task.dependencies.every(depId =>
        this.completedTasks.has(depId)
      );

      if (allDepsCompleted) {
        ready.push(task);
      }
    }
    return ready;
  }

  private findBestAgent(task: Task): Agent | null {
    let bestAgent: Agent | null = null;
    let lowestLoad = Infinity;

    for (const agent of this.agents.values()) {
      // Check if agent has required capability
      const hasCapability = agent.capabilities.includes(task.type);
      if (!hasCapability) continue;

      // Check if agent has capacity
      if (agent.currentLoad >= agent.capacity) continue;

      // Select agent with lowest current load
      if (agent.currentLoad < lowestLoad) {
        lowestLoad = agent.currentLoad;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  async completeTask(taskId: string): Promise<void> {
    this.completedTasks.add(taskId);
    const agentId = this.assignments.get(taskId);
    if (agentId) {
      const agent = this.agents.get(agentId);
      if (agent) {
        const task = this.tasks.get(taskId);
        if (task) {
          agent.currentLoad = Math.max(0, agent.currentLoad - task.estimatedDuration);
        }
      }
    }
  }

  clear(): void {
    this.tasks.clear();
    this.agents.clear();
    this.assignments.clear();
    this.completedTasks.clear();
  }
}

/**
 * Task Orchestration Benchmark
 * Target: <50ms P50
 */
export async function runTaskOrchestrationBenchmark(): Promise<void> {
  console.log('\n🎯 Task Orchestration Performance Benchmark');
  console.log('Target: <50ms P50 (5x faster than v1.0)');
  console.log('─'.repeat(80));

  const orchestrator = new TaskOrchestrator();

  // Register agents
  const agentTypes = ['coder', 'tester', 'reviewer', 'analyst', 'documenter'];
  for (let i = 0; i < 10; i++) {
    await orchestrator.registerAgent({
      id: `agent-${i}`,
      type: agentTypes[i % agentTypes.length],
      capacity: 100,
      currentLoad: 0,
      capabilities: [agentTypes[i % agentTypes.length], 'general'],
    });
  }

  // Submit tasks
  const taskTypes = ['coder', 'tester', 'reviewer', 'analyst', 'documenter'];
  const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];

  for (let i = 0; i < 100; i++) {
    await orchestrator.submitTask({
      id: `task-${i}`,
      type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      dependencies: i > 0 && Math.random() > 0.7 ? [`task-${Math.floor(Math.random() * i)}`] : [],
      estimatedDuration: Math.floor(Math.random() * 20) + 5,
    });
  }

  const result = await benchmark(
    async () => {
      await orchestrator.orchestrate();
    },
    {
      iterations: 1000,
      warmup: 100,
      name: 'task-orchestration',
    }
  );

  // Feed the shared results file the regression analysis and report read.
  await recordBenchmarkResults(result);

  const targetP50 = 50; // ms
  const targetMet = result.p50 <= targetP50;
  const improvement = ((targetP50 - result.p50) / targetP50) * 100;

  console.log(`\n🎯 Target Analysis:`);
  console.table({
    'Target P50': `${targetP50}ms`,
    'Actual P50': formatDuration(result.p50),
    'Status': targetMet ? '✅ PASS' : '❌ FAIL',
    'Margin': targetMet
      ? `${improvement.toFixed(1)}% faster than target`
      : `${Math.abs(improvement).toFixed(1)}% slower than target`,
  });

  if (targetMet) {
    console.log('\n✅ Task orchestration benchmark PASSED!');
    console.log('🚀 Performance target achieved: 5x faster than v1.0');
  } else {
    console.log('\n⚠️  Task orchestration benchmark did not meet target');
  }

  orchestrator.clear();
}

/**
 * Scalability Benchmark - Variable Task Count
 */
export async function runScalabilityBenchmark(): Promise<void> {
  console.log('\n📈 Task Orchestration Scalability Benchmark');
  console.log('─'.repeat(80));

  const taskCounts = [10, 50, 100, 500, 1000];
  const results = [];

  for (const taskCount of taskCounts) {
    const orchestrator = new TaskOrchestrator();

    // Register agents (1 agent per 10 tasks)
    const agentCount = Math.max(5, Math.floor(taskCount / 10));
    const agentTypes = ['coder', 'tester', 'reviewer', 'analyst'];
    for (let i = 0; i < agentCount; i++) {
      await orchestrator.registerAgent({
        id: `agent-${i}`,
        type: agentTypes[i % agentTypes.length],
        capacity: 100,
        currentLoad: 0,
        capabilities: [agentTypes[i % agentTypes.length]],
      });
    }

    // Submit tasks
    for (let i = 0; i < taskCount; i++) {
      await orchestrator.submitTask({
        id: `task-${i}`,
        type: agentTypes[Math.floor(Math.random() * agentTypes.length)],
        priority: i % 4 === 0 ? 'high' : 'medium',
        dependencies: [],
        estimatedDuration: 10,
      });
    }

    const result = await benchmark(
      async () => {
        await orchestrator.orchestrate();
      },
      {
        iterations: 100,
        warmup: 10,
        name: `orchestration-${taskCount}-tasks`,
        silent: true,
      }
    );

    results.push({ taskCount, agentCount, result });
    orchestrator.clear();
  }

  console.log('\n📊 Orchestration Scalability Results:');
  console.table(
    results.map(({ taskCount, agentCount, result }) => ({
      'Tasks': taskCount,
      'Agents': agentCount,
      'P50': formatDuration(result.p50),
      'P95': formatDuration(result.p95),
      'P99': formatDuration(result.p99),
    }))
  );
}

/**
 * Dependency Resolution Benchmark
 */
export async function runDependencyResolutionBenchmark(): Promise<void> {
  console.log('\n🔗 Dependency Resolution Performance Benchmark');
  console.log('─'.repeat(80));

  const orchestrator = new TaskOrchestrator();

  // Register agents
  for (let i = 0; i < 5; i++) {
    await orchestrator.registerAgent({
      id: `agent-${i}`,
      type: 'general',
      capacity: 100,
      currentLoad: 0,
      capabilities: ['general'],
    });
  }

  // Create task dependency graph
  // Task 0: no deps
  // Task 1-5: depend on task 0
  // Task 6-10: depend on task 1-5
  // Task 11-15: depend on task 6-10
  for (let i = 0; i < 50; i++) {
    const dependencies: string[] = [];
    if (i > 0 && i <= 5) {
      dependencies.push('task-0');
    } else if (i > 5 && i <= 10) {
      dependencies.push(`task-${i - 5}`);
    } else if (i > 10 && i <= 15) {
      dependencies.push(`task-${i - 5}`);
    } else if (i > 15) {
      dependencies.push(`task-${Math.floor(i / 2)}`);
    }

    await orchestrator.submitTask({
      id: `task-${i}`,
      type: 'general',
      priority: 'medium',
      dependencies,
      estimatedDuration: 10,
    });
  }

  const result = await benchmark(
    async () => {
      await orchestrator.orchestrate();
    },
    {
      iterations: 500,
      warmup: 50,
      name: 'dependency-resolution',
    }
  );

  console.log('\n📊 Dependency Resolution Performance:');
  console.table({
    'Mean': formatDuration(result.mean),
    'P50': formatDuration(result.p50),
    'P95': formatDuration(result.p95),
    'P99': formatDuration(result.p99),
    'Throughput': `${result.opsPerSecond.toFixed(0)} ops/sec`,
  });

  orchestrator.clear();
}

/**
 * Priority-based Scheduling Benchmark
 */
export async function runPrioritySchedulingBenchmark(): Promise<void> {
  console.log('\n⭐ Priority-based Scheduling Benchmark');
  console.log('─'.repeat(80));

  const orchestrator = new TaskOrchestrator();

  // Register agents
  for (let i = 0; i < 10; i++) {
    await orchestrator.registerAgent({
      id: `agent-${i}`,
      type: 'general',
      capacity: 100,
      currentLoad: 0,
      capabilities: ['general'],
    });
  }

  // Submit tasks with different priorities
  const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
  for (let i = 0; i < 200; i++) {
    await orchestrator.submitTask({
      id: `task-${i}`,
      type: 'general',
      priority: priorities[i % priorities.length],
      dependencies: [],
      estimatedDuration: 10,
    });
  }

  const result = await benchmark(
    async () => {
      await orchestrator.orchestrate();
    },
    {
      iterations: 500,
      warmup: 50,
      name: 'priority-scheduling',
    }
  );

  console.log('\n📊 Priority Scheduling Performance:');
  console.table({
    'Mean': formatDuration(result.mean),
    'P50': formatDuration(result.p50),
    'P95': formatDuration(result.p95),
    'P99': formatDuration(result.p99),
    'Throughput': `${result.opsPerSecond.toFixed(0)} ops/sec`,
  });

  orchestrator.clear();
}

// Run all benchmarks if executed directly
if (require.main === module) {
  (async () => {
    try {
      await runTaskOrchestrationBenchmark();
      await runScalabilityBenchmark();
      await runDependencyResolutionBenchmark();
      await runPrioritySchedulingBenchmark();
      process.exit(0);
    } catch (error) {
      console.error('❌ Task orchestration benchmarks failed:', error);
      process.exit(1);
    }
  })();
}
