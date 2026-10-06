# ⚡ EV Charging Station Management System - REST API Backend

A robust, enterprise-grade RESTful API backend built with **Node.js**, **Express**, and **mysql2/promise** for managing an Electric Vehicle (EV) Charging Station network, featuring JWT authentication and role-based access control (`CUSTOMER` and `OWNER`).

---

## 📋 Features & Business Rules

1. **Role-Based Authentication & Account System**:
   - Two distinct roles: `CUSTOMER` and `OWNER` (charging station owner).
   - Secure password hashing with `bcryptjs` and token-based authentication via `jsonwebtoken` (JWT, 7-day expiry).
   - Rate limiting on authentication endpoints to prevent brute-force attacks (`express-rate-limit`).
   - Strict validation: email formatting, 8+ character password, role assigned exclusively by registration endpoint.
2. **Stations & Infrastructure Management**:
   - Full CRUD endpoints for charging stations, charging points (chargers), customers, and employees.
   - Charging stations have an `Owner_User_ID` linking each station to an owner.
   - Owners can only modify/delete their own stations and chargers.
3. **Smart Booking System**:
   - Validation ensuring `End_Time > Start_Time`.
   - Automatic check that the charger exists and is not currently under maintenance.
   - Overlap prevention: Rejects bookings conflicting with existing non-cancelled bookings on the same charger and date.
   - Customers can create and cancel bookings **only for themselves**.
   - Owners can view bookings for their stations.
4. **Session Lifecycle & Metering**:
   - `POST /api/sessions/start`: Starts a session from a `Confirmed` booking and sets the charger to `Occupied` within an atomic MySQL transaction.
   - `POST /api/sessions/:id/end`: Ends a session with recorded `Energy_Consumed` (kWh), calculates total cost as `Energy_Consumed * RATE_PER_KWH`, completes the booking, and marks the charger as `Available` using a MySQL transaction.
   - Customers can start and end sessions only for their own bookings.
5. **Payment Processing**:
   - `POST /api/payments`: Records payment for a finished session using its `Charging_Cost`.
   - Strict one-payment-per-session enforcement (`Session_ID` UNIQUE constraint).
   - Customers can only pay for their own sessions.
6. **Maintenance Lifecycle**:
   - `POST /api/maintenance`: Creating an `"In Progress"` maintenance record automatically transitions the charger status to `Maintenance`.
   - `PATCH /api/maintenance/:id/complete`: Completing the maintenance sets the charger status back to `Available`.
   - Restricted to `OWNER` role for chargers at stations they own.
7. **Analytics & Reports (OWNER only)**:
   - **Revenue per station**: Aggregates sessions, energy dispensed, and revenue limited to owner's stations.
   - **Customer-wise energy usage**: Aggregates total sessions, kWh consumed, and expenditure for owner's stations.
   - **Maintenance cost per station**: Aggregates maintenance events, active repairs, and expenses.
   - **Platform summary totals**: Overview of stations, chargers by availability, active vs completed sessions, revenue, and net operating profit for owner's stations.
8. **Security & Reliability**:
   - 100% parameterized queries to eliminate SQL injection vulnerabilities.
   - Central error handler mapping MySQL error codes (foreign key violations, duplicate keys, data truncation) to standard HTTP 400 / 401 / 403 / 404 / 409 responses.
   - Database connection pooling with health monitoring at `/api/health`.

---

## 👤 Seeded Demo Logins

The database includes pre-seeded demo accounts for testing role-based access:

| Role | Email | Password | Linked Entity / Scope |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner@demo.com` | `Owner@123` | Owner of the 4 initial charging stations (User_ID: 1, Rajesh Sharma) |
| **CUSTOMER** | `rahul@gmail.com` | `Customer@123` | Linked to Customer_ID 1 (Rahul Sharma) |

---

## 📁 Exact Project Structure

```
.
├── server.js                   # Main Express application entry point
├── package.json                # Project dependencies and npm scripts
├── .env                        # Local environment variables (DB credentials, port, JWT_SECRET)
├── .env.example                # Template for environment configuration
├── .gitignore                  # Files and directories ignored by Git
├── ev_charging_db.sql          # Base database schema & initial seed data
├── migrations/
│   └── 002_auth.sql            # Migration creating user_account & Owner_User_ID
├── src/
│   ├── db.js                   # mysql2/promise connection pool configuration
│   ├── auth.js                 # JWT helpers, requireAuth, requireRole, optionalAuth middlewares
│   ├── crud.js                 # Reusable parameterized CRUD router and helpers
│   ├── errorHandler.js         # Centralized MySQL error mapping & custom AppError
│   └── routes/
│       ├── health.js           # Health check & database connection probe
│       ├── auth.js             # Authentication routes (register customer/owner, login, me)
│       ├── stations.js         # Stations CRUD (/api/stations)
│       ├── chargers.js         # Charging Points CRUD (/api/chargers)
│       ├── customers.js        # Customers CRUD (/api/customers)
│       ├── employees.js        # Employees CRUD (/api/employees - OWNER only)
│       ├── bookings.js         # Bookings & Overlap Validation (/api/bookings)
│       ├── sessions.js         # Charging Sessions & Metering (/api/sessions)
│       ├── payments.js         # Payments Processing (/api/payments)
│       ├── maintenance.js      # Maintenance Management (/api/maintenance - OWNER only)
│       └── reports.js          # Analytics & Aggregations (/api/reports - OWNER only)
└── README.md                   # Setup guide and complete API documentation
```

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **MySQL Server**: MySQL 8.0+

---

## 🚀 Setup & Installation Steps

### Step 1: Clone and Navigate to Directory
```bash
cd "EV-CHARGING-STATION-"
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

### Step 3: Setup MySQL Database & Run Migrations
1. Log into the MySQL CLI:
   ```bash
   mysql -u root -p
   ```
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS ev_charging_db;
   EXIT;
   ```
3. Import the initial database schema:
   ```bash
   mysql -u root -p ev_charging_db < ev_charging_db.sql
   ```
4. Run the authentication & ownership migration:
   ```bash
   mysql -u root -p ev_charging_db < migrations/002_auth.sql
   ```

### Step 4: Configure Environment Variables
Copy `.env.example` to `.env` or edit `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
# Server Configuration
PORT=3000

# Database Configuration (MySQL 8)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ev_charging_db

# EV Charging Station Business Rules
RATE_PER_KWH=12.00

# Authentication (JWT)
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### Step 5: Start the API Server

#### Development Mode (with hot-reload using Nodemon):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

---

## 🔐 Role Permissions Matrix

| Endpoint | Method | Public | CUSTOMER | OWNER | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `/api/health` | `GET` | ✅ | ✅ | ✅ | Health probe |
| `/api/auth/register/*` | `POST` | ✅ | ✅ | ✅ | Rate limited |
| `/api/auth/login` | `POST` | ✅ | ✅ | ✅ | Rate limited |
| `/api/auth/me` | `GET` | ❌ | ✅ | ✅ | Profile of current user |
| `/api/stations` | `GET` | ✅ | ✅ | ✅ | Public catalog |
| `/api/stations` | `POST` | ❌ | ❌ | ✅ | Owner set automatically |
| `/api/stations/:id` | `PUT`, `DELETE` | ❌ | ❌ | ✅ | Only stations owned by user |
| `/api/chargers` | `GET` | ✅ | ✅ | ✅ | Public catalog |
| `/api/chargers` | `POST`, `PUT`, `DELETE` | ❌ | ❌ | ✅ | Only chargers at owned stations |
| `/api/customers/:id` | `PUT` | ❌ | ✅ | ❌ | Customers edit only own profile |
| `/api/employees/*` | ALL | ❌ | ❌ | ✅ | Only for owned stations |
| `/api/bookings` | `GET` | ❌ | ✅ (own) | ✅ (station) | Filtered by role |
| `/api/bookings` | `POST` | ❌ | ✅ (self) | ❌ | Validates time, overlap, charger |
| `/api/bookings/:id/cancel`| `PATCH` | ❌ | ✅ (own) | ✅ (station) | Ownership check |
| `/api/sessions/start` | `POST` | ❌ | ✅ (own) | ❌ | Transitions charger to Occupied |
| `/api/sessions/:id/end` | `POST` | ❌ | ✅ (own) | ❌ | Computes cost, charger Available |
| `/api/payments` | `POST` | ❌ | ✅ (own) | ❌ | One payment per finished session |
| `/api/maintenance/*` | ALL | ❌ | ❌ | ✅ | Only for chargers at owned stations |
| `/api/reports/*` | `GET` | ❌ | ❌ | ✅ | Scoped to owner's stations |

*HTTP Error Responses:*
- `401 Unauthorized`: Missing, invalid, or expired Bearer token.
- `403 Forbidden`: Authenticated user lacks permission or tried to access/modify another user's resource.

---

## 📖 API Documentation & Example cURL Requests

### Base URL: `http://localhost:3000/api`

---

### 1. Authentication (`/api/auth`)

#### Register a Customer
```bash
curl -X POST "http://localhost:3000/api/auth/register/customer" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Arjun Rathore",
    "email": "arjun.rathore@example.com",
    "phone": "9876543219",
    "address": "C-Scheme, Jaipur",
    "password": "CustomerSecure@123"
  }'
```

#### Register an Owner
```bash
curl -X POST "http://localhost:3000/api/auth/register/owner" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunita Verma",
    "email": "sunita.owner@example.com",
    "phone": "9876543220",
    "password": "OwnerSecure@123"
  }'
```

#### Login (Customer or Owner)
```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@demo.com",
    "password": "Owner@123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "owner@demo.com",
    "role": "OWNER",
    "name": "Rajesh Sharma",
    "customer_id": null
  }
}
```

#### Get Current Logged-in User
```bash
curl -X GET "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

### 2. Charging Stations (`/api/stations`)

#### List Stations (Public / Unauthenticated)
```bash
curl -X GET "http://localhost:3000/api/stations"
```

#### Create Station (OWNER only)
```bash
curl -X POST "http://localhost:3000/api/stations" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Station_Name": "Solar Charge Hub",
    "Location": "C-Scheme, Jaipur",
    "Contact_Number": "9876543299",
    "Total_Chargers": 6,
    "Operating_Hours": "24 Hours",
    "Status": "Active"
  }'
```

#### Edit Station (OWNER only, can only edit owned station)
```bash
curl -X PUT "http://localhost:3000/api/stations/1" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Operating_Hours": "24 Hours (Fast Charging Available)"
  }'
```

---

### 3. Charging Points / Chargers (`/api/chargers`)

#### List Chargers (Public)
```bash
curl -X GET "http://localhost:3000/api/chargers?status=Available"
```

#### Add Charger to Owned Station (OWNER only)
```bash
curl -X POST "http://localhost:3000/api/chargers" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Charger_Type": "DC Fast Charger",
    "Connector_Type": "CCS2",
    "Power_Output": 150.00,
    "Availability_Status": "Available",
    "Station_ID": 1
  }'
```

---

### 4. Bookings (`/api/bookings`)

#### Create Booking (CUSTOMER only, for self)
```bash
curl -X POST "http://localhost:3000/api/bookings" \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Booking_Date": "2026-12-10",
    "Start_Time": "14:00:00",
    "End_Time": "15:00:00",
    "Charger_ID": 2
  }'
```

#### Cancel Booking (CUSTOMER can cancel own booking)
```bash
curl -X PATCH "http://localhost:3000/api/bookings/1/cancel" \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>"
```

---

### 5. Charging Sessions (`/api/sessions`)

#### Start Session from Confirmed Booking (CUSTOMER)
```bash
curl -X POST "http://localhost:3000/api/sessions/start" \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Booking_ID": 1
  }'
```

#### End Session with Energy Consumed (CUSTOMER)
```bash
curl -X POST "http://localhost:3000/api/sessions/1/end" \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Energy_Consumed": 35.50
  }'
```

---

### 6. Payments (`/api/payments`)

#### Pay for Finished Session (CUSTOMER)
```bash
curl -X POST "http://localhost:3000/api/payments" \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Session_ID": 1,
    "Payment_Method": "UPI"
  }'
```

---

### 7. Maintenance (`/api/maintenance` - OWNER only)

#### Log Maintenance Record
```bash
curl -X POST "http://localhost:3000/api/maintenance" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Charger_ID": 2,
    "Employee_ID": 1,
    "Maintenance_Date": "2026-10-10",
    "Description": "Routine cable and socket inspection",
    "Status": "In Progress",
    "Cost": 500.00
  }'
```

#### Complete Maintenance (Charger transitions to Available)
```bash
curl -X PATCH "http://localhost:3000/api/maintenance/1/complete" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "Cost": 550.00
  }'
```

---

### 8. Analytics & Reports (`/api/reports` - OWNER only)

#### Summary Report
```bash
curl -X GET "http://localhost:3000/api/reports/summary" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>"
```

#### Revenue by Station
```bash
curl -X GET "http://localhost:3000/api/reports/revenue-by-station" \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>"
```

---

## 🛡️ Central Error Handling & HTTP Status Mappings

| Error Condition / MySQL Code | HTTP Status | Description |
| :--- | :---: | :--- |
| Missing or invalid JWT | **401 Unauthorized** | Missing `Bearer` token or expired signature |
| Wrong role or unauthorized resource | **403 Forbidden** | Customer accessing owner endpoints or someone else's data |
| `1062` (`ER_DUP_ENTRY`) | **409 Conflict** | Unique constraint violated (e.g. email or duplicate payment) |
| `1452` (`ER_NO_REFERENCED_ROW_2`) | **400 Bad Request** | Foreign key constraint failed (e.g. invalid `Station_ID`) |
| `1451` (`ER_ROW_IS_REFERENCED_2`) | **409 Conflict** | Cannot delete record referenced by other active entities |
| `1406` / `1265` | **400 Bad Request** | Data truncation or invalid field format |
| Missing required fields | **400 Bad Request** | Validation failed on payload |
| Route not found | **404 Not Found** | Resource or endpoint does not exist |

Standardized error response format:
```json
{
  "success": false,
  "error": {
    "status": 403,
    "message": "Forbidden: You can only edit stations that belong to you"
  }
}
```