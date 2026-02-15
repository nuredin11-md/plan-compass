/**
 * Data Backup & Recovery Utilities for Plan Compass
 * Handles backup creation, restoration, and state recovery
 */

import type { MonthlyEntry } from "@/data/hospitalIndicators";
import { AuditLogger } from "./securityUtils";

export interface BackupMetadata {
  id: string;
  timestamp: string;
  version: string;
  dataCount: number;
  checksum: string;
  userId: string;
  description?: string;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, unknown>;
}

// ─── LOCAL STORAGE BACKUP ───
export class BackupManager {
  private static readonly BACKUP_PREFIX = "backup_";
  private static readonly METADATA_KEY = "backup_metadata";
  private static readonly MAX_BACKUPS = 5;
  private static readonly BACKUP_VERSION = "1.0.0";

  /**
   * Create a backup of current application state
   */
  static createBackup(
    dataToBackup: Record<string, unknown>,
    userId: string,
    description?: string
  ): { success: boolean; backupId?: string; error?: string } {
    try {
      const backupId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Calculate checksum
      const dataString = JSON.stringify(dataToBackup);
      const checksum = this.calculateChecksum(dataString);

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        version: this.BACKUP_VERSION,
        dataCount: Object.keys(dataToBackup).length,
        checksum,
        userId,
        description,
      };

      // Store backup data
      const backupData: BackupData = {
        metadata,
        data: dataToBackup,
      };

      localStorage.setItem(this.BACKUP_PREFIX + backupId, JSON.stringify(backupData));

      // Update metadata index
      this.updateBackupMetadata(metadata);

      // Prune old backups if limit exceeded
      this.pruneOldBackups();

      AuditLogger.logAction(userId, "CREATE_BACKUP", `backup_${backupId}`, "success", { description });

      console.log(`[BACKUP] Created backup ${backupId} for user ${userId}`);
      return { success: true, backupId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      AuditLogger.logSecurityEvent(userId, "BACKUP_FAILED", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Restore data from a backup
   */
  static restoreBackup(
    backupId: string,
    userId: string
  ): { success: boolean; data?: Record<string, unknown>; error?: string } {
    try {
      const backupJson = localStorage.getItem(this.BACKUP_PREFIX + backupId);
      if (!backupJson) {
        return { success: false, error: "Backup not found" };
      }

      const backup = JSON.parse(backupJson) as BackupData;

      // Verify checksum
      const dataString = JSON.stringify(backup.data);
      const calculatedChecksum = this.calculateChecksum(dataString);

      if (calculatedChecksum !== backup.metadata.checksum) {
        AuditLogger.logSecurityEvent(userId, "BACKUP_INTEGRITY_CHECK_FAILED", `Backup ${backupId} checksum mismatch`);
        return { success: false, error: "Backup integrity check failed" };
      }

      AuditLogger.logAction(userId, "RESTORE_BACKUP", `backup_${backupId}`, "success");

      console.log(`[BACKUP] Restored backup ${backupId} for user ${userId}`);
      return { success: true, data: backup.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      AuditLogger.logSecurityEvent(userId, "RESTORE_BACKUP_FAILED", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Schedule automatic backups
   */
  static scheduleAutoBackup(
    dataToBackup: () => Record<string, unknown>,
    userId: string,
    intervalHours: number = 24
  ): () => void {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const interval = setInterval(() => {
      try {
        const data = dataToBackup();
        this.createBackup(data, userId, `Auto-backup at ${new Date().toISOString()}`);
      } catch (error) {
        console.error("Auto-backup failed:", error);
      }
    }, intervalMs);

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * List all available backups
   */
  static listBackups(): BackupMetadata[] {
    try {
      const metadataJson = localStorage.getItem(this.METADATA_KEY);
      if (!metadataJson) return [];
      const metadata = JSON.parse(metadataJson) as BackupMetadata[];
      return metadata.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error("Failed to list backups:", error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  static deleteBackup(backupId: string, userId: string): boolean {
    try {
      localStorage.removeItem(this.BACKUP_PREFIX + backupId);

      // Update metadata
      const metadata = this.listBackups();
      const filtered = metadata.filter((m) => m.id !== backupId);
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(filtered));

      AuditLogger.logAction(userId, "DELETE_BACKUP", `backup_${backupId}`, "success");

      return true;
    } catch (error) {
      console.error("Failed to delete backup:", error);
      return false;
    }
  }

  /**
   * Export backup as JSON file
   */
  static exportBackup(backupId: string): boolean {
    try {
      const backupJson = localStorage.getItem(this.BACKUP_PREFIX + backupId);
      if (!backupJson) return false;

      const backup = JSON.parse(backupJson) as BackupData;
      const dataStr = JSON.stringify(backup, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_${backupId}.json`;
      link.click();
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error("Failed to export backup:", error);
      return false;
    }
  }

  /**
   * Import backup from JSON file
   */
  static async importBackup(file: File, userId: string): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;

      // Validate backup structure
      if (!backup.metadata || !backup.data) {
        return { success: false, error: "Invalid backup file structure" };
      }

      // Create new backup with imported data
      const result = this.createBackup(backup.data, userId, `Imported from ${file.name}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Calculate checksum for integrity verification
   */
  private static calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Update backup metadata index
   */
  private static updateBackupMetadata(metadata: BackupMetadata): void {
    const existingMetadata = this.listBackups();
    const updated = [...existingMetadata, metadata];
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
  }

  /**
   * Remove old backups when limit exceeded
   */
  private static pruneOldBackups(): void {
    const backups = this.listBackups();
    if (backups.length > this.MAX_BACKUPS) {
      const toDelete = backups.slice(this.MAX_BACKUPS);
      toDelete.forEach((backup) => {
        localStorage.removeItem(this.BACKUP_PREFIX + backup.id);
      });

      const kept = backups.slice(0, this.MAX_BACKUPS);
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(kept));
    }
  }
}

// ─── DATA SYNC & RECOVERY ───
export class DataRecovery {
  /**
   * Detect and repair data inconsistencies
   */
  static validateAndRepairData(
    data: MonthlyEntry[],
    userId: string
  ): { valid: boolean; errors: string[]; repaired: MonthlyEntry[] } {
    const errors: string[] = [];
    const repaired: MonthlyEntry[] = [];

    data.forEach((entry, index) => {
      let isValid = true;

      // Check for required fields
      if (!entry.code || typeof entry.code !== "string") {
        errors.push(`Row ${index}: Missing indicator code`);
        isValid = false;
      }

      if (entry.month === undefined || typeof entry.month !== "string") {
        errors.push(`Row ${index}: Invalid month value`);
        isValid = false;
      }

      if (entry.actual === undefined || entry.actual === null) {
        errors.push(`Row ${index}: Missing actual value`);
        isValid = false;
      } else if (typeof entry.actual === "number" && entry.actual < 0) {
        errors.push(`Row ${index}: Invalid actual value (must be positive)`);
        isValid = false;
      }

      if (isValid) {
        repaired.push(entry);
      }
    });

    AuditLogger.logAction(
      userId,
      "DATA_VALIDATION",
      "monthly_data",
      errors.length === 0 ? "success" : "failure",
      { errorCount: errors.length }
    );

    return {
      valid: errors.length === 0,
      errors,
      repaired,
    };
  }

  /**
   * Compare two datasets and identify differences
   */
  static compareDatasets(
    original: MonthlyEntry[],
    current: MonthlyEntry[]
  ): {
    added: MonthlyEntry[];
    removed: MonthlyEntry[];
    modified: { original: MonthlyEntry; current: MonthlyEntry }[];
  } {
    const added: MonthlyEntry[] = [];
    const removed: MonthlyEntry[] = [];
    const modified: { original: MonthlyEntry; current: MonthlyEntry }[] = [];

    const currentMap = new Map(
      current.map((entry) => [`${entry.code}_${entry.month}`, entry])
    );
    const originalMap = new Map(
      original.map((entry) => [`${entry.code}_${entry.month}`, entry])
    );

    // Find added and modified
    currentMap.forEach((currentEntry, key) => {
      const originalEntry = originalMap.get(key);
      if (!originalEntry) {
        added.push(currentEntry);
      } else if (JSON.stringify(originalEntry) !== JSON.stringify(currentEntry)) {
        modified.push({ original: originalEntry, current: currentEntry });
      }
    });

    // Find removed
    originalMap.forEach((originalEntry, key) => {
      if (!currentMap.has(key)) {
        removed.push(originalEntry);
      }
    });

    return { added, removed, modified };
  }

  /**
   * Merge datasets with conflict resolution
   */
  static mergeDatasets(
    local: MonthlyEntry[],
    remote: MonthlyEntry[],
    strategy: "local" | "remote" | "latest" = "latest"
  ): MonthlyEntry[] {
    const merged = new Map<string, MonthlyEntry>();

    // Add local data
    local.forEach((entry) => {
      const key = `${entry.code}_${entry.month}`;
      merged.set(key, entry);
    });

    // Merge remote data
    remote.forEach((entry) => {
      const key = `${entry.code}_${entry.month}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, entry);
      } else if (strategy === "remote") {
        merged.set(key, entry);
      } else if (strategy === "latest") {
        // For "latest" strategy, prefer the one with non-null actual value
        if (entry.actual !== null && entry.actual !== undefined) {
          merged.set(key, entry);
        }
      }
      // For "local" strategy, keep existing
    });

    return Array.from(merged.values());
  }
}

export default {
  BackupManager,
  DataRecovery,
};
