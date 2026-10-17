# Copilot Instructions — Frontend (OpenStack AppStore)

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
- understand the domain: OpenStack AppStore for teaching environments
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
We are developing a **web-based AppStore for educational environments on OpenStack**.

The goal:
Teachers can deploy course environments **without deep OpenStack knowledge**.

Examples:
- Jupyter environments for exercises
- GitLab/Jenkins for student projects
- Pentest labs
- Kubernetes clusters for microservices or AI
- development environments

### What is an “App”?
Not a normal desktop app.

An **App = Deployment Blueprint**
- Infrastructure as Code (Terraform, possibly Packer)
- configuration logic
- parameters provided by teacher
- versionable + reproducible deployment package

### High Level Architecture
Frontend (React 19)  
↓  
Keycloak (Authentication & User Management)  
↓  
Backend (FastAPI)  
↓  
RabbitMQ (Message Broker)  
↓  
Worker (Celery / Terraform / Packer / Git)  
↓  
OpenStack

Important:
- Frontend talks **ONLY to the backend API**
- Frontend NEVER talks directly to OpenStack, RabbitMQ, or Keycloak Admin API
- Authentication via **Keycloak OIDC** (Authorization Code + PKCE)
- Backend validates JWT tokens from Keycloak
- Worker processes deployment tasks asynchronously via RabbitMQ/Celery
- Frontend is the UI for:
  - OIDC login flow (redirect to Keycloak)
  - managing apps
  - starting deployments
  - viewing deployment progress & results
  - user interactions (teachers, admins, students)

---

## 🛠️ Technology Stack (Copilot must respect this)

### Frontend
- React 19
- `<script setup>` Composition API
- **TypeScript**
- Vite
- Zustand (state)
- React Router 7
- Tailwind CSS
- Axios (HTTP client)
- react-i18next (internationalization)
- **oidc-client-ts** (Keycloak OIDC integration)

### Backend Stack (for context)
- FastAPI (Python)
- PostgreSQL (Backend DB)
- RabbitMQ (Celery message broker)
- Keycloak 23.0 (Identity Provider)
  - Separate PostgreSQL for Keycloak
  - Realm: `dhbw`
  - Roles: student, teacher, admin

### Infrastructure
- Docker Compose (development)
- Terraform + Packer (deployments via Worker)
- OpenStack (target infrastructure)

No new frameworks should be added without team discussion.

---

## ✅ Copilot Capabilities

Copilot is allowed to:

- create React function components
- build pages & views
- extend routing
- create hooks
- create Zustand stores
- extend existing UI
- call backend APIs
- suggest improvements consistent with existing code
- generate reusable, readable, maintainable code

Copilot should:
- respect existing folder structure
- prefer small focused components
- provide loading / error states
- provide accessibility-friendly markup
- ensure clean UX
- use consistent TypeScript types
- avoid duplication

---

## ❌ Constraints & Guardrails

Copilot MUST NOT:

🚫 call OpenStack APIs  
🚫 call RabbitMQ directly  
🚫 call Keycloak Admin API (user management is Keycloak's responsibility)  
🚫 implement custom JWT validation (handled by backend)  
🚫 add new libraries unless explicitly required  
🚫 invent backend endpoints  
🚫 add Options API  
🚫 use TypeScript `any` type  
🚫 break TypeScript typing discipline  
🚫 introduce CSS frameworks (we use Tailwind)  
🚫 invent authentication logic (use existing Keycloak OIDC flow)  
🚫 hardcode URLs or secrets  
🚫 ignore existing architecture  
🚫 bypass Keycloak login (no direct username/password forms)  

If Copilot is unsure:
→ Prefer minimal, extensible, conventional code
→ Follow patterns already used in repo
→ Check existing hooks (useAuth, useRole) before creating new ones

---

## 🧩 Architecture Rules (Frontend)

### State Management
Use Zustand.
Keep stores focused.
One domain = one store.

### Components
- use `<script setup lang="ts">`
- Composition API only
- small, reusable, well-named components
- no inline styles, use Tailwind

### API Layer
- Axios
- central API instance (`src/api/axios.ts`)
- automatic token injection via Axios interceptor
- automatic token refresh on 401
- no direct fetch calls
- service → store → view pattern

### Authentication Layer
- **Keycloak OIDC** (Authorization Code + PKCE)
- service: `keycloak` (src/services/keycloak.service.ts) for OIDC operations
- hook: `useAuth()` for auth state
- store: `useAuthStore` (Zustand) manages user state
- flow:
  1. User clicks login → redirect to Keycloak
  2. Keycloak redirects back to `/callback` with code
  3. `oidc-client-ts` exchanges code for tokens
  4. Frontend calls `/auth/me` to get user from backend
  5. Backend validates token + JIT user provisioning
- tokens stored in session/local storage by oidc-client-ts
- automatic silent refresh
- no password forms in frontend (all via Keycloak UI)

### Error Handling
- each async action has:
  - loading
  - error
  - retry logic

### UX
- clear states
- accessible components
- meaningful labels and messages
- consistent spacing & layout

---

## 🌍 Domain Objects (Copilot must keep these mental models)

### User
- **Managed by Keycloak** (not in frontend)
- Roles: `student`, `teacher`, `admin` (from Keycloak realm roles)
- Backend stores:
  - `keycloak_id` (UUID from Keycloak)
  - `email`, `name`
  - mapped to local user table via JIT provisioning
- Frontend receives user from `/auth/me` endpoint
- User object structure:
  ```typescript
  interface User {
    id: string;          // backend user ID
    keycloak_id: string; // Keycloak sub claim
    email: string;
    name: string;
    role: 'student' | 'teacher' | 'admin';
  }
  ```

### App (Blueprint / Template)
represents a deployable package
- Git repository with Terraform/Packer
- versioned (Git tags)
- has configurable variables
- owned by user

### Deployment
concrete instance of an App
- has lifecycle (pending, running, completed, failed)
- has logs (from Celery task)
- has output (URLs, credentials hints, Terraform outputs)
- linked to specific App version
- tracks user who deployed

### Course
optional association
- groups users (teacher + students)
- can be linked to deployments

---

## 🧪 Testing Guidance

If Copilot generates tests:

- Use Vitest
- Use React Testing Library
- Focus on:
  - rendering
  - behavior
  - state transitions
  - critical flows

Do not:
- write meaningless snapshot tests
- overmock
- test implementation instead of behavior

---

## 🧭 Examples of GOOD Copilot Output

Copilot should generate code like:

### Example 1: Protected Route Component
```tsx
import { useEffect, useState } from 'react'
import { deploymentService } from '@/services/deployment.service'

export function DeploymentsList() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    deploymentService
      .list()
      .then(setDeployments)
      .catch(() => setError('Failed to load deployments'))
      .finally(() => setLoading(false))
  }, [])

  // render loading / error / list
}
```

### Example 2: Using Keycloak service
```typescript
import { keycloak } from '@/services/keycloak.service'

const handleLogin = () => keycloak.login('/dashboard') // returnUrl
```

### Key Patterns:
- Uses existing hooks/stores
- TypeScript types
- Loading + error states
- Clean async/await
- Tailwind CSS classes
- No password forms (Keycloak redirect only)

---

## ❤️ Final Rule

Copilot should act like a **thoughtful teammate**, not a random code generator:

- be consistent
- be pragmatic
- respect the domain
- favor clarity
- write maintainable code
- support a real team working on a real product

If unsure → be careful and ask questions, do not hallucinate.

---
