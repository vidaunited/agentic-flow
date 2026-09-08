// Transport Router Test Suite
// Tests for protocol selection, fallback, and routing

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http2 from 'http2';
import type { AddressInfo } from 'net';
import { TransportRouter, TransportConfig } from '../../src/swarm/transport-router.js';
import { SwarmAgent, SwarmMessage } from '../../src/swarm/quic-coordinator.js';

describe('TransportRouter', () => {
  let router: TransportRouter;

  // sendViaHttp2() opens a real HTTP/2 connection and resolves only on a 200,
  // so the routing tests need something listening. Run a plaintext h2c server
  // in-process on an ephemeral port rather than depending on an external one.
  let http2Server: http2.Http2Server;
  let http2Port: number;
  const http2Sessions = new Set<http2.ServerHttp2Session>();

  beforeAll(async () => {
    http2Server = http2.createServer();
    // server.close() waits for open sessions; keep them so teardown can force
    // them shut rather than hanging until the hook times out.
    http2Server.on('session', session => http2Sessions.add(session));
    http2Server.on('stream', stream => {
      stream.on('data', () => {});
      stream.on('end', () => {
        stream.respond({ ':status': 200 });
        stream.end('{"ok":true}');
      });
    });
    await new Promise<void>(resolve => http2Server.listen(0, '127.0.0.1', resolve));
    http2Port = (http2Server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    // close() alone never calls back here: shutdown() closes the router's
    // client sessions gracefully (session.close(), not destroy()), so the
    // server can still be holding a half-closed connection and waits forever.
    // Http2Server has no closeAllConnections() — that is http.Server only — so
    // destroy the sessions we tracked and bound the wait rather than letting
    // the hook sit until vitest's 30s timeout. (No unref() — in a vitest worker
    // that lets the process exit early and the run fails with
    // 'Worker exited unexpectedly' despite every test passing.)
    for (const session of http2Sessions) session.destroy();
    http2Sessions.clear();
    await new Promise<void>(resolve => {
      const giveUp = setTimeout(resolve, 2000);
      http2Server.close(() => {
        clearTimeout(giveUp);
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (router) {
      await router.shutdown();
    }
  });

  describe('Protocol Selection', () => {
    it('should initialize with QUIC protocol', async () => {
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      expect(router.isQuicAvailable()).toBe(true);
      expect(router.getCurrentProtocol()).toBe('quic');
    });

    it('should initialize with HTTP/2 protocol', async () => {
      const config: TransportConfig = {
        protocol: 'http2',
        enableFallback: false,
        http2Config: {
          host: '127.0.0.1',
          port: http2Port,
          maxConnections: 10,
          secure: false
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      expect(router.getCurrentProtocol()).toBe('http2');
    });

    it('should auto-select protocol based on availability', async () => {
      const config: TransportConfig = {
        protocol: 'auto',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        },
        http2Config: {
          host: 'localhost',
          port: 8443,
          maxConnections: 10,
          secure: true
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const protocol = router.getCurrentProtocol();
      expect(['quic', 'http2']).toContain(protocol);
    });
  });

  describe('Transparent Fallback', () => {
    it('should fall back to HTTP/2 when a QUIC send fails', async () => {
      // initialize() does not probe connectivity — it constructs the client and
      // returns — so a bad QUIC host does NOT flip the protocol at init time.
      // The fallback lives in route(): a failed QUIC send is caught and retried
      // over HTTP/2. Assert it where it actually happens.
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'invalid-host',
          port: 9999,
          maxConnections: 10
        },
        http2Config: {
          host: '127.0.0.1',
          port: http2Port,
          maxConnections: 10,
          secure: false
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      // src/transport/quic.ts is still a placeholder ("return a mock object"),
      // so a QUIC send SUCCEEDS whatever host it is given and an unreachable
      // address cannot exercise the fallback. Fail the QUIC leg deterministically
      // so the branch under test — route()'s catch-and-retry — actually runs.
      (router as any).quicPool = {
        getConnection: async () => {
          throw new Error('simulated QUIC failure');
        },
        // shutdown() calls this; the stub must honour the whole interface it
        // replaces, not just the method under test.
        clear: async () => {}
      };

      const result = await router.route(
        { id: 'msg-fb', from: 'a', to: 'b', type: 'task', payload: {}, timestamp: Date.now() },
        { id: 'b', role: 'worker', host: '127.0.0.1', port: http2Port, capabilities: [] }
      );

      expect(result.success).toBe(true);
      expect(result.protocol).toBe('http2');
    });

    it('should report failure, not fall back, when fallback is disabled', async () => {
      // Same point as above: initialize() succeeds regardless. With fallback
      // disabled a failed QUIC send is surfaced as an unsuccessful route rather
      // than being retried over HTTP/2 — route() reports errors, never throws.
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: false,
        quicConfig: {
          host: 'invalid-host',
          port: 9999,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      // Same placeholder-QUIC caveat as the test above.
      (router as any).quicPool = {
        getConnection: async () => {
          throw new Error('simulated QUIC failure');
        },
        // shutdown() calls this; the stub must honour the whole interface it
        // replaces, not just the method under test.
        clear: async () => {}
      };

      const result = await router.route(
        { id: 'msg-nf', from: 'a', to: 'b', type: 'task', payload: {}, timestamp: Date.now() },
        { id: 'b', role: 'worker', host: 'invalid-host', port: 9999, capabilities: [] }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.protocol).not.toBe('http2');
    });
  });

  describe('Message Routing', () => {
    it('should route message via QUIC', async () => {
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const message: SwarmMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'task',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const target: SwarmAgent = {
        id: 'agent-2',
        role: 'worker',
        host: 'localhost',
        port: 4434,
        capabilities: ['compute']
      };

      const result = await router.route(message, target);
      expect(result.success).toBe(true);
      expect(result.protocol).toBe('quic');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should route message via HTTP/2', async () => {
      const config: TransportConfig = {
        protocol: 'http2',
        enableFallback: false,
        http2Config: {
          host: '127.0.0.1',
          port: http2Port,
          maxConnections: 10,
          secure: false
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const message: SwarmMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'task',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      // sendViaHttp2() dials the TARGET's host/port, not http2Config's, so the
      // target must point at the in-process server too.
      const target: SwarmAgent = {
        id: 'agent-2',
        role: 'worker',
        host: '127.0.0.1',
        port: http2Port,
        capabilities: ['compute']
      };

      const result = await router.route(message, target);
      expect(result.success).toBe(true);
      expect(result.protocol).toBe('http2');
    });
  });

  describe('Statistics', () => {
    it('should track QUIC statistics', async () => {
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const stats = router.getStats('quic');
      expect(stats).toBeDefined();
      expect(stats.protocol).toBe('quic');
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
    });

    it('should track HTTP/2 statistics', async () => {
      const config: TransportConfig = {
        protocol: 'http2',
        enableFallback: false,
        http2Config: {
          host: 'localhost',
          port: 8443,
          maxConnections: 10,
          secure: true
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const stats = router.getStats('http2');
      expect(stats).toBeDefined();
      expect(stats.protocol).toBe('http2');
    });

    it('should track all protocol statistics', async () => {
      const config: TransportConfig = {
        protocol: 'auto',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        },
        http2Config: {
          host: 'localhost',
          port: 8443,
          maxConnections: 10,
          secure: true
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const allStats = router.getStats();
      expect(allStats instanceof Map).toBe(true);
      expect(allStats.size).toBe(2);
    });
  });

  describe('Swarm Integration', () => {
    it('should initialize swarm with QUIC coordinator', async () => {
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      const coordinator = await router.initializeSwarm('test-swarm', 'mesh', 5);

      expect(coordinator).toBeDefined();
      expect((await coordinator.getState()).swarmId).toBe('test-swarm');
      expect((await coordinator.getState()).topology).toBe('mesh');
    });

    it('should get coordinator after initialization', async () => {
      const config: TransportConfig = {
        protocol: 'quic',
        enableFallback: true,
        quicConfig: {
          host: 'localhost',
          port: 4433,
          maxConnections: 10
        }
      };

      router = new TransportRouter(config);
      await router.initialize();

      await router.initializeSwarm('test-swarm', 'mesh', 5);

      const coordinator = router.getCoordinator();
      expect(coordinator).toBeDefined();
      expect((await coordinator!.getState()).swarmId).toBe('test-swarm');
    });
  });
});
