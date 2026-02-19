# Loyalty platform – linked flow

One login (phone + OTP). Roles: Super Admin → Store Owner → Seller → Customer (no login). Everything connects through **branch** and **phone**.

---

## 1. Login (everyone except customer)

| Step | Where | What |
|------|--------|------|
| 1 | **/login** | Enter phone → **Send OTP** |
| 2 | Same page | Enter OTP (dev: `1111`) → **Sign in** |
| 3 | Backend | Looks up phone in **User** or **Staff** → returns JWT + `user` or `staff` |
| 4 | Frontend | Redirect by role: **SUPER_ADMIN** → /admin/dashboard, **PARTNER_OWNER** → /owner/dashboard, **STAFF** → /seller/dashboard |

**API:** `POST /auth/send-otp` { phone } → then `POST /auth/login` { phone, otp }.

**Creating a partner (store owner):** Register with **phone + store name** first. Then use that **same phone** to login.

| Step | Where | What |
|------|--------|------|
| 1 | **/register-partner** | Enter phone → **Send OTP** (backend sends OTP for unknown phones) |
| 2 | Same page | Enter OTP + **Store name** → **Register** |
| 3 | Backend | Creates **User** (PARTNER_OWNER) + **Partner** (businessName, ownerId) → returns JWT |
| 4 | Frontend | Logged in → redirect to /owner/dashboard |

From then on, that **phone number** is used to login at /login (Send OTP → Enter OTP → Sign in).

**API:** `POST /auth/send-otp` { phone } (works for unknown phones → partner_registration) → `POST /auth/register-partner` { phone, otp, businessName [, industryType] }.

---

## 2. Setup flow (Admin → Owner → Seller)

How the app is set up before any customer scans.

```
Partner (Store Owner) creation
    ├─ Self-register: /register-partner → phone + OTP + store name → User + Partner created → login with that phone
    └─ Or Admin: /admin/partners → Add Partner with owner phone + business name → that phone can then login

Super Admin (/admin)
    │
    └─ Partners → Add business with owner phone (optional; owners can self-register at /register-partner)

Store Owner (/owner)  ← login with phone (OTP), role PARTNER_OWNER
    │
    ├─ Dashboard → See my businesses & branches
    ├─ Branches → Add branch (e.g. "Main Branch") + see details + QR per branch
    │     API: POST /branches { branchName, partnerId [, settings, location] }
    │     Each branch card shows: name, ID, partner, staff count, settings, location, QR (scan URL)
    │
    └─ Staff → Add seller per branch (phone + password for their login)
          API: POST /staff { name, phone, password, branchId }

Seller (/seller)  ← same /login, role STAFF
    │
    ├─ Dashboard → Pending check-ins (live via WebSocket)
    ├─ Approve → Open a request → Enter amount → Approve / Reject
    ├─ History → Past approved/rejected check-ins
    └─ QR → Show store QR so customers can scan (same URL as owner’s branch QR)
```

**Link:** Branch ID is the same everywhere. Owner sees it on **Branches** (and QR). Seller’s **QR** tab encodes `{origin}/scan/{branchId}`.

---

## 3. Customer flow (minimal work – check registered → amount → submit)

Branch ID comes from URL param (hidden). User does minimal steps.

```
Customer at store
    │
    ├─ Scans QR → Opens /scan/{branchId}   (branchId in param, never shown)
    │
    ├─ Step 1: Enter phone → "Continue"
    │     API: GET /customers/phone/:phoneNumber
    │     → If found: user is registered → go to Step 3 (check-in).
    │     → If not found: go to Step 2 (register).
    │
    ├─ Step 2: Register (only if not in DB)
    │     Page: Phone (pre-filled) + OTP (1111) → "Register"
    │     API: POST /customers/register { branchId, phoneNumber, otp }
    │     → Then go to Step 3.
    │
    ├─ Step 3: Amount + Submit
    │     Page: Amount input → "Submit"
    │     API: POST /activity/check-in { branchId, phoneNumber, value }
    │     → Activity PENDING with customer’s requested amount.
    │     → WebSocket: new_checkin_request to branch room.
    │     → Done. "Staff will verify amount and approve."
    │
    ├─ Seller: cross-check and approve/reject
    │     Dashboard (live) → open request → sees "Requested amount: $X"
    │     → Amount field pre-filled; seller confirms or overrides → Approve / Reject
    │     API: PATCH /activity/:id { status: "APPROVED"|"REJECTED", value? }
    │     → Streak/reward logic; checkin_updated via WebSocket.
    │
    └─ Customer later: /me → Enter phone → See streaks & rewards
```

**Link:** branchId from param only. Phone used to check registration and in check-in. Seller cross-checks requested amount and approves or rejects.

---

## 4. Flow diagram (how it links)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETUP (once)                                                                │
│  Admin → Partners → Owner → Branches + Staff → Seller logs in, shows QR      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER VISIT                                                              │
│  1. Scan QR (/scan/{branchId})                                               │
│  2. Phone + OTP → Register (POST /customers/register)                        │
│  3. Check in (POST /activity/check-in)  →  PENDING                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    WebSocket: new_checkin_request
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SELLER                                                                      │
│  Dashboard shows new row → Approve → Enter amount → PATCH /activity/:id      │
│  APPROVED  →  streak++, maybe reward (30d expiry)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    WebSocket: checkin_updated
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER (anytime)                                                          │
│  /me → Enter phone → See streaks & rewards                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Routes quick reference

| Role        | Entry        | Main routes |
|-------------|-------------|-------------|
| **Anyone**  | /login      | Phone + OTP → redirect by role |
| **Customer**| Scan QR or /scan, /scan/:storeId | Register → Check-in → /me (streaks & rewards) |
| **Super Admin** | /admin/dashboard | /admin/partners |
| **Store Owner** | /owner/dashboard | /owner/branches (details + QR), /owner/staff |
| **Seller**  | /seller/dashboard | /seller/approve, /seller/history, /seller/qr |

---

## 6. Seed users (dev)

| Role        | Phone         | OTP   | After login goes to      |
|-------------|---------------|-------|---------------------------|
| Super Admin | +15550000001  | 1111  | /admin/dashboard         |
| Store Owner | +15550000002  | 1111  | /owner/dashboard         |
| Seller      | +15550000003  | 1111  | /seller/dashboard        |

---

## 7. Summary

- **Login:** One page (/login), phone + OTP for Admin, Owner, Seller. Redirect by role.
- **Setup:** Admin adds Partners → Owner adds Branches (with details + QR) and Staff → Seller uses same branch QR.
- **Customer:** Scan QR → branchId in URL (hidden). Enter phone → if not registered, Register (phone + OTP) → then Amount + Submit. Seller cross-checks requested amount, confirms or overrides, Approve/Reject. Customer sees streaks & rewards at /me.
- **Rewards:** Created when approved check-in hits branch streak threshold. Expiry **30 days**.
