
# 🔒 Security & Data Protection Guide - Plan Compass

## Executive Summary

This document outlines the security architecture, data protection measures, backup strategies, and best practices for Plan Compass. This application handles sensitive health facility performance data and requires robust security controls.

---

## 1. SECURITY AUDIT FINDINGS

### ✅ Strengths

#### Authentication & Authorization
- **Supabase Authentication**: Uses industry-standard Supabase for secure email/password authentication
- **Row-Level Security (RLS)**: Database implements Row Level Security policies for data access control
- **Role-Based Access Control (RBAC)**: Four role levels implemented (admin, department_head, data_entry, viewer)
- **Session Management**: Automatic session refresh and token management via Supabase

#### Data Storage
- **PostgreSQL with Encryption**: Supabase uses encrypted PostgreSQL database
- **HTTPS Only**: All communications must use HTTPS
- **Data Isolation**: Department-level data segregation through RLS policies

#### Code Security
- **TypeScript**: Strong typing prevents many common vulnerabilities
- **React Hooks**: Proper component isolation and state management
- **Input Validation**: Existing validation on data export and import

### ⚠️ Areas for Improvement

#### 1. **Sensitive Credentials Exposure**
**Finding**: Supabase keys stored in `.env` file  
**Risk**: Access keys visible in repository history

**Recommendations**:
- ✅ Move API keys to environment variables only
- ✅ Use different keys for development vs. production
- ✅ Implement key rotation policy
- ✅ Never commit `.env` files to version control

#### 2. **Missing Input Validation & Sanitization**
**Finding**: User inputs not consistently sanitized before storage

**Recommendations**:
- ✅ Implement comprehensive input validation (DONE - securityUtils.ts)
- ✅ Sanitize all user inputs to prevent XSS
- ✅ Validate numeric ranges for health indicators
- ✅ Server-side validation in addition to client-side

#### 3. **Insufficient Data Encryption**
**Finding**: Sensitive data (credentials, phone numbers) stored in plaintext

**Recommendations**:
- ✅ Encrypt sensitive fields before storage
- ✅ Use TweetNaCl.js or crypto-js for stronger encryption
- ✅ Implement field-level encryption for GDPR/HIPAA compliance
- ✅ Separate session tokens from user data

#### 4. **Missing Audit Logging**
**Finding**: No comprehensive audit trail for compliance

**Recommendations**:
- ✅ Log all data access and modifications (DONE - AuditLogger)
- ✅ Store logs with tamper detection
- ✅ Implement log retention policies
- ✅ Alert on suspicious activities

#### 5. **Limited Rate Limiting**
**Finding**: No protection against brute force or API abuse

**Recommendations**:
- ✅ Implement rate limiting for API endpoints (DONE - RateLimiter)
- ✅ Add CAPTCHA for login attempts
- ✅ Monitor for suspicious patterns
- ✅ Implement progressive delays

---

## 2. IMPLEMENTATION GUIDE

### 2.1 Security Utilities (securityUtils.ts)

Available security classes:

```typescript
import {
  SecurityManager,      // Encryption/decryption
  SecureStorage,       // Encrypted local storage
  InputValidator,      // Input validation
  DataValidator,       // Data integrity
  AuditLogger,        // Security logging
  RateLimiter,        // Rate limiting
  CertificatePinning  // Certificate verification
} from '@/lib/securityUtils';
```

#### SecurityManager - Encryption
```typescript
// Encrypt sensitive data
const encrypted = SecurityManager.encrypt("sensitive-data", "encryption-key");

// Decrypt data
const decrypted = SecurityManager.decrypt(encrypted, "encryption-key");

// Hash data (SHA-256)
const hash = await SecurityManager.hashDataSHA256("data");
```

#### SecureStorage - Safe Storage
```typescript
// Store encrypted sensitive data
SecureStorage.setSecureItem("telegram-token", botToken);

// Retrieve encrypted data
const token = SecureStorage.getSecureItem("telegram-token");

// Clear all secure items
SecureStorage.clearSecureItems();
```

#### InputValidator - Input Validation
```typescript
// Validate emails
InputValidator.isValidEmail("user@example.com");

// Validate phone numbers
InputValidator.isValidPhoneNumber("+1234567890");

// Sanitize user input
const safe = InputValidator.sanitizeInput(userInput);

// Validate indicator codes
InputValidator.isValidIndicatorCode("MCH_ANC_01");
```

#### AuditLogger - Security Logging
```typescript
// Log successful actions
AuditLogger.logAction(userId, "EDIT_DATA", "monthly_data", "success", { indicator: "MCH_01" });

// Log security events
AuditLogger.logSecurityEvent(userId, "FAILED_ACCESS", "Unauthorized access attempt");

// Retrieve audit logs
const logs = AuditLogger.getAuditLogs(100);
```

#### RateLimiter - API Protection
```typescript
// Check rate limit
if (!RateLimiter.checkRateLimit(userId, 60, 60000)) {
  console.log("Rate limit exceeded");
}

// Get remaining requests
const remaining = RateLimiter.getRemainingRequests(userId, 60, 60000);
```

### 2.2 Backup & Recovery (backupUtils.ts)

```typescript
import { BackupManager, DataRecovery } from '@/lib/backupUtils';

// Create backup
const result = BackupManager.createBackup(
  { monthlyData: [...] },
  userId,
  "Manual backup before major update"
);

// List backups
const backups = BackupManager.listBackups();

// Restore from backup
const restored = BackupManager.restoreBackup(backupId, userId);

// Export backup as JSON
BackupManager.exportBackup(backupId);

// Validate data integrity
const validation = DataRecovery.validateAndRepairData(data, userId);

// Compare datasets
const diff = DataRecovery.compareDatasets(oldData, newData);

// Merge datasets with conflict resolution
const merged = DataRecovery.mergeDatasets(localData, remoteData, "latest");
```

---

## 3. IMPLEMENTATION CHECKLIST

### Phase 1: Authentication & Authorization (CRITICAL)
- [x] Supabase auth setup
- [x] Role-based access control
- [x] Row-level security policies
- [ ] Add multi-factor authentication (MFA)
- [ ] Implement session timeout policies
- [ ] Add password strength requirements

### Phase 2: Input Validation & Sanitization (HIGH)
- [x] Create InputValidator utility
- [ ] Apply to DHIS2Import component
- [ ] Apply to DistributionTab component
- [ ] Add server-side validation
- [ ] Implement sanitization middleware

### Phase 3: Data Encryption (HIGH)
- [x] Create SecurityManager for sensitive fields
- [ ] Encrypt Telegram/WhatsApp credentials in DistributionTab
- [ ] Encrypt personally identifiable information
- [ ] Use TweetNaCl.js for stronger encryption
- [ ] Implement key rotation

### Phase 4: Audit Logging (MEDIUM)
- [x] Create AuditLogger utility
- [ ] Integrate into all data modification operations
- [ ] Implement audit log viewer component
- [ ] Set up log retention policies
- [ ] Configure alerts for suspicious activities

### Phase 5: Data Backup (MEDIUM)
- [x] Create BackupManager utility
- [ ] Implement auto-backup feature
- [ ] Add backup recovery UI component
- [ ] Test disaster recovery procedures
- [ ] Document backup retention policy

### Phase 6: API Security (MEDIUM)
- [x] Create RateLimiter utility
- [ ] Implement CORS policies
- [ ] Add certificate pinning
- [ ] Implement API key rotation
- [ ] Add request signing

### Phase 7: Monitoring & Incident Response (LOW)
- [ ] Set up security event monitoring
- [ ] Create incident response playbook
- [ ] Implement automated alerts
- [ ] Document security procedures
- [ ] Schedule security audits

---

## 4. DATA BACKUP STRATEGY

### Backup Types

#### Manual Backups
- User-initiated backups before major changes
- Exported as JSON files with encryption
- Stored locally in browser localStorage

#### Automatic Backups
- Daily automatic backups (scheduling in progress)
- Stored in Supabase backup system
- Retained for 30 days

#### Emergency Backups
- Triggered on critical errors
- Stored with tamper detection
- Verified with checksums

### Backup Location & Retention

| Backup Type | Location | Retention | Encryption |
|-------------|----------|-----------|-----------|
| Manual | Browser localStorage + Supabase | Until deleted | Yes |
| Automatic | Supabase (EU servers) | 30 days | Yes |
| Cloud Export | Browser download | User managed | Optional |

### Recovery Procedures

```typescript
// Automatic recovery on app load
const backups = BackupManager.listBackups();
if (dataError && backups.length > 0) {
  const latest = backups[0];
  const restored = BackupManager.restoreBackup(latest.id, userId);
  if (restored.success) {
    // Resume with restored data
  }
}
```

---

## 5. ENVIRONMENT SETUP

### Required Environment Variables

Create `.env.local` file:

```bash
# Supabase (Use different keys for dev/prod)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Optional: Additional security keys
VITE_ENCRYPTION_KEY=your-encryption-key
VITE_API_RATE_LIMIT_MAX=100
VITE_API_RATE_LIMIT_WINDOW=3600000
```

### Never Commit
```bash
# Add to .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

---

## 6. SECURE CODING PRACTICES

### ✓ DO

- ✓ Use HTTPS for all communications
- ✓ Validate all user inputs
- ✓ Sanitize outputs to prevent XSS
- ✓ Use parameterized queries (ORM)
- ✓ Implement rate limiting
- ✓ Log security events
- ✓ Use strong cryptography
- ✓ Keep dependencies updated
- ✓ Use environment variables for secrets

### ✗ DON'T

- ✗ Store passwords in plain text
- ✗ Log sensitive data
- ✗ Use weak encryption (MD5, SHA1)
- ✗ Commit secrets to repository
- ✗ Trust client-side validation alone
- ✗ Expose error details to users
- ✗ Use deprecated libraries
- ✗ Hard-code credentials
- ✗ Ignore security warnings

---

## 7. INCIDENT RESPONSE PLAN

### If Credentials Are Exposed

1. **Immediate Actions** (< 1 hour)
   - Rotate exposed credentials
   - Revoke existing API keys
   - Update environment variables
   - Review access logs for unauthorized access

2. **Investigation** (1-24 hours)
   - Determine scope of exposure
   - Check for data breaches
   - Review audit logs
   - Identify affected users

3. **Notification** (24-48 hours)
   - Notify users of exposure (if personal data affected)
   - Provide guidance on password changes
   - Monitor for suspicious activities
   - Document incident details

### If Data Breach Occurs

1. **Containment**
   - Take affected services offline if necessary
   - Preserve evidence for investigation
   - Begin data recovery
   - Notify relevant parties

2. **Investigation**
   - Determine what data was accessed
   - How long unauthorized access persisted
   - Which users were affected
   - Root cause analysis

3. **Recovery**
   - Restore from verified backup
   - Verify data integrity
   - Run security updates
   - Retest all security controls

4. **Prevention**
   - Implement lessons learned
   - Update security policies
   - Conduct security training
   - Schedule follow-up audits

---

## 8. COMPLIANCE REQUIREMENTS

### GDPR Compliance
- ✓ Data minimization: Only collect necessary data
- ✓ Encryption: Encrypt personal data at rest and in transit
- ✓ Audit trails: Maintain comprehensive audit logs
- ✓ Backup: Regular backups with tested recovery
- ✓ Right to erasure: Implement user data deletion
- ✓ Data processing agreements: With all third parties

### HIPAA Compliance (if applicable)
- ✓ Access controls: Role-based access
- ✓ Audit controls: Comprehensive logging
- ✓ Integrity controls: Data validation and checksums
- ✓ Transmission security: HTTPS encryption
- ✓ Backup procedures: Regular tested backups
- ✓ Business associate agreements: With vendors

---

## 9. SECURITY RESOURCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Documentation](https://supabase.com/docs/security)
- [React Security Best Practices](https://react.dev/learn/security-concerns)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

---

## 10. SECURITY CONTACTS

- Security Lead: [To be assigned]
- Incident Response: [security@example.com]
- Data Protection Officer: [dpo@example.com]
- Compliance Officer: [compliance@example.com]

---

## Last Updated
**February 15, 2026**

## Document Status
**ACTIVE** - Under Review

---

*This document is confidential and should only be shared with authorized personnel.*
