/**
 * Security Utilities for Plan Compass
 * Handles input validation, data validation, and audit logging
 */

import type { MonthlyEntry } from "@/data/hospitalIndicators";
import { supabase } from "@/integrations/supabase/client";

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
   * Validate Telegram Chat ID format
   * Personal chat: positive integer, Group/Channel: negative integer
   */
  static isValidTelegramChatId(chatId: string): boolean {
    const chatIdRegex = /^-?\d+$/;
    if (!chatIdRegex.test(chatId)) return false;
    const numericId = parseInt(chatId, 10);
    return numericId >= -10000000000000 && numericId <= 10000000000;
  }

  /**
   * Validate Telegram Bot Token format
   */
  static isValidTelegramBotToken(token: string): boolean {
    return /^\d{8,10}:[A-Za-z0-9_-]{35}$/.test(token);
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

// ─── SECURE STORAGE (non-sensitive preferences only) ───
export class SecureStorage {
  private static readonly PREFIX = "app_";

  /**
   * Store non-sensitive UI preferences in localStorage
   * NOTE: Do NOT use for API tokens, passwords, or secrets
   */
  static setSecureItem(key: string, value: string): void {
    try {
      localStorage.setItem(this.PREFIX + key, value);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`Failed to store item ${key}:`, error);
      }
    }
  }

  /**
   * Retrieve stored preference
   */
  static getSecureItem(key: string): string | null {
    try {
      return localStorage.getItem(this.PREFIX + key);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`Failed to retrieve item ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * Remove stored item
   */
  static removeSecureItem(key: string): void {
    localStorage.removeItem(this.PREFIX + key);
  }

  /**
   * Clear all app items
   */
  static clearSecureItems(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.PREFIX));
    keys.forEach((key) => localStorage.removeItem(key));
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

      Object.keys(sanitizedRow).forEach((key) => {
        if (typeof sanitizedRow[key] === "string") {
          sanitizedRow[key] = InputValidator.sanitizeInput(sanitizedRow[key] as string);
        }
      });

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

// ─── AUDIT LOGGING (database-backed) ───
export interface AuditLog {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  changes?: Record<string, unknown>;
  status: "success" | "failure";
  errorMessage?: string;
}

export class AuditLogger {
  /**
   * Log user actions to database for compliance and troubleshooting
   */
  static logAction(
    userId: string,
    action: string,
    resource: string,
    status: "success" | "failure" = "success",
    changes?: Record<string, unknown>
  ): void {
    // Fire-and-forget insert to audit_logs table
    supabase
      .from("audit_logs")
      .insert({
        user_id: userId === "system" ? null : userId,
        action,
        resource,
        changes: changes ? changes : undefined,
        status,
      })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.error("[AUDIT] Failed to log:", error.message);
        }
      });

    if (import.meta.env.DEV) {
      console.log(`[AUDIT] ${action} on ${resource}`);
    }
  }

  /**
   * Log failed security events
   */
  static logSecurityEvent(userId: string, eventType: string, message: string): void {
    supabase
      .from("audit_logs")
      .insert({
        user_id: userId === "system" ? null : userId,
        action: `SECURITY_EVENT: ${eventType}`,
        resource: "security",
        status: "failure",
        error_message: message,
      })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.error("[AUDIT] Failed to log security event:", error.message);
        }
      });

    if (import.meta.env.DEV) {
      console.warn(`[SECURITY] ${eventType}:`, message);
    }
  }
}

// ─── RATE LIMITING ───
export class RateLimiter {
  private static requestTimestamps: Map<string, number[]> = new Map();

  static checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(identifier) || [];
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      return false;
    }

    recentTimestamps.push(now);
    this.requestTimestamps.set(identifier, recentTimestamps);
    return true;
  }

  static resetRateLimit(identifier: string): void {
    this.requestTimestamps.delete(identifier);
  }

  static getRemainingRequests(identifier: string, maxRequests: number = 60, windowMs: number = 60000): number {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(identifier) || [];
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);
    return Math.max(0, maxRequests - recentTimestamps.length);
  }
}

export default {
  InputValidator,
  SecureStorage,
  DataValidator,
  AuditLogger,
  RateLimiter,
};
