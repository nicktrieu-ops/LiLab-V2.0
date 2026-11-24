# LiLab Creative Talent Academy — Security Specification

## 1. Data Invariants
1. **Identity & Role Integrity**: No user may self-assign `admin` or `super_admin` roles on `/users/{uid}` or `/admins/{uid}`. Only `nicktrieu@gmail.com` (verified email) or an existing `/admins/{uid}` record can manage admin roles.
2. **Email Spoofing Prevention**: Every rule inspecting `request.auth.token.email` strictly mandates `request.auth.token.email_verified == true`.
3. **PII Isolation**: `/users/{uid}`, `/teachers/{teacherId}`, `/students/{studentId}`, `/invoices/{invoiceId}`, `/payables/{payableId}`, and `/payment_methods/{methodId}` restrict reads to the verified owner, assigned teacher/parent, or verified admins. Blanket `isSignedIn()` reads on PII collections are forbidden.
4. **Immutable Audit & Ownership Fields**: `createdAt`, `uid`, `parentUid`, and `createdByUid` remain immutable after creation. Every `create` requires `createdAt == request.time` and `updatedAt == request.time`; every `update` requires `updatedAt == request.time`.
5. **Action-Based Updates & Strict Keys**: Every `create` enforces `hasAll` + `hasOnly`; every `update` validates `isValid[Entity](incoming())` and restricts mutated keys with `affectedKeys().hasOnly(...)`.
6. **Path & Size Guarding**: All document IDs match `^[a-zA-Z0-9_\-]+$` (max 128 chars), and every string and bounded array enforces explicit `.size()` ceilings.
7. **Zero-Cost List Enforcement**: Every `allow list` block evaluates `resource.data` or `request.auth.token` directly with zero `get()` or `exists()` calls.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Privilege Escalation on `/users/{uid}` Create**: Authenticated non-admin creates `/users/{uid}` with `role: "super_admin"`.
2. **Privilege Escalation on `/users/{uid}` Update**: Parent updates own `/users/{uid}` changing `role` from `"parent"` to `"admin"`.
3. **Admin Registry Injection**: Non-super-admin attempts to create `/admins/{uid}` with `level: "super_admin"`.
4. **Email Spoofing Attack**: User with `email: "nicktrieu@gmail.com"` and `email_verified: false` attempts to read `/payables` or write `/programs`.
5. **Shadow Ghost Field Attack**: Teacher updates `/assessments/{id}` injecting `"isApprovedBySuperAdmin": true`.
6. **Cross-Parent PII Read**: Parent A attempts `get` on Student B's `/students/{studentBId}` or `/invoices/{invoiceBId}`.
7. **Terminal Invoice Tampering**: Parent attempts to update `/invoices/{id}` changing `status` to `"paid"` or lowering `amountVnd` when invoice is already `"paid"`, or mutating `amountVnd` directly.
8. **Score Range Poisoning**: Teacher submits `/assessments/{id}` with `speakingScore: 999` or invalid `cefrModifier: "++"`.
9. **ID Poisoning Attack**: Attacker creates `/programs/invalid..id$$` or a 500-char document ID.
10. **Unbounded Array / Payload Exhaustion**: Attacker writes `/gemini_notes/{id}` with a 5,000-char `title` or 100 `keyVocabulary` items.
11. **Timestamp Forgery**: Client creates `/classes/{id}` with backdated `createdAt` instead of `request.time`.
12. **Blanket List Scraping**: Unrelated student or parent attempts `list` on `/payables` or `/teachers` or `/user_invites`.
