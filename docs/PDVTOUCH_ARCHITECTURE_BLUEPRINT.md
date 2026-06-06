# PDVTouch Architecture Blueprint

## 1) Mission
Build a POS platform with fast touch UX, resilient scale integration, and secure role-based operations.

## 2) Target Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + socket.io-client
- Backend: Node.js + Express + PostgreSQL + Socket.IO
- Persistence:
  - Frontend: IndexedDB (Dexie), offline-first
  - Backend: PostgreSQL as source of truth

## 3) Architectural Principles
- Clean Architecture by feature/module
- Strict separation of responsibilities
- Domain rules independent from UI
- Resilience-first for sync and websocket failures
- Security by default (JWT + RBAC + audit)

## 4) Layer Model
### Backend
- Controllers: route handlers + input validation + status mapping
- Services: business rules and orchestration
- Repositories: PostgreSQL data access abstraction

### Frontend
- Components: UI primitives and feature components
- Hooks: stateful orchestration and side-effects
- Services: API clients and app services
- Infrastructure: websocket, persistence adapters, sync queue

## 5) Security Model
### Roles
- ADMIN
- GERENTE
- CAIXA
- ATENDENTE
- COMANDA_A
- COMANDA_B

### Mandatory Controls
- JWT middleware for authenticated routes
- Role guards for sensitive routes/actions
- Sensitive action confirmation with dedicated PIN
- Immutable audit logs for critical actions

## 6) Data and Audit Contracts
### audit_logs (immutable)
Required fields:
- id
- action
- user_id
- user_role
- entity
- entity_id
- before_json
- after_json
- status
- reason
- created_at

### outbox_events
Required fields:
- id
- aggregate_type
- aggregate_id
- event_type
- payload_json
- status (PENDING | SENT | FAILED)
- attempts
- next_retry_at
- created_at
- sent_at

## 7) Outbox Pattern (required)
For each sale operation:
1. Start DB transaction
2. Persist sale records
3. Persist outbox event
4. Commit
5. Outbox processor publishes websocket event to interested clients (including both scales)

## 8) Websocket Reliability
- Auto-reconnect with backoff
- Sequence/timestamp checks to avoid stale updates
- Graceful fallback when disconnected
- Explicit UI status: online, reconnecting, offline

## 9) UX and Design System Constraints
- Dark premium baseline (#0d0d0d)
- Color semantics:
  - CTA: #10b981
  - Critical (weight/price): #fbbf24
  - Secondary: #3b82f6
- Touch-safe minimum target: 44x44px
- Font minimum for operational screens: 16px
- Clear visual hierarchy focused on speed and confidence

## 10) Current Alignment Status
Implemented and active:
- Clean modular frontend structure
- RBAC roles and protected routes
- Sensitive action confirmation flow on scale screen
- Sensitive action local audit trail
- Scale A/B screen with keyboard shortcuts and real-time handling
- Offline-first queue and retry/backoff infrastructure

Pending to reach target architecture:
- Backend modularization into Controllers/Services/Repositories
- PostgreSQL repositories and migrations for sales/outbox/audit
- JWT issuance/refresh and route guards in backend
- Outbox worker and delivery guarantees
- Structured logging and observability pipeline
- Tailwind migration plan for design system consistency

## 11) Execution Roadmap by Stage
### Stage 1: Admin (active)
- Admin route and operations panel
- Audit timeline for sensitive actions
- PIN governance and policy controls
- Queue/sync operational visibility

### Stage 2: Scales A/B
- Independent channels, health checks, and failover handling
- Weight event provenance and anti-jump policy per scale
- Outbox-driven synchronization to both scale clients

### Stage 3: Cashier
- Fast checkout flow
- Payment confidence UX
- Transaction-safe close/cancel with audit

### Stage 4: Manager and Attendant
- Scoped dashboards and permissions
- Operational reports and overrides with traceability

## 12) Definition of Done (for each stage)
1. Functional acceptance by role
2. Test suite green
3. Build green
4. Security checks in place for sensitive routes/actions
5. Audit events generated for critical operations
6. Documentation updated (skill + blueprint)

## 13) Immediate Next Sprint (Admin-2)
- Add PIN management screen (login PIN + sensitive PIN policy)
- Add filter/search/export on admin audit timeline
- Add backend-ready audit event schema adapter
- Add structured log utility for admin-sensitive workflows
