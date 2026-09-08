window.BENCHMARK_DATA = {
  "lastUpdate": 1788868767603,
  "repoUrl": "https://github.com/vidaunited/agentic-flow",
  "entries": {
    "Benchmark": [
      {
        "commit": {
          "author": {
            "email": "mohammed@vimarkets.com",
            "name": "vidaunited",
            "username": "vidaunited"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "30775ff54c8712bbf4f97bbacc1aae1d790933f0",
          "message": "Merge pull request #6 from vidaunited/fix/benchmark-artifact-path\n\nfix(ci): extract the benchmark artifact at the right root",
          "timestamp": "2026-09-08T11:55:29+01:00",
          "tree_id": "46c653e698bef708418036088d6f1bda03c66dbb",
          "url": "https://github.com/vidaunited/agentic-flow/commit/30775ff54c8712bbf4f97bbacc1aae1d790933f0"
        },
        "date": 1788866710738,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 102552.627,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 147390.973,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 159684.922,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 790577.518,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 539123.956,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 99029.119,
            "unit": "ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "mohammed@vimarkets.com",
            "name": "vidaunited",
            "username": "vidaunited"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "abfa91c5f6ebfeea5fed3db4a3772f71ff66db2e",
          "message": "Merge pull request #7 from vidaunited/perf/docker-single-arch-when-not-publishing\n\nperf(ci): build a single architecture when images are not published",
          "timestamp": "2026-09-08T12:30:26+01:00",
          "tree_id": "d1fb7fec346cecc57f5f78310532156509f05aae",
          "url": "https://github.com/vidaunited/agentic-flow/commit/abfa91c5f6ebfeea5fed3db4a3772f71ff66db2e"
        },
        "date": 1788868766900,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 126245.841,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 131719.02,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 129842.812,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 741600.173,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 477769.87,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 55666.161,
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}