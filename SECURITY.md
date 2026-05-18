# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private security advisory feature:

1. Go to the Security tab of this repository.
2. Click "Report a vulnerability".
3. Fill in the details — what you found, steps to reproduce, potential impact.

We will acknowledge receipt within 48 hours and aim to release a fix within 14 days for critical issues.

## Scope

Vulnerabilities in scope:

- Authentication and authorisation bypasses
- Tenant data leakage (cross-tenant data access)
- HMAC signature bypass on the webhook endpoint
- SQL injection or RLS bypass via Supabase
- Secret/credential exposure via API responses

Out of scope:

- Issues in third-party services (Meta, Supabase, Upstash)
- Denial-of-service attacks
- Social engineering

## Responsible Disclosure

We appreciate responsible disclosure. Researchers who report valid vulnerabilities in good faith will be credited in the release notes (if they wish).
