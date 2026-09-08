/**
 * Convert this suite's results into the shape benchmark-action expects.
 *
 * The workflow feeds data/results-v2.0.json to
 * benchmark-action/github-action-benchmark with tool 'customBiggerIsBetter',
 * which requires a flat JSON ARRAY of { name, unit, value }. Our results file
 * is an object of BenchmarkResult records, so the action could never have
 * parsed it. This emits the array form alongside it.
 *
 * "Bigger is better" means throughput, not latency — publishing p50 under that
 * tool would invert every alert, so operations/second is what gets exported.
 */
import fs from 'fs/promises';
import path from 'path';

interface BenchmarkResult {
  name: string;
  opsPerSecond?: number;
  p50?: number;
}

async function main(): Promise<void> {
  const dataDir = path.join(__dirname, '..', 'data');
  const source = path.join(dataDir, 'results-v2.0.json');
  const target = path.join(dataDir, 'benchmark-action.json');

  const raw = JSON.parse(await fs.readFile(source, 'utf8'));
  const results: BenchmarkResult[] = Array.isArray(raw?.results) ? raw.results : [];

  if (results.length === 0) {
    throw new Error(
      `No benchmark results in ${source} — run the benchmark suites before exporting.`
    );
  }

  const exported = results
    .filter(r => typeof r.opsPerSecond === 'number' && isFinite(r.opsPerSecond))
    .map(r => ({
      name: r.name,
      unit: 'ops/sec',
      value: Number(r.opsPerSecond!.toFixed(3)),
    }));

  if (exported.length === 0) {
    throw new Error('No results carried a usable opsPerSecond value.');
  }

  await fs.writeFile(target, JSON.stringify(exported, null, 2));
  console.log(`Exported ${exported.length} benchmarks to ${target}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
