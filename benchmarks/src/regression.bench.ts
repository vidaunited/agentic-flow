/**
 * Regression Detection Benchmark
 * Compares v2.0.0-alpha performance against v1.0.0 baseline
 */

import {
  loadBaselineResults,
  compareWithBaseline,
  printRegressionAnalysis,
  saveBenchmarkResults,
  BenchmarkResult,
} from '../utils/benchmark';
import path from 'path';

/**
 * Performance improvement targets
 */
// Typed as a string map: it is indexed by benchmark name at runtime, and an
// object-literal type cannot be indexed by an arbitrary string.
const PERFORMANCE_TARGETS: Record<string, number> = {
  'vector-search-1000': 150,      // 150x faster
  'vector-search-10000': 150,     // 150x faster
  'vector-search-100000': 150,    // 150x faster
  'vector-search-1000000': 150,   // 150x faster
  'agent-spawn': 10,              // 10x faster
  'memory-insert': 125,           // 125x faster
  'task-orchestration': 5,        // 5x faster
};

/**
 * Load current benchmark results
 */
async function loadCurrentResults(): Promise<BenchmarkResult[]> {
  const resultsPath = path.join(__dirname, '../data/results-v2.0.json');
  try {
    const results = await loadBaselineResults(resultsPath);
    return results;
  } catch (error) {
    console.warn('⚠️  No current results found. Run benchmarks first:');
    console.log('  npm run benchmark');
    return [];
  }
}

/**
 * Calculate improvement factor
 */
function calculateImprovement(baseline: number, current: number): number {
  return baseline / current;
}

/**
 * Run regression analysis
 */
export async function runRegressionAnalysis(): Promise<void> {
  console.log('\n🔍 Performance Regression Analysis');
  console.log('Comparing v2.0.0-alpha against v1.0.0 baseline');
  console.log('═'.repeat(80));

  // Load baseline (v1.0.0)
  const baselinePath = path.join(__dirname, '../data/baseline-v1.0.json');
  const baselineResults = await loadBaselineResults(baselinePath);

  if (baselineResults.length === 0) {
    console.error('❌ No baseline results found');
    process.exit(1);
  }

  console.log(`\n✅ Loaded ${baselineResults.length} baseline benchmarks from v1.0.0`);

  // Load current results (v2.0.0-alpha)
  const currentResults = await loadCurrentResults();

  if (currentResults.length === 0) {
    console.error('❌ No current results found. Run benchmarks first.');
    process.exit(1);
  }

  console.log(`✅ Loaded ${currentResults.length} current benchmarks from v2.0.0-alpha`);

  // Compare each benchmark
  const comparisons: Array<{
    benchmark: string;
    baselineP50: number;
    currentP50: number;
    improvementFactor: number;
    targetImprovement: number;
    meetsTarget: boolean;
    regressionResults: ReturnType<typeof compareWithBaseline>;
  }> = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const baseline of baselineResults) {
    const current = currentResults.find(r => r.name === baseline.name);

    if (!current) {
      console.warn(`⚠️  No current result found for: ${baseline.name}`);
      continue;
    }

    // Compare against baseline
    const regressionResults = compareWithBaseline(current, baseline, {
      mean: 1.1,  // Allow 10% regression
      p50: 1.1,
      p95: 1.2,   // Allow 20% regression for tail latency
      p99: 1.3,   // Allow 30% regression for extreme tail
    });

    // Calculate improvement factor
    const improvementFactor = calculateImprovement(baseline.p50, current.p50);
    const targetImprovement = PERFORMANCE_TARGETS[baseline.name] || 1;
    const meetsTarget = improvementFactor >= targetImprovement * 0.9; // 90% of target

    comparisons.push({
      benchmark: baseline.name,
      baselineP50: baseline.p50,
      currentP50: current.p50,
      improvementFactor,
      targetImprovement,
      meetsTarget,
      regressionResults,
    });

    // Print regression analysis for this benchmark
    printRegressionAnalysis(regressionResults, baseline.name);

    // Check if passed
    const passed = regressionResults.every(r => r.passed) && meetsTarget;
    if (passed) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  }

  // Overall summary
  console.log('\n═'.repeat(80));
  console.log('📊 Overall Performance Summary');
  console.log('═'.repeat(80));

  const summaryData = comparisons.map(c => ({
    'Benchmark': c.benchmark,
    'v1.0 P50': `${c.baselineP50.toFixed(2)}ms`,
    'v2.0 P50': `${c.currentP50.toFixed(2)}ms`,
    'Improvement': `${c.improvementFactor.toFixed(1)}x`,
    'Target': `${c.targetImprovement}x`,
    'Status': c.meetsTarget ? '✅' : '❌',
  }));

  console.table(summaryData);

  // Performance targets summary
  console.log('\n🎯 Performance Targets Summary:');
  console.log('─'.repeat(80));

  const targetsSummary = Object.entries(PERFORMANCE_TARGETS).map(([name, target]) => {
    const comparison = comparisons.find(c => c.benchmark === name);
    if (!comparison) {
      return {
        'Benchmark': name,
        'Target': `${target}x faster`,
        'Achieved': 'N/A',
        'Status': '⚠️',
      };
    }

    const achievedPercent = (comparison.improvementFactor / target) * 100;
    return {
      'Benchmark': name,
      'Target': `${target}x faster`,
      'Achieved': `${comparison.improvementFactor.toFixed(1)}x (${achievedPercent.toFixed(0)}%)`,
      'Status': comparison.meetsTarget ? '✅' : '❌',
    };
  });

  console.table(targetsSummary);

  // Final verdict
  console.log('\n═'.repeat(80));
  if (totalFailed === 0) {
    console.log('✅ ALL PERFORMANCE TARGETS MET!');
    console.log(`   ${totalPassed}/${totalPassed + totalFailed} benchmarks passed`);
    console.log('\n🚀 v2.0.0-alpha delivers the promised performance improvements!');
  } else {
    console.log('⚠️  SOME PERFORMANCE TARGETS NOT MET');
    console.log(`   ${totalPassed}/${totalPassed + totalFailed} benchmarks passed`);
    console.log(`   ${totalFailed} benchmarks need improvement`);

    console.log('\n📋 Action Items:');
    comparisons
      .filter(c => !c.meetsTarget)
      .forEach(c => {
        const gap = ((c.targetImprovement - c.improvementFactor) / c.targetImprovement) * 100;
        console.log(`  - ${c.benchmark}: ${gap.toFixed(0)}% gap to target`);
      });
  }
  console.log('═'.repeat(80));

  // Exit with error if targets not met
  if (totalFailed > 0) {
    process.exit(1);
  }
}

/**
 * Generate regression report
 */
export async function generateRegressionReport(): Promise<void> {
  console.log('\n📄 Generating Regression Report...');

  const baselinePath = path.join(__dirname, '../data/baseline-v1.0.json');
  const currentPath = path.join(__dirname, '../data/results-v2.0.json');

  const baselineResults = await loadBaselineResults(baselinePath);
  const currentResults = await loadBaselineResults(currentPath);

  const report = {
    timestamp: new Date().toISOString(),
    version: '2.0.0-alpha',
    baseline: '1.0.0',
    comparisons: [] as any[],
  };

  for (const baseline of baselineResults) {
    const current = currentResults.find(r => r.name === baseline.name);
    if (!current) continue;

    const improvementFactor = calculateImprovement(baseline.p50, current.p50);
    const targetImprovement = PERFORMANCE_TARGETS[baseline.name] || 1;

    report.comparisons.push({
      benchmark: baseline.name,
      baseline: {
        p50: baseline.p50,
        p95: baseline.p95,
        p99: baseline.p99,
        mean: baseline.mean,
      },
      current: {
        p50: current.p50,
        p95: current.p95,
        p99: current.p99,
        mean: current.mean,
      },
      improvement: {
        factor: improvementFactor,
        target: targetImprovement,
        achieved: improvementFactor >= targetImprovement * 0.9,
      },
    });
  }

  const reportPath = path.join(__dirname, '../data/regression-report.json');
  await saveBenchmarkResults(report as any, reportPath);

  console.log(`✅ Regression report saved to: ${reportPath}`);
}

// Run regression analysis if executed directly
if (require.main === module) {
  (async () => {
    try {
      await runRegressionAnalysis();
      await generateRegressionReport();
      process.exit(0);
    } catch (error) {
      console.error('❌ Regression analysis failed:', error);
      process.exit(1);
    }
  })();
}
