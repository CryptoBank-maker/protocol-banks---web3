# Protocol Bank Architecture Documentation

## 1. System Overview

Protocol Bank is a hybrid Web3 neobank platform designed to bridge traditional finance (Fiat) with decentralized finance (Crypto). It utilizes a modern tech stack centered around Next.js for the unified application layer, with specialized microservices for high-performance tasks.

### Core Architecture Capabilities
- **Unified Account Abstraction**: Maps email/social logins to non-custodial wallets (Reown AppKit).
- **Multi-Chain Orchestration**: Supports 9+ EVM chains, Solana, Bitcoin, and TRON via ZetaChain and Rango.
- **Hybrid Database Strategy**: Relational data (User profiles, settings) in PostgreSQL, on-chain data indexed separately.
- **Enterprise Security**: Custom implementation of Shamir Secret Sharing (SSS) for key management.

---

## 2. Technology Stack

### Frontend & Application Layer
- **Framework**: [Next.js 15.1](https://nextjs.org/) (App Router, Server Components)
- **Language**: TypeScript 5.7+
- **Styling**: Tailwind CSS 4, Shadcn/ui (Radix Primitives), Lucide React
- **State Management**: React Query (TanStack Query), Zustand (local state)
- **Form Handling**: React Hook Form + Zod validation

### Backend & Services
- **API Runtime**: Next.js Server Actions & API Routes (Edge & Node.js runtimes)
- **Database ORM**: Prisma 6.2 (PostgreSQL)
- **Microservices**:
  - `payout-engine`: Go (gRPC) service for handling batch payouts and scheduling.
  - `event-indexer`: Go service for listening to blockchain events.
- **AI Integration**: Vercel AI SDK (OpenAI/Anthropic integration) for financial insights.

### Blockchain Infrastructure
- **Web3 Connectivity**: Reown AppKit (WalletConnect), Ethers.js v6, Viem
- **Cross-Chain**: Rango SDK, ZetaChain integration
- **Fiat On/Off Ramp**: Stripe Crypto, Unlimit, Transak (Aggregated via `offramp-modal.tsx`)

### DevOps & Infrastructure
- **Containerization**: Docker, Kubernetes (K8s charts present in `k8s/` folder)
- **CI/CD**: GitHub Actions (Scanning, Testing), Vercel (Deployment)
- **Testing**: Jest, Playwright (E2E)

---

## 3. Architecture Diagrams

### 3.1 High-Level Data Flow

```mermaid
graph TD
    User[End User] -->|HTTPS| CDN[Vercel Edge Network]
    CDN -->|Request| NextApp[Next.js App Server]
    
    subgraph "Application Layer"
        NextApp -->|ORM| DB[(PostgreSQL)]
        NextApp -->|RPC| Blockchain[EVM Chains]
        NextApp -->|gRPC| PayoutSvc[Payout Engine (Go)]
    end
    
    subgraph "External Services"
        NextApp -->|API| Reown[Reown Auth / Wallet]
        NextApp -->|API| Rango[Rango Exchange]
        NextApp -->|API| 1Inch[1Inch Aggregator]
    end
    
    subgraph "Security Layer"
        User -->|Biometrics| Passkey[WebAuthn]
        NextApp -->|Shamir| Vault[Key Vault]
    end
```

### 3.2 Database Schema (Key Entities)
Based on `prisma/schema.prisma`:

- **User**: Core identity (email, role, kycStatus).
- **Wallet**: Linked blockchain accounts.
- **Payment**: Transaction records (fiat & crypto).
- **Invoice**: Request for payment records.
- **Subscription**: Recurring billing logic.
- **Organization**: B2B structure for managing teams.
- **AuditLog**: Compliance and security tracking.

---

## 4. Key Module Implementations

### 4.1 Payment Processing (`lib/services/payment-service.ts`)
The payment engine handles the complexity of routing funds between different chains and currencies.
- **Smart Routing**: Checks for most liquidity via Rango/1Inch.
- **Gas Abstraction**: Calculates gas fees in native tokens and offers "gasless" options via Paymasters.
- **Compliance**: Checks `compliance-service.ts` (Sanctions list, Travel Rule) before execution.

### 4.2 Authentication & Security (`lib/auth.ts`)
- **Hybrid Auth**: Supports both Web2 (Email/Password) and Web3 (Wallet Connect).
- **Session Management**: JWT based sessions via NextAuth (Auth.js) v5.
- **MPC Wallet**: Uses Reown AppKit for generating Multi-Party Computation wallets, ensuring the user always holds a key share.

### 4.3 Batch & Scheduled Payments
- **Definition**: Stored in PostgreSQL `ScheduledPayment` table.
- **Execution**: A cron job (via Vercel Cron or external worker) triggers the `payout-engine`.
- **Logic**:
  1. Fetch due payments.
  2. Verify balance.
  3. Construct batched transaction (Merkle tree for Airdrops or Disperse contract).
  4. Broadcast to network.

---

## 5. Project Structure

```bash
├── app/                  # Next.js App Router (Pages & API)
│   ├── (products)/       # Product specific routes
│   ├── api/              # Backend API endpoints
│   ├── auth/             # Authentication pages
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── ui/               # Reusable UI primitives (Buttons, Inputs)
│   └── ...               # Feature-specific components
├── lib/                  # Core business logic
│   ├── managers/         # State managers
│   ├── services/         # Backend services (DB, API calls)
│   └── utils.ts          # Helper functions
├── prisma/               # Database tools
│   └── schema.prisma     # Data models
├── packages/             # Internal packages (Monorepo style)
├── k8s/                  # Kubernetes configuration
└── public/               # Static assets
```

## 6. Security Considerations

1.  **Environment Variables**: Strictly managed via `.env` and Vercel secrets.
2.  **API Rate Limiting**: Implemented via usage tiers and middleware.
3.  **Input Validation**: Strict Zod schemas for all API inputs.
4.  **Audit Logging**: Critical actions (Money movement, Settings change) are logged to an immutable table.

## 7. Deployment

The application is configured for deployment on Vercel but can be containerized for AWS/GCP.
- **Build Command**: `next build`
- **Database**: Requires connection string to Postgres (Neon/Supabase/RDS).
- **Migrations**: `prisma migrate deploy` runs during build phase.
