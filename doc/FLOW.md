# Loyalty platform – how the flow works

## Login (single page, phone + OTP)

- **One login page:** Enter phone → Send OTP → Enter OTP → Sign in.
- Backend looks up phone in **User** (platform) or **Staff**. Sends OTP (dev: `1111`).
- **POST /auth/login** with phone + OTP returns either `user` (Admin/Owner) or `staff` (Seller) and JWT.
- Frontend redirects by role: SUPER_ADMIN → /admin/dashboard, PARTNER_OWNER → /owner/dashboard, STAFF → /seller/dashboard.

---

## Roles and flows

### 1. Super Admin

- **Login:** `/login` with seeded phone `+15550000000` and password.
- **Flow:** Add Partners (businesses). Each partner has an owner (platform user). Super Admin can create partners and assign owner.
- **Screens:** Dashboard (partners list), Partners (add/edit partners).

### 2. Store Owner (Partner Owner)

- **Login:** Same `/login` with phone + password (must be a user with role `PARTNER_OWNER`).
- **Flow:** Manage *their* businesses: add Branches, add Staff (sellers) per branch.
- **Screens:** Dashboard (my businesses & branches), Branches, Staff.

### 3. Seller (Staff)

- **Login:** `/staff-login` with **phone + password** (staff account created by Store Owner).
- **Flow:** See pending check-ins for their branch; Approve or Reject. Real-time via WebSocket optional.
- **Screens:** Dashboard (pending list), Approve (single check-in approve/reject).

### 4. Customer (User)

- **No app login.** Customer goes to store, scans QR (or opens `/scan/:storeId`).
- **Flow:**
  1. **Register:** Enter phone + OTP (dummy OTP `1111`). Creates/links customer to that branch.
  2. **Check-in:** Submit check-in (optional amount). Status is PENDING.
  3. **Seller** approves → streak increments. When streak hits threshold (e.g. 20), customer gets a **Reward** (expiry **30 days**).
  4. Customer can view streaks/rewards at `/me` by entering phone.

---

## Reward expiry: 30 days

When a check-in is approved and the streak reaches the branch threshold, one reward is created. Its **expiry date is 30 days** from creation. After 30 days the reward is expired (logic can treat as invalid for redemption if needed).

---

## Summary

| Who           | Login              | Main actions                          |
|---------------|--------------------|----------------------------------------|
| Super Admin   | Phone + password   | Add Partners                           |
| Store Owner   | Phone + password   | Add Branches, add Staff                |
| Seller        | Phone + password   | Approve / Reject check-ins             |
| Customer      | No login (phone+OTP at store) | Register, Check-in, view streaks/rewards |

All authenticated roles use **phone number** (no email) for login. Rewards expire in **30 days**.
