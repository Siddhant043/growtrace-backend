# GrowTrace API Testing Flows (Postman)

This document provides a complete, runnable Postman flow for testing:

- Email auth (`signup` / `login`)
- Google auth (`signup` / `login`)
- Link creation
- Redirect + click tracking
- Dashboard API
- Analytics APIs (enhanced)
- Common negative/edge cases

---

## 1) Prerequisites

- Backend server is running (default: `http://localhost:8000`)
- MongoDB is connected
- For Google flows:
  - Server has `GOOGLE_OAUTH_CLIENT_ID` configured
  - You have a valid Google `idToken`

---

## 2) Postman Environment Setup

Create a Postman environment with these variables:

- `baseUrl` = `http://localhost:8000`
- `authToken` = (leave empty initially)
- `shortCode` = (leave empty initially)
- `linkId` = (leave empty initially)

Optional:

- `testEmail` = `creator1@example.com`
- `testPassword` = `Test@12345`

---

## 3) Folder Structure in Postman (Recommended)

Create folders in this order:

1. `Auth - Email`
2. `Auth - Google`
3. `Links`
4. `Redirect Tracking`
5. `Dashboard`
6. `Analytics`
7. `Negative Tests`

---

## 4) Auth - Email Flows

### 4.1 Email Signup

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/signup`
- Headers:
  - `Content-Type: application/json`
- Body (raw JSON):

```json
{
  "authType": "email",
  "fullName": "Test Creator",
  "email": "creator1@example.com",
  "password": "Test@12345"
}
```

**Expected**

- Status: `201 Created`
- Response contains:
  - `success: true`
  - `token`
  - `user`

**Postman Tests (optional)**

```javascript
pm.test("Email signup success", function () {
  pm.response.to.have.status(201);
});

const body = pm.response.json();
pm.environment.set("authToken", body.token);
```

---

### 4.2 Email Login

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/login`
- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "authType": "email",
  "email": "creator1@example.com",
  "password": "Test@12345"
}
```

**Expected**

- Status: `200 OK`
- Response contains:
  - `success: true`
  - `token`
  - `user`

**Postman Tests**

```javascript
pm.test("Email login success", function () {
  pm.response.to.have.status(200);
});

const body = pm.response.json();
pm.environment.set("authToken", body.token);
```

---

### 4.3 Forgot Password

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/forgot-password`
- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "email": "creator1@example.com"
}
```

**Expected**

- Status: `200 OK`
- Response:
  - `success: true`
  - `message: "If an account exists, reset instructions were sent."`

**Notes**

- The endpoint always returns a generic success message to avoid email enumeration.
- If the account exists, a reset link is sent with a `secret` query parameter.
- Reset secret TTL: 10 minutes.

---

### 4.4 Reset Password

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/reset-password?secret=<RESET_SECRET>`
- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "password": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Expected**

- Status: `200 OK`
- Response:
  - `success: true`
  - `message: "Password reset successful."`

**Failure Cases**

- Missing/invalid/expired `secret` -> `401`
- Password mismatch -> `400` validation error

---

## 5) Auth - Google Flows

> Use a valid Google ID token from your client auth flow.

### 5.1 Google Signup

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/signup`
- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "authType": "google",
  "idToken": "<GOOGLE_ID_TOKEN>"
}
```

**Expected**

- Status: `201 Created`
- Response contains:
  - `success: true`
  - `token`
  - `user`

---

### 5.2 Google Login

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/auth/login`
- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "authType": "google",
  "idToken": "<GOOGLE_ID_TOKEN>"
}
```

**Expected**

- Status: `200 OK`
- Response contains:
  - `success: true`
  - `token`
  - `user`

**Postman Tests**

```javascript
pm.test("Google login success", function () {
  pm.response.to.have.status(200);
});

const body = pm.response.json();
pm.environment.set("authToken", body.token);
```

---

## 6) Link Creation Flow

### 6.1 Create Link

**Request**

- Method: `POST`
- URL: `{{baseUrl}}/api/links`
- Headers:
  - `Authorization: Bearer {{authToken}}`
  - `Content-Type: application/json`
- Body:

```json
{
  "originalUrl": "https://example.com/landing-page",
  "platform": "instagram",
  "postId": "post-2026-04-25",
  "campaign": "launch-week"
}
```

**Expected**

- Status: `201 Created`
- Response:
  - `success: true`
  - `data.shortCode`
  - `data.shortUrl`
  - `data.id`

**Postman Tests**

```javascript
pm.test("Link created", function () {
  pm.response.to.have.status(201);
});

const data = pm.response.json().data;
pm.environment.set("shortCode", data.shortCode);
pm.environment.set("linkId", data.id);
```

---

## 7) Redirect + Click Tracking Flow

### 7.1 Visit Short URL

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/r/{{shortCode}}`

**Expected**

- Status: `302 Found`
- Redirects to `originalUrl`
- Click event is logged in DB

> Run this multiple times (and optionally with different clients/user agents) to generate analytics data.

---

## 8) Dashboard Flow

Dashboard endpoint requires:

- Header: `Authorization: Bearer {{authToken}}`

### 8.1 Dashboard Summary

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/api/dashboard`

**Expected**

- Status: `200 OK`
- Response contains:
  - `data.totalClicks`
  - `data.activeLinks`
  - `data.topPlatform.platform`
  - `data.topPlatform.clicks`
  - `data.topPlatform.percentage`
  - `data.topLink.shortCode`
  - `data.topLink.clicks`
  - `data.platformSnapshot` (top 3)
  - `data.topLinksPreview` (top 3-5)
  - `data.recentActivity`
  - `data.quickInsight`

Example:

```json
{
  "success": true,
  "data": {
    "totalClicks": 1240,
    "activeLinks": 12,
    "topPlatform": { "platform": "instagram", "clicks": 860, "percentage": 69 },
    "topLink": { "shortCode": "abc123", "clicks": 210 },
    "platformSnapshot": [
      { "platform": "instagram", "clicks": 860, "percentage": 69 },
      { "platform": "twitter", "clicks": 240, "percentage": 19 },
      { "platform": "youtube", "clicks": 140, "percentage": 12 }
    ],
    "topLinksPreview": [
      { "shortCode": "abc123", "clicks": 210 },
      { "shortCode": "xyz789", "clicks": 180 }
    ],
    "recentActivity": [
      {
        "type": "click",
        "message": "abc123 got 1 click",
        "timestamp": "2026-04-25T10:00:00.000Z"
      },
      {
        "type": "link_created",
        "message": "New link created: xyz789",
        "timestamp": "2026-04-25T09:30:00.000Z"
      }
    ],
    "quickInsight": "Instagram is driving most of your traffic this week"
  }
}
```

---

## 9) Analytics Flows (Enhanced)

All analytics endpoints require:

- Header: `Authorization: Bearer {{authToken}}`

### 9.1 Overview

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/overview`

**Expected**

- Status: `200 OK`
- Response contains:
  - `data.totalClicks`
  - `data.activeLinks`
  - `data.avgClicksPerLink`
  - `data.topPlatform`
  - `data.topLink`

---

### 9.2 Platform Stats

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/platform`

**Expected**

- Status: `200 OK`
- Response `data` is an array:

```json
[
  {
    "platform": "instagram",
    "clicks": 4,
    "percentage": 80
  }
]
```

---

### 9.3 Top Links

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/links`

**Expected**

- Status: `200 OK`
- Response `data` is sorted by `clicks` descending:

```json
[
  {
    "linkId": "680b5c...",
    "shortCode": "aB3kL9q",
    "originalUrl": "https://example.com/landing-page",
    "platform": "instagram",
    "clicks": 7,
    "percentage": 58
  }
]
```

---

### 9.4 Trends (7d / 30d)

**Request (7d)**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/trends?range=7d`

**Request (30d)**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/trends?range=30d`

**Expected**

- Status: `200 OK`
- Sorted ascending by date:

```json
[
  { "date": "2026-04-20", "clicks": 120 },
  { "date": "2026-04-21", "clicks": 180 }
]
```

---

### 9.5 Compare (optional)

**Request**

- Method: `GET`
- URL: `{{baseUrl}}/api/analytics/compare?dimension=platform`

**Expected**

- Status: `200 OK`

```json
{
  "instagram": { "clicks": 860 },
  "twitter": { "clicks": 240 }
}
```

---

## 10) Negative / Edge Case Tests

### 9.1 Missing auth token on protected route

- `POST {{baseUrl}}/api/links` without `Authorization`
- Expected: `401`

### 9.2 Invalid URL on link creation

- `originalUrl: "not-a-url"`
- Expected: `400`

### 9.3 Unknown short code

- `GET {{baseUrl}}/r/doesNotExist`
- Expected: `404`

### 9.4 Email login wrong password

- Expected: `401`

### 9.5 Google login invalid token

- Expected: `401`

### 9.6 Email already registered

- Signup same email again with `authType: "email"`
- Expected: `409`

---

## 11) Suggested End-to-End Test Order

1. Email signup  
2. Email login (store token)  
3. Create link  
4. Hit redirect URL 3-5 times  
5. Verify dashboard summary (`/api/dashboard`)  
6. Verify analytics: overview/platform/links/trends/compare  
7. Google signup/login (same and different emails)  
8. Re-run dashboard + analytics  
9. Run negative tests

---

## 12) Handy Curl Commands (Optional)

### Email Login

```bash
curl -X POST "{{baseUrl}}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "authType":"email",
    "email":"creator1@example.com",
    "password":"Test@12345"
  }'
```

### Create Link

```bash
curl -X POST "{{baseUrl}}/api/links" \
  -H "Authorization: Bearer {{authToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl":"https://example.com/landing-page",
    "platform":"instagram",
    "postId":"post-2026-04-25",
    "campaign":"launch-week"
  }'
```

### Redirect

```bash
curl -i "{{baseUrl}}/r/{{shortCode}}"
```

### Dashboard

```bash
curl -X GET "{{baseUrl}}/api/dashboard" \
  -H "Authorization: Bearer {{authToken}}"
```

### Analytics Trends

```bash
curl -X GET "{{baseUrl}}/api/analytics/trends?range=7d" \
  -H "Authorization: Bearer {{authToken}}"
```

---

## 13) Troubleshooting Tips

- `404` on `/api/*` from `localhost:3000`: ensure client API base URL points to backend (`localhost:8000`) or use proxy.
- `401` for protected routes: verify `Authorization: Bearer <token>` format.
- Google auth failing:
  - check `GOOGLE_OAUTH_CLIENT_ID` in server env
  - ensure ID token is fresh and issued for same client ID.
- No analytics data:
  - ensure redirect endpoint has been hit after creating link.

