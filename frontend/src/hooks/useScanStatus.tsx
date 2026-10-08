"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";
import { getApiUrl } from "@/utils/api";

interface ScanJobStatus {
  id: string;
  repository_id: string;
  status: string;
  progress: number;
  current_step: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface ScanStatusState {
  jobStatuses: Record<string, ScanJobStatus>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  fetchStatus: (repoId: string) => Promise<ScanJobStatus | null>;
  startPolling: (repoId: string) => void;
  stopPolling: (repoId: string) => void;
  stopAllPolling: () => void;
  clearRepoState: (repoId: string) => void;
}

const ScanStatusContext = createContext<ScanStatusState | null>(null);

export function ScanStatusProvider({ children }: { children: ReactNode }) {
  const [jobStatuses, setJobStatuses] = useState<Record<string, ScanJobStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});
  const activePolling = useRef<Set<string>>(new Set());
  const supabase = createClient();

  const fetchStatus = useCallback(async (repoId: string): Promise<ScanJobStatus | null> => {
    try {
      setLoading(prev => ({ ...prev, [repoId]: true }));
      setError(prev => ({ ...prev, [repoId]: null }));

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(getApiUrl(`/api/repos/${repoId}/status`), { headers });

      if (res.ok) {
        const statusData = await res.json();

        setJobStatuses(prev => {
          const current = prev[repoId];
          let shouldUpdate = true;

          if (current) {
            if (current.id !== statusData.id) {
              const currentStart = new Date(current.started_at || 0).getTime();
              const newStart = new Date(statusData.started_at || 0).getTime();
              if (newStart < currentStart) {
                shouldUpdate = false;
              }
            } else {
              if (current.status === "completed" && statusData.status !== "completed") {
                shouldUpdate = false;
              }
              if (current.status === "failed" && statusData.status !== "failed" && statusData.status !== "completed") {
                shouldUpdate = false;
              }
              if (statusData.progress < current.progress) {
                shouldUpdate = false;
              }
            }
          }

          if (!shouldUpdate) return prev;

          return {
            ...prev,
            [repoId]: statusData
          };
        });

        return statusData;
      } else {
        setError(prev => ({ ...prev, [repoId]: "Failed to fetch status" }));
        return null;
      }
    } catch (e) {
      console.error(`Error fetching status for ${repoId}:`, e);
      setError(prev => ({ ...prev, [repoId]: "Network error" }));
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [repoId]: false }));
    }
  }, [supabase]);

  const startPolling = useCallback((repoId: string) => {
    if (activePolling.current.has(repoId)) return;
    activePolling.current.add(repoId);

    const interval = setInterval(() => {
      fetchStatus(repoId);
    }, 2000);

    pollingIntervals.current[repoId] = interval;
  }, [fetchStatus]);

  const stopPolling = useCallback((repoId: string) => {
    activePolling.current.delete(repoId);
    if (pollingIntervals.current[repoId]) {
      clearInterval(pollingIntervals.current[repoId]);
      delete pollingIntervals.current[repoId];
    }
  }, []);

  const stopAllPolling = useCallback(() => {
    Object.keys(pollingIntervals.current).forEach(repoId => {
      clearInterval(pollingIntervals.current[repoId]);
    });
    pollingIntervals.current = {};
    activePolling.current.clear();
  }, []);

  const clearRepoState = useCallback((repoId: string) => {
    stopPolling(repoId);
    setJobStatuses(prev => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
    setLoading(prev => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
    setError(prev => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopAllPolling();
    };
  }, [stopAllPolling]);

  return (
    <ScanStatusContext.Provider value={{
      jobStatuses,
      loading,
      error,
      fetchStatus,
      startPolling,
      stopPolling,
      stopAllPolling,
      clearRepoState
    }}>
      {children}
    </ScanStatusContext.Provider>
  );
}

export function useScanStatus() {
  const context = useContext(ScanStatusContext);
  if (!context) {
    throw new Error("useScanStatus must be used within a ScanStatusProvider");
  }
  return context;
}
