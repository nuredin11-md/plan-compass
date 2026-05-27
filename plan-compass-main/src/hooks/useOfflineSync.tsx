import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  saveSyncMetadata,
  getSyncMetadata,
  saveMonthlyDataOffline,
  getMonthlyDataOffline,
  setupOnlineAvailabilityListeners,
  updateSyncQueueItem,
  isOfflineMode,
  saveToLocalStorage,
  getFromLocalStorage,
} from "@/lib/offlineStorage";
import type { MonthlyData } from "@/hooks/useDatabase";
import { AuditLogger } from "@/lib/securityUtils";
import { toast } from "sonner";

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  pendingSyncCount: number;
  manualSync: () => Promise<void>;
  isDatabaseAvailable: boolean;
}

const SYNC_INDICATOR_KEY = "plan_compass_sync_status";
const LAST_SYNC_TIME_KEY = "plan_compass_last_sync";

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isDatabaseAvailable, setIsDatabaseAvailable] = useState(true);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check database availability
  useEffect(() => {
    const checkDatabaseAvailability = async () => {
      try {
        const { error } = await supabase.from("monthly_data").select("*").limit(1);
        setIsDatabaseAvailable(!error);
      } catch {
        setIsDatabaseAvailable(false);
      }
    };

    checkDatabaseAvailability();
  }, [isOnline]);

  // Get pending sync count
  useEffect(() => {
    const getPendingCount = async () => {
      try {
        const queue = await getSyncQueue();
        setPendingSyncCount(queue.length);
      } catch (error) {
        console.error("Failed to get pending sync count:", error);
      }
    };

    getPendingCount();
  }, []);

  // Handle online/offline status changes
  useEffect(() => {
    const unsubscribe = setupOnlineAvailabilityListeners(
      () => {
        setIsOnline(true);
        setSyncError(null);
        toast.success("Back online - syncing data");
      },
      () => {
        setIsOnline(false);
        toast.info("Offline - changes will sync when online");
      }
    );

    return unsubscribe;
  }, []);

  // Sync monthly data
  const syncMonthlyData = useCallback(
    async (data: MonthlyData): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("monthly_data")
          .upsert(
            {
              year: data.year,
              month: data.month,
              indicator_code: data.indicator_code,
              actual: data.actual,
              remarks: data.remarks,
              entered_by: data.entered_by,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "year,month,indicator_code",
            }
          );

        if (error) {
          throw error;
        }

        // Save to offline storage as well
        await saveMonthlyDataOffline(data);
        return true;
      } catch (error) {
        console.error("Failed to sync monthly data:", error);
        throw error;
      }
    },
    []
  );

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    if (!isOnline || !isDatabaseAvailable) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncError(null);

      const queue = await getSyncQueue();

      if (queue.length === 0) {
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const item of queue) {
        try {
          if (item.type === "monthly_data" && (item.action === "create" || item.action === "update")) {
            await syncMonthlyData(item.data as MonthlyData);
            await removeFromSyncQueue(item.id);
            successCount++;
          }
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          // Increment retries and update error message
          if (item.retries < 3) {
            await updateSyncQueueItem(item.id, {
              retries: item.retries + 1,
              lastError: errorMessage,
            });
          } else {
            // Remove after 3 failed attempts
            await removeFromSyncQueue(item.id);
            AuditLogger.logSecurityEvent(
              "system",
              "SYNC_FAILED_MAX_RETRIES",
              `Item: ${item.id}, Error: ${errorMessage}`
            );
          }
        }
      }

      await saveSyncMetadata(LAST_SYNC_TIME_KEY, new Date().toISOString());
      const updatedQueue = await getSyncQueue();
      setPendingSyncCount(updatedQueue.length);

      if (successCount > 0) {
        toast.success(`Synced ${successCount} changes`);
        AuditLogger.logAction("system", "MANUAL_SYNC", "offline_sync", "success", {
          syncedCount: successCount,
          timestamp: new Date().toISOString(),
        });
      }

      if (failureCount > 0) {
        setSyncError(`Failed to sync ${failureCount} items. Retrying...`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setSyncError(message);
      console.error("Error processing sync queue:", error);
      AuditLogger.logSecurityEvent("system", "SYNC_QUEUE_ERROR", message);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isDatabaseAvailable, syncMonthlyData]);

  // Manual sync trigger
  const manualSync = useCallback(async () => {
    await processSyncQueue();
  }, [processSyncQueue]);

  // Auto-sync when coming online or periodically
  useEffect(() => {
    if (isOnline && isDatabaseAvailable) {
      // Immediate sync when coming online
      processSyncQueue();

      // Set up periodic sync every 30 seconds if there are pending items
      syncIntervalRef.current = setInterval(async () => {
        const queue = await getSyncQueue();
        if (queue.length > 0) {
          processSyncQueue();
        }
      }, 30000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [isOnline, isDatabaseAvailable, processSyncQueue]);

  // Restore sync status from localStorage
  useEffect(() => {
    const savedStatus = getFromLocalStorage<{ isOnline: boolean }>(SYNC_INDICATOR_KEY);
    if (savedStatus) {
      setIsOnline(savedStatus.isOnline);
    }

    // Save current sync status
    saveToLocalStorage(SYNC_INDICATOR_KEY, { isOnline });
  }, [isOnline]);

  return {
    isOnline,
    isSyncing,
    syncError,
    pendingSyncCount,
    manualSync,
    isDatabaseAvailable,
  };
}
