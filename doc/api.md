# Streak Loyalty API

Base URL: `http://localhost:3000` (or `PORT` env)

Swagger UI: `/api/docs`

---

## Auth

### POST /auth/staff/login

Staff login. Returns JWT for protected routes.

**Request body**

```json
{
  "phone": "+15551234567",
  "password": "secret123"
}
```

| Field     | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| phone    | string | yes      | Staff phone        |
| password | string | yes      | Min length 6       |

**Response**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "staff": {
    "id": "uuid",
    "name": "John",
    "phone": "+15551234567",
    "branchId": "uuid"
  }
}
```

---

## Partners

### POST /partners

**Request body**

```json
{
  "businessName": "Acme Cafe",
  "industryType": "F&B",
  "ownerId": "user-uuid"
}
```

| Field        | Type   | Required |
|-------------|--------|----------|
| businessName| string | yes      |
| industryType| string | yes      |
| ownerId     | string | yes      |

**Response:** Partner object (id, businessName, industryType, ownerId)

---

### GET /partners

**Response:** Array of Partner

---

### GET /partners/:id

**Response:** Partner with branches

---

### PATCH /partners/:id

**Request body** (all optional)

```json
{
  "businessName": "New Name",
  "industryType": "Salon"
}
```

**Response:** Updated Partner

---

### DELETE /partners/:id

**Response:** Deleted Partner

---

## Branches

### POST /branches

**Request body**

```json
{
  "branchName": "Downtown Branch",
  "partnerId": "partner-uuid",
  "settings": { "streakThreshold": 20, "cooldownHours": 18 },
  "location": { "lat": 40.7, "lng": -74.0 }
}
```

| Field      | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| branchName | string | yes      |                                      |
| partnerId  | string | yes (UUID)|                                     |
| settings   | object | no       | e.g. streakThreshold, cooldownHours  |
| location   | object | no       | { lat, lng } for geofencing          |

**Response:** Branch object

---

### GET /branches

**Response:** Array of Branch

---

### GET /branches/:id

**Response:** Branch with partner and staff

---

### PATCH /branches/:id

**Request body** (all optional)

```json
{
  "branchName": "New Branch Name",
  "settings": { "streakThreshold": 15 },
  "location": { "lat": 40.71, "lng": -74.01 }
}
```

**Response:** Updated Branch

---

### DELETE /branches/:id

**Response:** Deleted Branch

---

## Staff

### POST /staff

**Request body**

```json
{
  "name": "Jane Doe",
  "phone": "+15551234567",
  "password": "secret123",
  "branchId": "branch-uuid"
}
```

| Field    | Type   | Required | Description   |
|----------|--------|----------|---------------|
| name     | string | yes      |               |
| phone    | string | yes      |               |
| password | string | yes      | Min length 6  |
| branchId | string | yes (UUID)|               |

**Response:** Staff object (id, name, phone, branchId; password omitted)

---

### GET /staff

**Response:** Array of Staff (no password)

---

### GET /staff/:id

**Response:** Staff with branch (no password)

---

### PATCH /staff/:id

**Request body** (all optional)

```json
{
  "name": "New Name",
  "phone": "+15559999999",
  "password": "newsecret"
}
```

**Response:** Updated Staff (no password)

---

### DELETE /staff/:id

**Response:** Deleted Staff

---

## Customers

### POST /customers

**Request body**

```json
{
  "phoneNumber": "+15551234567"
}
```

| Field       | Type   | Required |
|------------|--------|----------|
| phoneNumber| string | yes      |

**Response:** Customer object (phoneNumber as primary key). Upserts by phone.

---

### GET /customers

**Response:** Array of Customer

---

### GET /customers/phone/:phoneNumber

**Response:** Customer with streaks and rewards (by phone)

---

### GET /customers/:phoneNumber

**Response:** Customer by primary key (phoneNumber) with streaks and rewards

---

## Activity

### POST /activity/check-in

Creates a PENDING check-in. Cooldown applies per partner. Emits `new_checkin_request` to WebSocket room `branch_{branchId}`.

**Request body**

```json
{
  "branchId": "branch-uuid",
  "phoneNumber": "+15551234567",
  "value": 25.50,
  "requestLocation": { "lat": 40.7, "lng": -74.0 }
}
```

| Field          | Type   | Required | Description                    |
|----------------|--------|----------|--------------------------------|
| branchId       | string | yes (UUID)|                                |
| phoneNumber    | string | yes      | Customer phone                 |
| value          | number | no       | Transaction amount             |
| requestLocation| object | no       | { lat, lng } for geofencing    |

**Response**

```json
{
  "id": "uuid",
  "customerId": "+15551234567",
  "branchId": "uuid",
  "staffId": null,
  "status": "PENDING",
  "value": 25.5,
  "requestLocation": { "lat": 40.7, "lng": -74.0 },
  "createdAt": "2025-02-19T...",
  "customer": { ... },
  "branch": { ... },
  "locationFlagDistant": false
}
```

`locationFlagDistant`: true if request location > 500m from branch location (POC geofencing).

---

### GET /activity

**Response:** Array of Activity with customer, branch, staff

---

### GET /activity/:id

**Response:** Activity with customer, branch, staff

---

### PATCH /activity/:id

Approve or reject a PENDING check-in. **Requires Bearer token (Staff JWT).**

**Request body**

```json
{
  "status": "APPROVED"
}
```

| Field  | Type   | Required | Allowed    |
|--------|--------|----------|------------|
| status | string | yes      | APPROVED, REJECTED |

**Response (APPROVED):** Activity + streak + rewardCreated/reward when threshold met

**Response (REJECTED):** Updated Activity

---

## Rewards

### GET /rewards

**Response:** Array of Reward

---

### GET /rewards/customer/:customerId

**Note:** `customerId` is the customer's phone number (primary key).

**Response:** Array of Reward for that customer with partner

---

### GET /rewards/:id

**Response:** Reward with customer and partner

---

### PATCH /rewards/:id/redeem

**Response:** Reward with status REDEEMED

---

## App

### GET /

**Response:** string (e.g. hello from AppService)

---

## WebSocket

- **Namespace:** default (`/`)
- **Connect with branch:** `?branchId=<branch-uuid>` to join room `branch_{branchId}`
- **Event to join room:** `join_branch` with payload `{ "branchId": "uuid" }`
- **Server event:** `new_checkin_request` — emitted to room when POST /activity/check-in succeeds; payload is the created activity object
