/**
 * Performance Benchmark Utility
 * Provides accurate benchmarking with warmup, iterations, and statistical analysis
 */

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
  name?: string;
  silent?: boolean;
  minSamples?: number;
  maxTime?: number; // Maximum time in ms to run benchmark
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  samples: number[];
  mean: number;
  median: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  stdDev: number;
  opsPerSecond: number;
  totalTime: number;
}

export interface RegressionResult {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  changePercent: number;
  passed: boolean;
  threshold: number;
}

/**
 * High-precision timer using performance.now()
 */
class HighPrecisionTimer {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[], mean: number): number {
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 0.001) {
    return `${(ms * 1000000).toFixed(2)}ns`;
  } else if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Format throughput
 */
export function formatThroughput(opsPerSec: number): string {
  if (opsPerSec < 1000) {
    return `${opsPerSec.toFixed(2)} ops/sec`;
  } else if (opsPerSec < 1000000) {
    return `${(opsPerSec / 1000).toFixed(2)}K ops/sec`;
  } else {
    return `${(opsPerSec / 1000000).toFixed(2)}M ops/sec`;
  }
}

/**
 * Run a benchmark function with warmup and multiple iterations
 */
export async function benchmark(
  fn: () => Promise<any> | any,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const {
    iterations = 1000,
    warmup = 100,
    name = 'benchmark',
    silent = false,
    minSamples = 5,
    maxTime = 30000, // 30 seconds max
  } = options;

  const timer = new HighPrecisionTimer();
  const samples: number[] = [];

  // Warmup phase
  if (!silent) {
    console.log(`\n🔥 Warming up ${name} (${warmup} iterations)...`);
  }
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Benchmark phase
  if (!silent) {
    console.log(`⚡ Running ${name} benchmark...`);
  }

  const benchmarkStart = performance.now();
  let actualIterations = 0;

  for (let i = 0; i < iterations; i++) {
    // Check if we've exceeded max time
    if (performance.now() - benchmarkStart > maxTime && samples.length >= minSamples) {
      if (!silent) {
        console.log(`⏰ Max time reached after ${actualIterations} iterations`);
      }
      break;
    }

    timer.start();
    await fn();
    const duration = timer.end();
    samples.push(duration);
    actualIterations++;

    // Progress indicator every 10%
    if (!silent && actualIterations % Math.max(1, Math.floor(iterations / 10)) === 0) {
      const progress = ((actualIterations / iterations) * 100).toFixed(0);
      process.stdout.write(`\r  Progress: ${progress}%`);
    }
  }

  if (!silent) {
    process.stdout.write('\n');
  }

  // Calculate statistics
  const sortedSamples = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const totalTime = performance.now() - benchmarkStart;

  const result: BenchmarkResult = {
    name,
    iterations: actualIterations,
    samples: sortedSamples,
    mean,
    median: percentile(sortedSamples, 50),
    p50: percentile(sortedSamples, 50),
    p75: percentile(sortedSamples, 75),
    p90: percentile(sortedSamples, 90),
    p95: percentile(sortedSamples, 95),
    p99: percentile(sortedSamples, 99),
    p999: percentile(sortedSamples, 99.9),
    min: sortedSamples[0],
    max: sortedSamples[sortedSamples.length - 1],
    stdDev: standardDeviation(samples, mean),
    opsPerSecond: 1000 / mean,
    totalTime,
  };

  if (!silent) {
    printBenchmarkResult(result);
  }

  return result;
}

/**
 * Print benchmark result in a formatted table
 */
export function printBenchmarkResult(result: BenchmarkResult): void {
  console.log(`\n📊 Benchmark Results: ${result.name}`);
  console.log('─'.repeat(60));
  console.table({
    'Iterations': result.iterations,
    'Mean': formatDuration(result.mean),
    'Median (P50)': formatDuration(result.p50),
    'P75': formatDuration(result.p75),
    'P90': formatDuration(result.p90),
    'P95': formatDuration(result.p95),
    'P99': formatDuration(result.p99),
    'P99.9': formatDuration(result.p999),
    'Min': formatDuration(result.min),
    'Max': formatDuration(result.max),
    'Std Dev': formatDuration(result.stdDev),
    'Throughput': formatThroughput(result.opsPerSecond),
  });
}

/**
 * Compare benchmark results against baseline
 */
export function compareWithBaseline(
  current: BenchmarkResult,
  baseline: BenchmarkResult,
  thresholds: Record<string, number> = {}
): RegressionResult[] {
  const defaultThreshold = 1.1; // 10% regression allowed by default
  const metrics: Array<keyof Pick<BenchmarkResult, 'mean' | 'p50' | 'p95' | 'p99'>> = [
    'mean',
    'p50',
    'p95',
    'p99',
  ];

  return metrics.map(metric => {
    const baselineValue = baseline[metric];
    const currentValue = current[metric];
    const change = currentValue - baselineValue;
    const changePercent = ((change / baselineValue) * 100);
    const threshold = thresholds[metric] || defaultThreshold;
    const passed = currentValue <= baselineValue * threshold;

    return {
      metric,
      baseline: baselineValue,
      current: currentValue,
      change,
      changePercent,
      passed,
      threshold,
    };
  });
}

/**
 * Print regression analysis
 */
export function printRegressionAnalysis(
  results: RegressionResult[],
  benchmarkName: string
): void {
  console.log(`\n🔍 Regression Analysis: ${benchmarkName}`);
  console.log('─'.repeat(80));

  const tableData = results.map(r => ({
    'Metric': r.metric.toUpperCase(),
    'Baseline': formatDuration(r.baseline),
    'Current': formatDuration(r.current),
    'Change': `${r.change > 0 ? '+' : ''}${formatDuration(Math.abs(r.change))}`,
    'Change %': `${r.change > 0 ? '+' : ''}${r.changePercent.toFixed(2)}%`,
    'Status': r.passed ? '✅ PASS' : '❌ FAIL',
  }));

  console.table(tableData);

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log('\n⚠️  Performance Regressions Detected:');
    failed.forEach(f => {
      console.log(`  - ${f.metric.toUpperCase()}: ${f.changePercent.toFixed(2)}% slower`);
    });
  } else {
    console.log('\n✅ All performance metrics within acceptable range');
  }
}

/**
 * Run multiple benchmarks in a suite
 */
export async function benchmarkSuite(
  benchmarks: Array<{ name: string; fn: () => Promise<any> | any; options?: BenchmarkOptions }>,
  suiteName: string = 'Benchmark Suite'
): Promise<BenchmarkResult[]> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 ${suiteName}`);
  console.log(`${'='.repeat(80)}`);

  const results: BenchmarkResult[] = [];

  for (const bench of benchmarks) {
    const result = await benchmark(bench.fn, {
      ...bench.options,
      name: bench.name,
    });
    results.push(result);
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📈 Suite Summary: ${suiteName}`);
  console.log(`${'='.repeat(80)}`);

  const summaryData = results.map(r => ({
    'Benchmark': r.name,
    'P50': formatDuration(r.p50),
    'P95': formatDuration(r.p95),
    'P99': formatDuration(r.p99),
    'Throughput': formatThroughput(r.opsPerSecond),
  }));

  console.table(summaryData);

  return results;
}

/**
 * Save benchmark results to JSON file
 */
export async function saveBenchmarkResults(
  results: BenchmarkResult | BenchmarkResult[],
  filePath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const data = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0-alpha',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    results: Array.isArray(results) ? results : [results],
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));

  console.log(`\n💾 Results saved to: ${filePath}`);
}

/**
 * Record a benchmark result into the shared current-results file.
 *
 * The benchmark suites run as separate processes, and `data/results-v2.0.json`
 * is read by BOTH the regression analysis and the HTML report generator — but
 * nothing ever wrote it. Both consumers therefore swallowed the missing file
 * and reported on an empty set, so the regression step passed while comparing
 * nothing at all. Each suite now merges its results in by name as it finishes.
 */
export async function recordBenchmarkResults(
  results: BenchmarkResult | BenchmarkResult[],
  filePath?: string
): Promise<void> {
  // This module imports node builtins per-function; keep that convention.
  const fs = await import('fs/promises');
  const path = await import('path');

  const target =
    filePath || path.join(__dirname, '..', 'data', 'results-v2.0.json');
  const incoming = Array.isArray(results) ? results : [results];

  let existing: BenchmarkResult[] = [];
  try {
    const raw = JSON.parse(await fs.readFile(target, 'utf8'));
    if (Array.isArray(raw?.results)) existing = raw.results;
  } catch {
    // First suite of the run — nothing to merge into.
  }

  // Merge by name so a re-run replaces its own entries rather than duplicating.
  const byName = new Map(existing.map(r => [r.name, r]));
  for (const r of incoming) byName.set(r.name, r);

  await saveBenchmarkResults([...byName.values()], target);
}

/**
 * Load baseline benchmark results
 */
export async function loadBaselineResults(filePath: string): Promise<BenchmarkResult[]> {
  const fs = await import('fs/promises');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.results;
  } catch (error) {
    console.warn(`⚠️  Could not load baseline from ${filePath}:`, error);
    return [];
  }
}
