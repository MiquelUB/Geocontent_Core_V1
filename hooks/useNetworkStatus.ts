'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface NetworkStatus {
  /** True if the browser reports an active connection */
  isOnline: boolean;
  /** Effective connection type from Network Information API (4g, 3g, 2g, slow-2g) */
  connectionType: string;
  /** Measured round-trip latency in ms to the origin server */
  latencyMs: number | null;
  /** True when latencyMs > 200ms or connectionType is 2g/slow-2g */
  isSlowNetwork: boolean;
  /** Timestamp of last successful latency probe */
  lastProbeAt: number | null;
}

const LATENCY_THRESHOLD_MS = 200;
const PROBE_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Hook that monitors real-time network connectivity and latency.
 * Uses Navigator.onLine, Network Information API, and periodic
 * latency probes to determine optimal video source strategy.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: '4g',
    latencyMs: null,
    isSlowNetwork: false,
    lastProbeAt: null,
  });

  const probeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read Network Information API (experimental, Chromium-based)
  const getConnectionType = useCallback((): string => {
    if (typeof navigator === 'undefined') return '4g';
    const nav = navigator as any;
    return nav.connection?.effectiveType || '4g';
  }, []);

  // Lightweight latency probe — fetches a tiny known endpoint
  const measureLatency = useCallback(async (): Promise<number | null> => {
    try {
      const start = performance.now();
      // HEAD request to our own origin — minimal payload
      await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return Math.round(performance.now() - start);
    } catch {
      return null; // Network failure
    }
  }, []);

  // Main probe cycle
  const runProbe = useCallback(async () => {
    const connType = getConnectionType();
    const isOnline = navigator.onLine;

    if (!isOnline) {
      setStatus({
        isOnline: false,
        connectionType: connType,
        latencyMs: null,
        isSlowNetwork: true,
        lastProbeAt: Date.now(),
      });
      return;
    }

    const latency = await measureLatency();
    const isSlow =
      latency === null ||
      latency > LATENCY_THRESHOLD_MS ||
      connType === '2g' ||
      connType === 'slow-2g';

    setStatus({
      isOnline: true,
      connectionType: connType,
      latencyMs: latency,
      isSlowNetwork: isSlow,
      lastProbeAt: Date.now(),
    });
  }, [getConnectionType, measureLatency]);

  useEffect(() => {
    // Initial probe
    runProbe();

    // Periodic probing
    probeTimerRef.current = setInterval(runProbe, PROBE_INTERVAL_MS);

    // Online/offline listeners
    const handleOnline = () => runProbe();
    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isSlowNetwork: true,
        lastProbeAt: Date.now(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API change listener
    const nav = navigator as any;
    const connection = nav.connection;
    if (connection) {
      connection.addEventListener('change', runProbe);
    }

    return () => {
      if (probeTimerRef.current) clearInterval(probeTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', runProbe);
      }
    };
  }, [runProbe]);

  return status;
}
