# Copilot Instructions — Frontend (DHBW AppStore)

These instructions define **how GitHub Copilot should behave in this repository**.
They provide:
- context about the project
- architectural boundaries
- coding conventions
- what to generate and **what NOT to generate**

Copilot should follow these instructions whenever it suggests code or implements features.

---

## 🎯 Purpose & Role of Copilot

Copilot acts as a **frontend engineer on this project**.

Copilot should:
- understand the domain: DHBW AppStore for teaching environments
- generate React 19 + TypeScript code consistent with our architecture
- reuse existing modules, stores, services and patterns
- help build features that integrate cleanly with the backend API
- propose UI that feels consistent with the rest of the application

Copilot should **NOT**:
- invent backend features
- invent new domains or workflows
- introduce technologies we do not use
- bypass architectural rules

---

## 🧠 Project Context (Very Important!)

### What we are building
We are developing a **web-based AppStore for educational environments**.

The goal:
Teachers can deploy course environments for students **without deep Kubernetes/Cloud knowledge**.

Examples:
- Jupyter environments for exercises
- Online IDEs (VS Code / Web-LaTeX)
- Database tools (pgAdmin)
- Microservices / AI environments
- Windows VMs via KubeVirt

### What is an “App”?
Not a normal desktop app.

An **App = Deployment Blueprint**
- Defined by `appstore.yaml`
- Container images / KubeVirt VM definitions
- Configuration variables provided by teacher/app developer
- Versionable (Git tags / releases) and reproducible deployment package

### High Level Architecture
Frontend (React 19 SPA)  
↓  
Keycloak (Authentication & User Management via OIDC Code + PKCE)  
↓  
Backend (FastAPI, Python)  
↓  
Kubernetes (k3s) Cluster (Pods in `dep-{id}` namespaces & KubeVirt VMs)

Important:
- Frontend talks **ONLY to the backend API** (in K8s routed via the nginx gateway at `/api`)
- Frontend NEVER talks directly to Kubernetes or Keycloak Admin API
- Authentication via **Keycloak OIDC** (Authorization Code + PKCE S256)
- Tokens are kept **strictly in-memory** (`InMemoryWebStorage`), never in `localStorage` or `sessionStorage`
- Backend validates JWT tokens from Keycloak
- Frontend is the UI for:
  - OIDC login flow (redirect to Keycloak)
  - managing apps and versions
  - starting deployments via the multi-step wizard
  - viewing deployment progress & live logs (Server-Sent Events)
  - managing courses and user interactions (teachers, admins, students)

---

## 🛠️ Technology Stack (Copilot must respect this)

### Frontend
- **React 19** (Function components and hooks)
- **TypeScript** (~5.9)
- **Vite** (bundler)
- **Zustand 5** (global state management)
- **React Router 7** (client routing with route loaders / guards)
- **Tailwind CSS 3** (utility-first styling)
- **Axios** (HTTP client with token interceptor and 401 handling)
- **react-i18next** (internationalization DE/EN)
- **oidc-client-ts** (Keycloak OIDC integration)
- **Vitest & React Testing Library** (unit & component tests)

### Backend Stack (for context)
- FastAPI (Python)
- PostgreSQL (Backend DB)
- Kubernetes / KubeVirt (workload execution)
- Keycloak (Identity Provider, realm: `dhbw`, roles: `student`, `teacher`, `admin`)

No new frameworks should be added without team discussion.

---

## ✅ Copilot Capabilities

Copilot is allowed to:
- create React function components
- build pages & views
- extend routing
- create custom React hooks (`use*`)
- create Zustand stores
- extend existing UI components
- call backend APIs via existing API modules
- suggest improvements consistent with existing code
- generate reusable, accessible, readable, maintainable code

Copilot should:
- respect existing folder structure (`src/views`, `src/components`, `src/stores`, `src/api`, `src/composables`, `src/services`, `src/types`, `src/utils`)
- prefer small focused components
- provide loading / error / skeleton states
- provide accessibility-friendly markup (`aria-*`, semantic HTML, keyboard navigable)
- ensure clean UX
- use consistent TypeScript types derived from OpenAPI schema (`src/types/index.ts`)
- avoid duplication

---

## ❌ Constraints & Guardrails

Copilot MUST NOT:
🚫 call Kubernetes APIs directly  
🚫 call Keycloak Admin API (user management is Keycloak's responsibility)  
🚫 implement custom JWT validation (handled by backend)  
🚫 store access/refresh tokens in localStorage or sessionStorage (in-memory only!)  
🚫 add new libraries unless explicitly required  
🚫 invent backend endpoints  
🚫 use Vue or Options API (we use React 19 Function Components)  
🚫 use TypeScript `any` type (derive from `src/types/index.ts` / OpenAPI schema)  
🚫 break TypeScript typing discipline (`tsc -b` must pass)  
🚫 introduce CSS frameworks other than Tailwind  
🚫 invent authentication logic (use existing Keycloak OIDC flow)  
🚫 hardcode URLs or secrets  
🚫 ignore existing architecture  
🚫 bypass Keycloak login (no direct username/password forms in SPA)  

If Copilot is unsure:
→ Prefer minimal, extensible, conventional code
→ Follow patterns already used in repo
→ Check existing hooks (e.g. `useAuth`, `useRole`, `useToast`) before creating new ones

---

## 🧩 Architecture Rules (Frontend)

### State Management
Use Zustand (`create(...)`).
Keep stores focused: one domain = one store (`auth`, `app`, `course`, `deployment`, `admin-view`, `toast`).

### Components
- React Function Components with TypeScript (`.tsx`)
- Small, reusable, well-named components
- No inline styles, use Tailwind CSS and CSS variables (`--color-*`)

### API Layer
- Central Axios instance (`src/api/axios.ts`)
- Automatic Bearer token injection via Axios request interceptor
- 401 handling via Keycloak silent refresh / re-login
- API modules organized by resource (`src/api/*.api.ts`)
- Pattern: View / Hook → Store / API-module → Axios

### Authentication Layer
- **Keycloak OIDC** (Authorization Code + PKCE S256 via `oidc-client-ts`)
- Service: `src/services/keycloak.service.ts` for OIDC operations
- Service: `src/services/auth.service.ts` for `/users/me`
- Service: `src/services/lti-launch.ts` for Moodle LTI 1.3 launch codes
- Store: `useAuthStore` (Zustand)
- Flow:
  1. User clicks login → redirect to Keycloak
  2. Keycloak redirects back to `/callback` with auth code
  3. `keycloak.service` exchanges code for tokens (stored in memory)
  4. Frontend calls `/users/me` to get user profile from backend
  5. User is routed to target page or `/dashboard`

### Deployment Wizard
The multi-step deployment wizard follows this flow:
1. **Config (`NewDeploymentConfigView`)**: Select app version, deployment name, description, duration.
2. **Teams / Participants (`NewDeploymentGroupsAssignmentView`)**: Allocate students into individual or group teams.
3. **Variables (`NewDeploymentVariableView`)**: *Conditional step!* Automatically skipped if the app requires no configuration variables, resources, or network settings.
4. **Summary (`NewDeploymentSummaryView`)**: 3 clean summary cards (Deployment info, Participants, Settings).

---

## 🌍 Domain Objects

### User
- Roles: `student`, `teacher`, `admin`
- User object structure derived from OpenAPI schema in `src/types/index.ts`.

### App (Blueprint)
- Represents a deployable template (Docker container / KubeVirt VM).
- Described by `appstore.yaml`.
- Versioned via Git tags.
- Has optional configurable variables (files, booleans, strings, resources).

### Deployment
- Concrete instance of an App running on the cluster.
- Lifecycle: pending, running, completed, failed, etc.
- Live progress and logs streamed via Server-Sent Events (SSE).

### Course
- Groups students and teachers.
- Can be selected during deployment to auto-populate participants.

---

## 🧪 Testing Guidance

If Copilot generates tests:
- Use **Vitest** with **React Testing Library**
- Coverage gate: at least 85% lines (`npm run test:coverage`)
- Tests must pass Network Guard (mock network requests or use handlers)
- Focus on user interactions, accessibility, state transitions, and error handling.
