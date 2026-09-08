window.BENCHMARK_DATA = {
  "lastUpdate": 1788891273287,
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
          "id": "7d331ed61142ad03ba612d8f8c5207f923882b0a",
          "message": "Merge pull request #8 from vidaunited/fix/benchmark-alert-noise-floor\n\nfix(ci): stop the benchmark alert firing on runner noise",
          "timestamp": "2026-09-08T14:16:36+01:00",
          "tree_id": "f42198b9ef064760ab6b01e2fc5faae3eaa52ee7",
          "url": "https://github.com/vidaunited/agentic-flow/commit/7d331ed61142ad03ba612d8f8c5207f923882b0a"
        },
        "date": 1788875152402,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 112707.805,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 159683.24,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 120256.078,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 718310.356,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 367163.011,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 92316.251,
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
          "id": "3d6b99e19a6f77a93b2c72abf9d01a8af5d7576b",
          "message": "Merge pull request #11 from vidaunited/fix/controller-filter-contracts\n\nfix(controllers): enforce query predicates instead of assuming the backend did",
          "timestamp": "2026-09-08T15:27:17+01:00",
          "tree_id": "0ef48e6d74871d4f90d5fcd9ca63b743b53ea552",
          "url": "https://github.com/vidaunited/agentic-flow/commit/3d6b99e19a6f77a93b2c72abf9d01a8af5d7576b"
        },
        "date": 1788879480950,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 101483.311,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 103345.565,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 175259.002,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 682044.217,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 359915.583,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 61244.462,
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
          "id": "3ebd0764e152f2267c13b1645cc0b260e7f4588b",
          "message": "Merge pull request #14 from vidaunited/fix/agentdb-docker-test-measurable\n\nfix(ci): make agentdb-docker-test measurable on demand",
          "timestamp": "2026-09-08T16:42:34+01:00",
          "tree_id": "c1cf2681c357c72648f82adf12474ba897abe71d",
          "url": "https://github.com/vidaunited/agentic-flow/commit/3ebd0764e152f2267c13b1645cc0b260e7f4588b"
        },
        "date": 1788883981110,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 115125.181,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 127373.656,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 149054.288,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 907447.028,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 481685.475,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 84095.342,
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
          "id": "17156ebbe6e5d7831f9289c771d668f00bfb4046",
          "message": "Merge pull request #16 from vidaunited/docs/link-upstream-cli-path-issue\n\ndocs(ci): link the excluded docker targets to ruvnet/agentdb#25",
          "timestamp": "2026-09-08T17:48:57+01:00",
          "tree_id": "15336dee8cf8d11f8d23c95a33689e1664139aa1",
          "url": "https://github.com/vidaunited/agentic-flow/commit/17156ebbe6e5d7831f9289c771d668f00bfb4046"
        },
        "date": 1788887915255,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 114480.488,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 72742.975,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 87062.435,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 753976.434,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 366929.119,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 83977.264,
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
          "id": "201697fc5d675fb14089aa913c3c062ed1d65d39",
          "message": "Merge pull request #21 from vidaunited/ci/tighten-multiplatform-timeout\n\nci: tighten the multi-platform timeout to its measured duration",
          "timestamp": "2026-09-08T18:44:37+01:00",
          "tree_id": "38dea4488be09a82902398138957f418ae210da6",
          "url": "https://github.com/vidaunited/agentic-flow/commit/201697fc5d675fb14089aa913c3c062ed1d65d39"
        },
        "date": 1788891272301,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "vector-search-1000",
            "value": 128620.341,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-10000",
            "value": 126944.472,
            "unit": "ops/sec"
          },
          {
            "name": "vector-search-100000",
            "value": 133530.959,
            "unit": "ops/sec"
          },
          {
            "name": "agent-spawn",
            "value": 825205.472,
            "unit": "ops/sec"
          },
          {
            "name": "memory-insert",
            "value": 403011.349,
            "unit": "ops/sec"
          },
          {
            "name": "task-orchestration",
            "value": 83789.968,
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}