# PDVTouch Architecture Blueprint

## 1) Mission
Build a POS platform for restaurant-by-weight operations with fast touch UX, resilient dual-scale integration, mandatory cashier checkout, fiscal/non-fiscal closing options, and secure role-based operations.

## 2) Target Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + socket.io-client
- Backend: Node.js + Express + PostgreSQL + Socket.IO
- Persistence:
  - Frontend: IndexedDB (Dexie), temporary resilience/cache for short connection drops
  - Backend: PostgreSQL as source of truth
- Cloud target:
  - DigitalOcean Managed PostgreSQL
  - Backend Node on DigitalOcean App Platform or Droplet
- Fiscal target:
  - UF: SP
  - Certificate: A1
  - Token/CSC: required for NFC-e flow when applicable
  - Initial environment: SEFAZ homologation

## 3) Architectural Principles
- Clean Architecture by feature/module
- Strict separation of responsibilities
- Domain rules independent from UI
- Resilience-first for sync and websocket failures
- Security by default (JWT + RBAC + audit)
- Backend is the source of truth for critical business rules
- Fiscal integration must be adapter-based to support current XML/DANFE import flow and future API-based emission

## 4) Layer Model
### Backend
- Controllers: route handlers + input validation + status mapping
- Services: business rules and orchestration
- Repositories: PostgreSQL data access abstraction
- Fiscal gateways: adapter contract for XML folder import, existing external integrations, and future secure fiscal API

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
- Backend authorization for cancel/reopen/close operations

### Sensitive Role Rules
- ADMIN, GERENTE, and CAIXA can cancel item, cancel comanda, and reopen operations.
- COMANDA_A and COMANDA_B can operate scales only within allowed scale/comanda actions.
- ATENDENTE must not close fiscal sales, reopen comandas, or cancel critical operations unless explicitly granted later.

## 6) Data and Audit Contracts
### Core domain entities
- `comandas`: physical or configured comanda used by the customer during the stay.
- `comanda_items`: multiple weighted/unit items linked to a comanda.
- `pesagens`: scale events with weight, origin, operator, and scale identifier.
- `caixa_sessions`: cashier sessions and operational closing context.
- `vendas`: fiscal/financial sale generated only at cashier checkout.
- `orcamentos`: non-fiscal closing documents generated when the cashier chooses budget mode.
- `nfce_documents`: fiscal document status, XML, DANFE reference, access key, protocol, and rejection details when applicable.
- `scale_devices`: BALANCA_A/B configuration, enabled flag, location, health, and lock metadata.
- `system_settings`: admin-controlled settings such as numbering mode and scale activation.

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

### fiscal_documents
Required fields:
- id
- venda_id
- document_type (NFCE | ORCAMENTO)
- status (PENDING | AUTHORIZED | REJECTED | CANCELLED | IMPORTED | MANUAL_REVIEW)
- access_key
- protocol
- xml_path
- danfe_path
- rejection_code
- rejection_message
- issued_at
- created_at
- updated_at

## 7) Outbox Pattern (required)
For each sale operation:
1. Start DB transaction
2. Persist comanda closing, sale or budget records, payment records, and audit logs
3. Persist outbox event for fiscal emission/import/sync when applicable
4. Commit
5. Outbox processor publishes websocket event to interested clients (including both scales)
6. Fiscal worker retries pending fiscal operations without losing the local sale record

## 8) Websocket Reliability
- Auto-reconnect with backoff
- Sequence/timestamp checks to avoid stale updates
- Graceful fallback when disconnected
- Explicit UI status: online, reconnecting, offline
- Scale-origin metadata for BALANCA_A and BALANCA_B
- Per-comanda lock events to avoid concurrent editing from two scales

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
- Domain migration from generic orders toward Balanças, Caixa, Vendas, Fiscal, and Auditoria modules
- Backend modularization into Controllers/Services/Repositories
- PostgreSQL repositories and migrations for sales/outbox/audit
- JWT issuance/refresh and route guards in backend
- Outbox worker and delivery guarantees
- Structured logging and observability pipeline
- Tailwind migration plan for design system consistency
- Fiscal gateway for current XML/DANFE folder import and future secure API emission
- NFC-e model 65 validation for SP with accountant/fiscal provider before go-live

## 11) Business Operating Model
### Main entities
- Balanças is the main user-facing operational screen while the customer is inside the restaurant.
- Comanda remains the internal domain record carried by the Balanças flow.
- Venda is the final financial/fiscal entity created only at cashier checkout.
- Pedido must not remain the central business concept for the restaurant-by-weight flow; existing order code should be migrated or wrapped by Balanças/Caixa flows.

### Balanças/Comanda rules
- A comanda can have multiple items.
- A comanda can receive multiple weighings during the same customer stay.
- Weighted items require a valid weight.
- Unit items such as beverage, dessert, and coffee can be added while the comanda is open.
- A comanda can only be finalized at Caixa.
- Finalized or archived comandas cannot receive new items.
- Cancel item, cancel comanda, and reopen operation require ADMIN, GERENTE, or CAIXA.

### Numbering mode
- Preferred MVP: physical card numbering.
- Target admin setting: hybrid numbering mode, enabled or disabled from Admin.
- Reuse rules must be explicit before production: range, cycle, and when a number becomes available again.

### Dual-scale rules
- BALANCA_A and BALANCA_B are part of the MVP target.
- Admin can enable or disable each scale.
- The system must support two scales connected to one scale workstation and one cashier workstation controlling checkout and system operation.
- Each weight event must store the origin scale.
- The same comanda cannot be operated simultaneously by two scales.

### Cashier closing rules
- Checkout is always mandatory at Caixa.
- Caixa can close as fiscal sale or non-fiscal budget.
- Fiscal sale generates Venda and fiscal processing.
- Non-fiscal budget generates Orcamento and must be clearly marked as not fiscal.
- Non-fiscal budget must not be used to replace legally required fiscal issuance for paid consumption.

### Fiscal rules
- The restaurant currently works with XML/DANFE by downloading/importing files.
- The first fiscal adapter must support folder/file import to preserve the existing process.
- The target professional model is hybrid: keep XML/DANFE import support and add secure API-based fiscal integration when selected.
- A1 certificate support is required.
- The production fiscal model is NFC-e model 65. SAT/CF-e is out of scope.
- Fiscal validation for SP must confirm operational details for NFC-e homologation/production, token/CSC, XML/DANFE storage, cancellation, and contingency handling.
- Failed fiscal operations must become pending/manual-review items instead of losing or corrupting the sale.

## 12) Execution Roadmap by Stage
### Stage 1: Admin (active)
- Admin route and operations panel
- Audit timeline for sensitive actions
- PIN governance and policy controls
- Queue/sync operational visibility
- Settings for physical/hybrid comanda numbering
- Settings for BALANCA_A and BALANCA_B activation
- Fiscal setup placeholders for A1 certificate, SP, token/CSC, XML folder import, and future API adapter

### Stage 2: Balanças and Scales A/B
- Balanças module as operational core
- Multiple items and multiple weighings per comanda
- Independent channels, health checks, and failover handling
- Weight event provenance and anti-jump policy per scale
- Per-comanda lock with owner and timeout
- Outbox-driven synchronization to both scale clients

### Stage 3: Cashier
- Fast checkout flow
- Payment confidence UX
- Transaction-safe close/cancel with audit
- Mandatory Caixa closing for every comanda
- Fiscal sale vs non-fiscal budget selection
- Reopen/cancel controls for ADMIN, GERENTE, and CAIXA

### Stage 4: Fiscal and Integration
- XML/DANFE import adapter via folder/file workflow
- Secure fiscal API adapter evaluation
- SEFAZ homologation flow for SP
- Fiscal pending/retry/manual-review dashboard

### Stage 5: Manager and Attendant
- Scoped dashboards and permissions
- Operational reports and overrides with traceability

## 13) Definition of Done (for each stage)
1. Functional acceptance by role
2. Test suite green
3. Build green
4. Security checks in place for sensitive routes/actions
5. Audit events generated for critical operations
6. Documentation updated (skill + blueprint)
7. Critical backend rules covered by automated tests
8. Fiscal/accounting assumptions documented before production use

## 14) Immediate Next Sprint (Core-1)
- Update domain language from Pedido-first to Balanças/Venda/Caixa-first.
- Create PostgreSQL schema draft for comandas, comanda_items, pesagens, caixa_sessions, vendas, pagamentos, orcamentos, nfce_documents, audit_logs, outbox_events, scale_devices, and system_settings.
- Modularize backend skeleton into controllers, services, repositories, routes, middlewares, and fiscal gateways.
- Add comanda lock rules for BALANCA_A/B.
- Add Caixa closing contract with fiscal sale and non-fiscal budget modes.
- Add fiscal gateway interface supporting XML/DANFE folder import first and API adapter later.
- Fix E2E authentication flow so the test suite is green before expanding features.
