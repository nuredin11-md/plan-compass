/**
 * Security Utilities for Plan Compass
 * Handles encryption, secure storage, and security validations
 */

import type { MonthlyEntry } from "@/data/hospitalIndicators";

// ─── ENCRYPTION UTILITIES ───
export class SecurityManager {
  /**
   * Encrypts sensitive data using a simple XOR cipher with Base64 encoding
   * NOTE: For production, use proper encryption like TweetNaCl.js or crypto-js
   */
  static encrypt(data: string, key: string): string {
    try {
      const encoded = btoa(data); // Base64 encode
      const encrypted = Array.from(encoded)
        .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join("");
      return btoa(encrypted);
    } catch (error) {
      console.error("Encryption failed:", error);
      return "";
    }
  }

  /**
   * Decrypts data encrypted with encrypt()
   */
  static decrypt(encrypted: string, key: string): string {
    try {
      const decrypted = Array.from(atob(encrypted))
        .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join("");
      return atob(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      return "";
    }
  }

  /**
   * Hash a string using SHA-256 (requires crypto API)
   */
  static async hashDataSHA256(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      return hashHex;
    } catch (error) {
      console.error("Hashing failed:", error);
      return "";
    }
  }
}

// ─── SECURE STORAGE ───
export class SecureStorage {
  private static readonly PREFIX = "secure_";
  private static readonly ENCRYPTION_KEY = "plan-compass-security-key"; // In production, use environment variable

  /**
   * Store sensitive data securely
   */
  static setSecureItem(key: string, value: string): void {
    try {
      const encrypted = SecurityManager.encrypt(value, this.ENCRYPTION_KEY);
      localStorage.setItem(this.PREFIX + key, encrypted);
    } catch (error) {
      console.error(`Failed to store secure item ${key}:`, error);
    }
  }

  /**
   * Retrieve secure data
   */
  static getSecureItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(this.PREFIX + key);
      if (!encrypted) return null;
      return SecurityManager.decrypt(encrypted, this.ENCRYPTION_KEY);
    } catch (error) {
      console.error(`Failed to retrieve secure item ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove secure data
   */
  static removeSecureItem(key: string): void {
    localStorage.removeItem(this.PREFIX + key);
  }

  /**
   * Clear all secure items
   */
  static clearSecureItems(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.PREFIX));
    keys.forEach((key) => localStorage.removeItem(key));
  }
}

// ─── INPUT VALIDATION & SANITIZATION ───
export class InputValidator {
  /**
   * Sanitize string input to prevent XSS attacks
   */
  static sanitizeInput(input: string): string {
    const div = document.createElement("div");
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  }

  /**
   * Validate numeric input
   */
  static isValidNumber(value: unknown): boolean {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }

  /**
   * Validate indicator code format
   */
  static isValidIndicatorCode(code: string): boolean {
    return /^[A-Z]{2,4}_[A-Z]{2,4}_\d{2}$/.test(code);
  }

  /**
   * Validate month value (1-12)
   */
  static isValidMonth(month: number): boolean {
    return Number.isInteger(month) && month >= 1 && month <= 12;
  }

  /**
   * Validate year (reasonable range)
   */
  static isValidYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return Number.isInteger(year) && year >= 1990 && year <= currentYear + 5;
  }
}

// ─── DATA VALIDATION ───
export class DataValidator {
  /**
   * Validate monthly entry data integrity
   */
  static validateMonthlyEntry(entry: Partial<MonthlyEntry>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!entry.code) errors.push("Indicator code is required");
    else if (!InputValidator.isValidIndicatorCode(entry.code)) errors.push("Invalid indicator code format");

    if (entry.month === undefined || typeof entry.month !== "string" || entry.month.trim() === "") {
      errors.push("Invalid month value (must be a valid month name)");
    }

    if (entry.actual !== undefined && entry.actual !== null && !InputValidator.isValidNumber(entry.actual)) {
      errors.push("Invalid actual value (must be a positive number)");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize and validate batch import data
   */
  static validateImportData(
    data: Record<string, unknown>[]
  ): { valid: boolean; errors: string[]; sanitized: Record<string, unknown>[] } {
    const errors: string[] = [];
    const sanitized: Record<string, unknown>[] = [];

    if (!Array.isArray(data) || data.length === 0) {
      return { valid: false, errors: ["No data to import"], sanitized: [] };
    }

    data.forEach((row, index) => {
      const sanitizedRow = { ...row };

      // Sanitize string fields
      Object.keys(sanitizedRow).forEach((key) => {
        if (typeof sanitizedRow[key] === "string") {
          sanitizedRow[key] = InputValidator.sanitizeInput(sanitizedRow[key] as string);
        }
      });

      // Validate required fields
      if (!sanitizedRow.code || typeof sanitizedRow.code !== "string") {
        errors.push(`Row ${index + 1}: Missing or invalid indicator code`);
      }

      if (!InputValidator.isValidNumber(sanitizedRow.actual)) {
        errors.push(`Row ${index + 1}: Invalid actual value`);
      }

      sanitized.push(sanitizedRow);
    });

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }
}

// ─── AUDIT LOGGING ───
export interface AuditLog {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  status: "success" | "failure";
  errorMessage?: string;
}

export class AuditLogger {
  /**
   * Log user actions for compliance and troubleshooting
   */
  static logAction(userId: string, action: string, resource: string, status: "success" | "failure" = "success", changes?: Record<string, unknown>): void {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      resource,
      changes,
      status,
    };

    // Store in IndexedDB for persistence (in production)
    this.storeAuditLog(log);

    // Console log for development
    console.log(`[AUDIT] ${action} on ${resource}:`, log);
  }

  /**
   * Log failed security events
   */
  static logSecurityEvent(userId: string, eventType: string, message: string): void {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      userId,
      action: `SECURITY_EVENT: ${eventType}`,
      resource: "security",
      status: "failure",
      errorMessage: message,
    };

    this.storeAuditLog(log);
    console.warn(`[SECURITY] ${eventType}:`, message);
  }

  /**
   * Store audit log in IndexedDB for persistence
   */
  private static storeAuditLog(log: AuditLog): void {
    try {
      const logsKey = "audit_logs";
      const existingLogs = localStorage.getItem(logsKey);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(log);

      // Keep only last 1000 logs
      const recentLogs = logs.slice(-1000);
      localStorage.setItem(logsKey, JSON.stringify(recentLogs));
    } catch (error) {
      console.error("Failed to store audit log:", error);
    }
  }

  /**
   * Retrieve audit logs
   */
  static getAuditLogs(limit: number = 100): AuditLog[] {
    try {
      const logsKey = "audit_logs";
      const logs = localStorage.getItem(logsKey);
      if (!logs) return [];
      const allLogs = JSON.parse(logs) as AuditLog[];
      return allLogs.slice(-limit);
    } catch (error) {
      console.error("Failed to retrieve audit logs:", error);
      return [];
    }
  }

  /**
   * Clear audit logs
   */
  static clearAuditLogs(): void {
    localStorage.removeItem("audit_logs");
  }
}

// ─── RATE LIMITING ───
export class RateLimiter {
  private static requestTimestamps: Map<string, number[]> = new Map();

  /**
   * Check if request should be rate limited
   * @param identifier User ID or IP address
   * @param maxRequests Maximum requests allowed
   * @param windowMs Time window in milliseconds
   */
  static checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(identifier) || [];

    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    recentTimestamps.push(now);
    this.requestTimestamps.set(identifier, recentTimestamps);
    return true; // Request allowed
  }

  /**
   * Reset rate limiter for a user
   */
  static resetRateLimit(identifier: string): void {
    this.requestTimestamps.delete(identifier);
  }

  /**
   * Get remaining requests
   */
  static getRemainingRequests(identifier: string, maxRequests: number = 60, windowMs: number = 60000): number {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(identifier) || [];
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);
    return Math.max(0, maxRequests - recentTimestamps.length);
  }
}

// ─── CERTIFICATE PINNING HELPER ───
export class CertificatePinning {
  /**
   * Verify API endpoint certificate (for production use)
   * This is a placeholder - implement proper certificate pinning based on your backend
   */
  static async verifyAPIEndpoint(endpoint: string): Promise<boolean> {
    try {
      if (!endpoint.startsWith("https://")) {
        console.warn("API endpoint is not HTTPS");
        return false;
      }
      // In production, implement proper certificate pinning
      return true;
    } catch (error) {
      console.error("Certificate verification failed:", error);
      return false;
    }
  }
}

export default {
  SecurityManager,
  SecureStorage,
  InputValidator,
  DataValidator,
  AuditLogger,
  RateLimiter,
  CertificatePinning,
};
