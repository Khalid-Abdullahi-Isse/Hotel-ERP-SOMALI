# Hotel ERP Somali

A modern, secure, and affordable **Hotel ERP / Hotel Management System** designed primarily for hotels and hospitality businesses in **Somalia**.

The project is being built as a practical alternative for businesses that cannot afford large enterprise platforms such as **Odoo Enterprise** or **Oracle ERP**.

The system focuses on the features hotels actually need: reservations, guests, rooms, payments, expenses, staff operations, reporting, and reliable business data — without unnecessary enterprise complexity.



## Project Vision

Many small and medium-sized hotels need a reliable management system but cannot afford expensive ERP solutions or complex licensing models.

**Hotel ERP Somali** aims to provide:

* Affordable hotel management
* Simple and modern user experience
* Fast frontend performance
* Secure backend architecture
* Reliable financial and operational data
* Easy deployment and maintenance
* Support for Somali hospitality businesses
* A foundation that can grow with the business

---

# Technology Stack

## Backend

* **NestJS**
* **TypeScript**
* **PostgreSQL**
* REST API
* JWT Authentication
* Role-Based Access Control
* DTO validation
* Database constraints
* Audit logging
* Rate limiting
* Caching when necessary

## Frontend

* **Next.js**
* **React**
* **TypeScript**
* Modern responsive UI
* Server Components where appropriate
* Client Components only when necessary
* Optimized API communication
* Reusable component architecture

## Database

* **PostgreSQL**

The database is designed with strong constraints to prevent:

* Duplicate records
* Invalid references
* Incorrect financial values
* Inconsistent relationships
* Accidental data corruption

## Infrastructure

Planned infrastructure includes:

* Docker
* Docker Compose
* Reverse proxy
* HTTPS
* Environment-based configuration
* Automated database backups
* Production logging
* Monitoring
* CI/CD

---

# Core Modules

The system is planned around the real workflow of a hotel.

## 1. Authentication

Secure authentication for employees and administrators.

Features:

* Login
* Logout
* JWT access tokens
* Refresh tokens
* Password hashing
* Session management
* Account activation/deactivation
* Failed login protection
* Password reset architecture

---

## 2. Users

Manage system users such as:

* Administrator
* Manager
* Receptionist
* Accountant
* Cashier
* Housekeeping staff

Each user can receive specific permissions.

---

# Role-Based Access Control

The ERP will use **RBAC — Role-Based Access Control**.

Example permissions:

| Role         | Typical Access                           |
| ------------ | ---------------------------------------- |
| Admin        | Full system access                       |
| Manager      | Hotel operations and reporting           |
| Receptionist | Guests, rooms and reservations           |
| Accountant   | Payments, expenses and financial reports |
| Cashier      | Payment operations                       |
| Housekeeping | Room cleaning/status updates             |

Permissions should be enforced on the **backend**, not only hidden in the frontend.

---

# Guest Management

Manage hotel customers and their history.

Guest information can include:

* Full name
* Phone number
* Email
* Gender
* Nationality
* Identification information
* Address
* Notes
* Previous bookings
* Current booking
* Payment history

The system should avoid accidentally creating duplicate guest records.

---

# Room Management

Manage all hotel rooms.

Room information may include:

* Room number
* Room type
* Floor
* Capacity
* Price
* Current status
* Cleaning status
* Maintenance status
* Description

Example statuses:

```text
AVAILABLE
RESERVED
OCCUPIED
CLEANING
MAINTENANCE
OUT_OF_SERVICE
```

---

# Room Types

Hotels can define room categories such as:

* Single Room
* Double Room
* Twin Room
* Deluxe Room
* Family Room
* Suite

Each room type can have:

* Default price
* Capacity
* Number of beds
* Description
* Amenities

---

# Reservations

Reservation management is one of the main modules.

A reservation can contain:

* Guest
* Room
* Check-in date
* Check-out date
* Number of guests
* Room price
* Discounts
* Taxes
* Additional charges
* Reservation status
* Payment status
* Notes

Example statuses:

```text
PENDING
CONFIRMED
CHECKED_IN
CHECKED_OUT
CANCELLED
NO_SHOW
```

---

# Booking Conflict Protection

The backend must prevent two active reservations from occupying the same room during overlapping dates.

Example:

```text
Guest A
Room 101
August 18 → August 21
```

Another reservation for Room 101 cannot be accepted for:

```text
August 20 → August 23
```

unless the previous reservation is cancelled or otherwise no longer blocks availability.

This validation must happen in the backend/database workflow, not only in the frontend.

---

# Check-In

Reception staff should be able to check guests into the hotel.

The system should verify:

* Reservation exists
* Room is available
* Guest information is valid
* Required payment/deposit rules are satisfied
* Room is not in maintenance
* Reservation dates are valid

After successful check-in:

```text
Reservation → CHECKED_IN
Room → OCCUPIED
```

---

# Check-Out

During checkout, the system calculates the final bill.

Possible charges include:

* Room charges
* Extra nights
* Restaurant charges
* Laundry
* Room service
* Additional services
* Damage charges
* Taxes
* Discounts

After checkout:

```text
Reservation → CHECKED_OUT
Room → CLEANING
```

Once housekeeping finishes:

```text
Room → AVAILABLE
```

---

# Payments

The system should support different payment methods.

Examples:

* Cash
* Bank
* Mobile money
* EVC Plus
* Zaad
* Sahal
* Other configurable payment methods

Payment information may include:

* Reservation
* Guest
* Amount
* Payment method
* Transaction/reference number
* Payment date
* Cashier
* Notes

---

# Payment Status

Example payment statuses:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Financial totals should be calculated by the backend and not trusted directly from frontend requests.

---

# Expenses

Track hotel operating expenses.

Examples:

* Electricity
* Water
* Internet
* Food
* Cleaning supplies
* Repairs
* Salaries
* Rent
* Transportation
* Office supplies
* Maintenance

Expense records can contain:

* Category
* Amount
* Date
* Description
* Payment method
* Created by
* Receipt/reference
* Notes

---

# Expense Categories

Administrators can define categories such as:

```text
Electricity
Water
Internet
Salary
Maintenance
Cleaning
Food
Transportation
Other
```

---

# Housekeeping

Manage room cleaning operations.

Housekeeping status could include:

```text
CLEAN
DIRTY
CLEANING
INSPECTION_REQUIRED
```

Housekeeping staff should only receive access to functionality relevant to their work.

---

# Maintenance

Rooms with maintenance problems should be prevented from receiving new reservations.

Maintenance records may include:

* Room
* Problem description
* Priority
* Assigned employee
* Status
* Reported date
* Completed date
* Cost

Example statuses:

```text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# Dashboard

The dashboard should display useful real hotel data.

Potential statistics include:

* Total rooms
* Available rooms
* Occupied rooms
* Reserved rooms
* Rooms under maintenance
* Today's arrivals
* Today's departures
* Current guests
* Today's revenue
* Monthly revenue
* Outstanding payments
* Expenses
* Occupancy rate

The dashboard must use **real backend data**, not hard-coded fake statistics.

---

# Reports

Planned reports include:

* Daily revenue
* Weekly revenue
* Monthly revenue
* Annual revenue
* Expenses
* Profit overview
* Occupancy
* Reservations
* Guest history
* Payment reports
* Outstanding balances
* Room performance
* Cashier transactions

---

# Search

Users should be able to quickly search records.

Examples:

```text
Guest name
Phone number
Room number
Reservation number
Payment reference
Invoice number
```

Frequently searched fields should have appropriate database indexes.

---

# Audit Logs

Important operations should be recorded.

Example:

```text
User: Receptionist A
Action: CHECK_IN
Reservation: RES-1042
Room: 205
Date: 2026-08-18 14:30
```

Audit logging may record:

* User
* Action
* Entity
* Record ID
* Timestamp
* Previous value
* New value
* IP address where appropriate

Sensitive data such as passwords and authentication tokens must never be stored in audit logs.

---

# Database Design Principles

PostgreSQL is responsible for more than simply storing data.

The database should actively protect data integrity.

---

## Unique Constraints

Examples:

```text
room_number → UNIQUE
user_email → UNIQUE
username → UNIQUE
reservation_number → UNIQUE
payment_reference → UNIQUE where appropriate
```

---

## Foreign Keys

Relationships must use foreign keys.

Example:

```text
Reservation
   ↓
Guest

Reservation
   ↓
Room

Payment
   ↓
Reservation
```

---

## NOT NULL

Required values should use database-level `NOT NULL` constraints.

---

## CHECK Constraints

Examples:

```text
room_price >= 0
payment_amount > 0
expense_amount > 0
check_out_date > check_in_date
```

---

## Transactions

Critical workflows must use database transactions.

Examples:

### Check-In

```text
Validate Reservation
        ↓
Update Reservation
        ↓
Update Room
        ↓
Create Audit Log
        ↓
COMMIT
```

If one operation fails:

```text
ROLLBACK
```

---

## Duplicate Protection

The database and application should prevent accidental duplicate records through:

* Unique constraints
* Compound unique indexes
* Validation
* Transactions
* Idempotency where appropriate

Never rely entirely on frontend duplicate checks.

---

# Security

Security is a core requirement.

The system should implement:

* Password hashing
* JWT authentication
* Refresh token rotation
* Role-based access control
* Permission guards
* Input validation
* SQL injection protection
* Rate limiting
* Secure HTTP headers
* CORS configuration
* Environment variable protection
* Database constraints
* Audit logs
* Secure cookies where appropriate
* Production HTTPS
* Safe error responses

---

# Password Security

Passwords must never be stored as plaintext.

Recommended algorithms:

```text
Argon2
```

or:

```text
bcrypt
```

---

# Validation

Every incoming request should be validated.

Example:

```ts
{
  checkIn: "2026-08-18",
  checkOut: "2026-08-20",
  roomId: "uuid"
}
```

The backend must verify that:

* The room exists
* Dates are valid
* Check-out is after check-in
* Room is available
* User has permission
* Values are within allowed limits

---

# API Structure

Example API structure:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/permissions
/api/v1/guests
/api/v1/rooms
/api/v1/room-types
/api/v1/reservations
/api/v1/check-ins
/api/v1/check-outs
/api/v1/payments
/api/v1/expenses
/api/v1/housekeeping
/api/v1/maintenance
/api/v1/reports
/api/v1/dashboard
/api/v1/audit-logs
```

API versioning allows the project to evolve without immediately breaking existing clients.

---

# Backend Architecture

Recommended NestJS structure:

```text
src/
│
├── auth/
│   ├── controllers/
│   ├── services/
│   ├── dto/
│   ├── guards/
│   └── strategies/
│
├── users/
├── roles/
├── permissions/
├── guests/
├── rooms/
├── room-types/
├── reservations/
├── payments/
├── expenses/
├── housekeeping/
├── maintenance/
├── reports/
├── dashboard/
├── audit/
│
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
│
├── config/
│
└── main.ts
```

---

# Frontend Architecture

Example Next.js structure:

```text
src/
│
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── reservations/
│   ├── guests/
│   ├── rooms/
│   ├── payments/
│   ├── expenses/
│   ├── housekeeping/
│   ├── maintenance/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── charts/
│   └── layout/
│
├── lib/
├── hooks/
├── services/
├── types/
└── utils/
```

---

# Frontend Performance Principles

The frontend should remain fast even as the ERP grows.

Principles include:

* Server Components by default
* Client Components only when required
* Lazy loading
* Pagination
* Search debouncing
* Efficient API calls
* Avoid unnecessary re-renders
* Caching appropriate queries
* Database pagination
* Indexed search fields
* Optimized images
* Minimal JavaScript sent to the browser

---

# UI/UX Goals

The interface should feel modern and professional.

Design inspiration may come from products such as:

* Linear
* Stripe
* Vercel
* Modern SaaS dashboards

The system should remain simple enough for hotel employees who may not have extensive technical experience.

Primary design principles:

* Clear navigation
* Fast workflows
* Minimal clicks
* Responsive layout
* Readable typography
* Consistent components
* Clear status indicators
* Accessible forms
* Useful validation messages
* Keyboard-friendly workflows where practical

---

# Error Handling

Users should receive understandable errors.

Bad:

```text
500 Internal Server Error
```

Better:

```text
Room 203 is already reserved between August 20 and August 23.
```

Internal server details must not be exposed to normal users.

---

# Logging

Production logging should capture important technical information such as:

* Request errors
* Authentication failures
* Database failures
* Important business workflow errors

Logs should never contain:

* Passwords
* Access tokens
* Refresh tokens
* Full sensitive customer information

---

# Rate Limiting

Sensitive endpoints should receive stricter protection.

Examples:

```text
/auth/login
/auth/forgot-password
/auth/reset-password
```

Normal internal ERP endpoints can use appropriate limits without unnecessarily slowing employees.

---

# Caching

Caching will only be introduced where it provides measurable value.

Potential cache candidates:

* Dashboard statistics
* Room availability summaries
* Frequently requested reports
* Configuration data

Redis may be introduced when the scale of the system justifies it.

PostgreSQL remains the source of truth.

---

# Environment Variables

Example `.env` structure:

```env
NODE_ENV=development

PORT=3001

DATABASE_URL=postgresql://username:password@localhost:5432/hotel_erp

JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me

JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000
```

Never commit the real `.env` file.

Create an example file:

```text
.env.example
```

---

# Development Setup

## Requirements

Install:

* Node.js
* npm / pnpm
* PostgreSQL
* Git
* Docker Desktop — optional for local development

---

# Clone Repository

```bash
git clone https://github.com/khalidabdullahiesse-hash/Hotel-ERP-SOMALI.git
```

Enter the project directory:

```bash
cd Hotel-ERP-SOMALI
```

---

# Branch

The main development branch is:

```text
main
```

Check your branch:

```bash
git branch
```

Switch to main:

```bash
git switch main
```

---

# Install Dependencies

If frontend and backend are separate applications:

```bash
cd backend
npm install
```

Then:

```bash
cd ../frontend
npm install
```

---

# Start Backend

```bash
cd backend
npm run start:dev
```

Typical development API:

```text
http://localhost:3005
```

The backend Docker stack exposes the API on port 3005 to avoid collisions with other local services that commonly use 3001.

---

# Start Frontend

```bash
cd frontend
npm run dev
```

Typical frontend:

```text
http://localhost:3000
```

---

# Database

Create the PostgreSQL database:

```sql
CREATE DATABASE hotel_erp;
```

Then configure:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/hotel_erp
```

Run the migration command according to the ORM/database tooling used by the project.

---

# Docker

The production architecture is expected to support Docker.

Example services:

```text
Frontend
Backend
PostgreSQL
Redis — optional
Reverse Proxy
```

Example:

```bash
docker compose up -d
```

Production credentials must be supplied through secure environment variables and never hard-coded into Docker images.

---

# Testing

Testing is required for important business workflows.

## Unit Tests

Examples:

* Reservation calculations
* Permission checks
* Payment calculations
* Room availability logic

## Integration Tests

Examples:

```text
Create Guest
   ↓
Create Reservation
   ↓
Check In
   ↓
Record Payment
   ↓
Check Out
```

## End-to-End Tests

Test real hotel workflows from the API/client perspective.

Important cases include:

* Duplicate reservation prevention
* Concurrent room booking attempts
* Partial payment
* Cancelled reservation
* No-show reservation
* Maintenance room restriction
* Unauthorized access
* Invalid dates
* Expired authentication
* Refund workflow

---

# Development Rules

Every code change should be treated carefully.

## Rule 1 — Review Code Twice

Before considering implementation complete:

1. Review functionality
2. Review architecture and security

The developer/user can then perform the final review.

---

## Rule 2 — Do Not Silently Modify Problems

If an important problem is found:

1. Explain the problem
2. Explain why it matters
3. Explain the proposed solution
4. Explain the advantages
5. Explain the disadvantages
6. Then make the intended implementation clear

Avoid hiding architectural decisions behind automatic changes.

---

## Rule 3 — Think Like a Senior Engineer

Before selecting a major technical solution, consider:

* Security
* Maintainability
* Performance
* Simplicity
* Development time
* Cost
* Scalability
* Operational complexity

Do not add technology only because it is popular.

---

## Rule 4 — Keep the System Simple

The target audience is small and medium-sized hotels.

Avoid unnecessary complexity such as:

* Premature microservices
* Unnecessary message queues
* Kubernetes without a real requirement
* Complex distributed systems
* Excessive abstraction

Start with a well-structured modular monolith.

Scale architecture when real usage requires it.

---

# Git Workflow

Recommended workflow:

```bash
git switch main
git pull origin main
```

Create a feature branch:

```bash
git switch -c feature/reservations
```

After development:

```bash
git add .
git commit -m "feat: add reservation management"
```

Push:

```bash
git push -u origin feature/reservations
```

Then review the code and merge through a Pull Request.

---

# Commit Convention

Recommended examples:

```text
feat: add guest management
feat: implement room availability
fix: prevent duplicate room bookings
fix: correct payment calculation
refactor: improve reservation service
test: add reservation integration tests
docs: update API documentation
chore: update dependencies
```

---

# Production Deployment

A production deployment should include:

```text
Internet
   ↓
Domain
   ↓
HTTPS / Reverse Proxy
   ↓
Next.js Frontend
   ↓
NestJS API
   ↓
PostgreSQL
```

Optional services:

```text
Redis
Monitoring
Centralized Logs
Object Storage
```

---

# Production Security

Before production:

* Enable HTTPS
* Remove development secrets
* Rotate credentials
* Restrict database access
* Disable unnecessary open ports
* Configure firewall
* Configure CORS
* Configure secure headers
* Enable rate limiting
* Configure automated backups
* Test backup restoration
* Enable monitoring
* Review user permissions
* Test authentication
* Test financial workflows

---

# Backup Strategy

Hotel data is business-critical.

Backups should include:

* PostgreSQL database
* Uploaded documents
* Configuration required for recovery

Recommended approach:

```text
Daily database backup
        ↓
Encrypted storage
        ↓
Off-server copy
        ↓
Retention policy
```

Backups are only useful if restoration is tested.

---

# Monitoring

Production monitoring should eventually cover:

* API availability
* Database availability
* CPU
* Memory
* Disk usage
* HTTP error rate
* Response times
* Failed authentication attempts
* Backup status

---

# Scalability

The first architecture should remain simple:

```text
Next.js
   ↓
NestJS
   ↓
PostgreSQL
```

If the system grows:

```text
Load Balancer
     ↓
Multiple API Instances
     ↓
Redis
     ↓
PostgreSQL
```

Scaling should happen because measurements show a need — not simply because a technology exists.

---

# Planned Development Phases

## Phase 1 — Foundation

* Project structure
* PostgreSQL
* Environment configuration
* Authentication
* Users
* Roles
* Permissions
* Logging
* Global validation
* Error handling
* API versioning

---

## Phase 2 — Hotel Core

* Guests
* Room types
* Rooms
* Reservations
* Availability
* Check-in
* Check-out

---

## Phase 3 — Finance

* Payments
* Payment methods
* Expenses
* Expense categories
* Revenue calculations
* Outstanding balances

---

## Phase 4 — Operations

* Housekeeping
* Maintenance
* Room status workflow
* Staff operational views

---

## Phase 5 — Dashboard & Reporting

* Dashboard
* Revenue reports
* Expense reports
* Occupancy reports
* Reservation reports
* Payment reports

---

## Phase 6 — Frontend

* Authentication UI
* Dashboard
* Reservation management
* Guest management
* Room management
* Finance interfaces
* Housekeeping interface
* Reports
* Settings

---

## Phase 7 — Production Preparation

* Integration tests
* E2E testing
* Security review
* Performance testing
* Docker production setup
* Backup automation
* Monitoring
* HTTPS
* Deployment documentation

---

# Future Features

Possible future extensions include:

* Multi-hotel support
* Restaurant/POS integration
* Inventory management
* Payroll
* SMS notifications
* WhatsApp notifications
* Online booking website
* Customer portal
* Mobile application
* Advanced accounting
* Revenue forecasting
* AI-assisted reporting
* Integration with local payment providers
* Somali and Arabic localization

These features should only be introduced after the core hotel ERP is stable.

---

# Target Users

The platform is intended for:

* Small hotels
* Medium-sized hotels
* Guest houses
* Apartments
* Hospitality companies
* Somali businesses looking for affordable ERP software

---

# Project Philosophy

The goal is not to recreate every feature offered by enterprise ERP platforms.

The goal is to create a system that is:

> **Secure, fast, understandable, affordable, and useful for real hotel operations.**

Every feature should solve a real business problem.

---

# Repository

GitHub:

```text
https://github.com/khalidabdullahiesse-hash/Hotel-ERP-SOMALI
```

---

# Author

**Khalid Abdullahi Isse**

Software Engineer / Full-Stack Developer

Primary technologies:

* TypeScript
* JavaScript
* NestJS
* Next.js
* React
* Node.js
* PostgreSQL
* Docker
* ERP Development

---

# Project Status

🚧 **Currently under active development**

The system architecture and core backend are being developed first, followed by the frontend and production deployment process.

---

# License

The project license has not yet been finalized.

Before production or external distribution, an appropriate license should be selected based on the intended business model.

---

# Contributions

The project is currently being developed as a focused Hotel ERP platform.

Before submitting major changes:

1. Create a feature branch.
2. Follow the project architecture.
3. Keep changes focused.
4. Add or update tests.
5. Review the implementation twice.
6. Explain important architectural decisions.
7. Submit the change for final review.

---

# Final Goal

Hotel ERP Somali should provide Somali hospitality businesses with a reliable system for managing:

```text
Guests
   ↓
Reservations
   ↓
Rooms
   ↓
Check-In
   ↓
Hotel Services
   ↓
Payments
   ↓
Check-Out
   ↓
Accounting & Reports
```

while maintaining:

```text
Security
+
Data Integrity
+
Performance
+
Simplicity
+
Affordability
```

---

**Hotel ERP Somali — Modern hotel management built for practical business needs.**
