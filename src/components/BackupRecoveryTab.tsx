import { useState, useEffect } from "react";
import { type MonthlyEntry } from "@/data/hospitalIndicators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HardDrive, Download, UploadCloud, Trash2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BackupManager, DataRecovery, type BackupMetadata } from "@/lib/backupUtils";
import { AuditLogger } from "@/lib/securityUtils";

interface Props {
  monthlyData: MonthlyEntry[];
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyEntry[]>>;
}

const SYSTEM_USER = "system"; // System user for backup operations

export default function BackupRecoveryTab({ monthlyData, setMonthlyData }: Props) {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load backups on mount
  useEffect(() => {
    const loadBackups = () => {
      try {
        const backupList = BackupManager.listBackups();
        setBackups(backupList);
        AuditLogger.logAction(SYSTEM_USER, "BACKUP_LIST_LOADED", "backup_management", "success", {
          count: backupList.length,
        });
      } catch (error) {
        toast.error("Failed to load backups");
        AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_LOAD_ERROR", String(error) || "unknown_error");
      }
    };
    loadBackups();
  }, []);

  const handleCreateBackup = () => {
    setLoading(true);
    try {
      // Convert MonthlyEntry array to Record for backup
      const backupData = { monthlyData } as Record<string, unknown>;
      
      const result = BackupManager.createBackup(
        backupData,
        SYSTEM_USER,
        `Manual backup at ${new Date().toLocaleString()}`
      );

      if (result.success && result.backupId) {
        // Reload backups to show new one
        const updatedBackups = BackupManager.listBackups();
        setBackups(updatedBackups);

        toast.success("Backup created successfully");
        AuditLogger.logAction(
          SYSTEM_USER,
          "BACKUP_CREATED",
          "backup_management",
          "success",
          {
            backupId: result.backupId,
            dataCount: monthlyData.length,
          }
        );
      } else {
        toast.error(result.error || "Failed to create backup");
        AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_CREATION_FAILED", result.error || "unknown_error");
      }
    } catch (error) {
      toast.error("Failed to create backup");
      AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_CREATION_FAILED", String(error) || "unknown_error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    if (!selectedBackup) return;

    setLoading(true);
    try {
      // Get the full backup data
      const result = BackupManager.restoreBackup(selectedBackup, SYSTEM_USER);
      
      if (!result.success || !result.data) {
        toast.error(result.error || "Backup not found or corrupted");
        AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_RESTORE_FAILED", result.error || "unknown_error");
        return;
      }

      // Extract monthlyData from backup
      const backupedData = result.data.monthlyData as MonthlyEntry[] || [];

      // Validate backup data before restoring
      const validation = DataRecovery.validateAndRepairData(backupedData, SYSTEM_USER);
      if (!validation.valid) {
        toast.error(`Backup contains errors: ${validation.errors[0]}`);
        AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_VALIDATION_FAILED", `backup_id: ${selectedBackup}`);
        return;
      }

      //Restore the data
      setMonthlyData(validation.repaired);

      const backupMetadata = backups.find((b) => b.id === selectedBackup);
      toast.success(`Restored from backup: ${backupMetadata?.description || "backup"}`);
      AuditLogger.logAction(
        SYSTEM_USER,
        "BACKUP_RESTORED",
        "backup_management",
        "success",
        {
          backupId: selectedBackup,
          restoredCount: validation.repaired.length,
        }
      );

      setShowRestoreDialog(false);
    } catch (error) {
      toast.error("Failed to restore backup");
      AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_RESTORE_FAILED", `error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = () => {
    if (!selectedBackup) return;

    setLoading(true);
    try {
      const success = BackupManager.deleteBackup(selectedBackup, SYSTEM_USER);
      
      if (success) {
        setBackups((prev) => prev.filter((b) => b.id !== selectedBackup));
        toast.success("Backup deleted successfully");
        AuditLogger.logAction(
          SYSTEM_USER,
          "BACKUP_DELETED",
          "backup_management",
          "success",
          {
            backupId: selectedBackup,
          }
        );
      } else {
        toast.error("Failed to delete backup");
      }

      setSelectedBackup(null);
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error("Failed to delete backup");
      AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_DELETE_FAILED", String(error) || "unknown_error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = (backupId: string) => {
    try {
      const success = BackupManager.exportBackup(backupId);
      if (success) {
        toast.success("Backup exported successfully");
        AuditLogger.logAction(
          SYSTEM_USER,
          "BACKUP_EXPORTED",
          "backup_management",
          "success",
          {
            backupId,
          }
        );
      } else {
        toast.error("Failed to export backup");
      }
    } catch (error) {
      toast.error("Failed to export backup");
      AuditLogger.logSecurityEvent(SYSTEM_USER, "BACKUP_EXPORT_FAILED", String(error) || "unknown_error");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Create Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Create New Backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Create a backup of all your monthly data to protect against data loss.
          </p>
          <Button
            onClick={handleCreateBackup}
            disabled={loading || monthlyData.length === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Create Backup Now
          </Button>
          {monthlyData.length === 0 && (
            <p className="text-xs text-status-red mt-2">No data to backup</p>
          )}
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Available Backups ({backups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">No backups found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a backup to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-status-green flex-shrink-0" />
                      <span className="font-mono text-sm truncate">{backup.description || "Backup"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                      <span>📅 {new Date(backup.timestamp).toLocaleString()}</span>
                      <span>📊 {backup.dataCount} entries</span>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportBackup(backup.id)}
                      disabled={loading}
                      title="Download backup file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedBackup(backup.id);
                        setShowRestoreDialog(true);
                      }}
                      disabled={loading}
                      title="Restore from this backup"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedBackup(backup.id);
                        setShowDeleteDialog(true);
                      }}
                      disabled={loading}
                      title="Delete this backup"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-status-yellow-border bg-status-yellow-bg">
        <CardContent className="pt-6 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-status-yellow flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Data Protection Tips:</p>
            <ul className="text-xs space-y-1">
              <li>• Create regular backups daily to protect against data loss</li>
              <li>• Export important backups and store them securely</li>
              <li>• Always test restore functionality after creating backups</li>
              <li>• Keep encrypted backup files in a secure external location</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-yellow" />
              Restore from Backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current data with the backup. This action cannot be
              undone immediately. Make sure you have a recent backup of current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>
              <strong>Selected backup:</strong>{" "}
              {backups.find((b) => b.id === selectedBackup)?.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {backups.find((b) => b.id === selectedBackup) && new Date(backups.find((b) => b.id === selectedBackup)!.timestamp).toLocaleString()}
            </p>
          </div>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={loading}
            className="bg-status-yellow text-foreground hover:bg-status-yellow/90"
          >
            {loading ? "Restoring..." : "Restore Backup"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-red" />
              Delete Backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the backup. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>
              <strong>Backup to delete:</strong>{" "}
              {backups.find((b) => b.id === selectedBackup)?.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {backups.find((b) => b.id === selectedBackup) && new Date(backups.find((b) => b.id === selectedBackup)!.timestamp).toLocaleString()}
            </p>
          </div>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteBackup}
            disabled={loading}
            className="bg-status-red text-primary-foreground hover:bg-status-red/90"
          >
            {loading ? "Deleting..." : "Delete Backup"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
