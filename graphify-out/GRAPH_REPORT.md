# Graph Report - frontend  (2026-09-16)

## Corpus Check
- 131 files · ~92,281 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1177 nodes · 1480 edges · 85 communities (58 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 66
- Community 67
- Community 68
- Community 69
- Community 71
- Community 72
- Community 73
- Community 74
- Community 83

## God Nodes (most connected - your core abstractions)
1. `vue` - 44 edges
2. `lucide-vue-next` - 35 edges
3. `vue-i18n` - 28 edges
4. `vue-router` - 22 edges
5. `compilerOptions` - 20 edges
6. `vitest` - 18 edges
7. `@vue/test-utils` - 16 edges
8. `compilerOptions` - 14 edges
9. `api` - 11 edges
10. `OsResourceBase` - 11 edges

## Surprising Connections (you probably didn't know these)
- `useAppStore` --indirect_call--> `userId()`  [INFERRED]
  src/stores/app.store.ts → tests/unit/views/DeploymentDetailView.spec.ts
- `Vue.js Logo` --conceptually_related_to--> `Frontend Technology Stack (Copilot Constraints)`  [INFERRED]
  src/assets/vue.svg → .github/copilot-instructions.md
- `SIX7 Logo (Favicon)` --semantically_similar_to--> `SIX7 Green Compact Logo`  [INFERRED] [semantically similar]
  public/logo.png → src/assets/onlySix7-green-withoutBackground.png
- `SIX7 Logo (Favicon)` --semantically_similar_to--> `SIX7 Click'n'Deploy White Logo`  [INFERRED] [semantically similar]
  public/logo.png → src/assets/Six7-white-withoutBackground.png
- `npm audit Finding — js-yaml/nanoid HIGH CVEs` --references--> `Security Job (npm audit + Trivy fs scan)`  [INFERRED]
  claude_docs/debugging/common-errors.md → .github/workflows/ci.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI/CD Pipeline: Typecheck, Test, Security, Build, Push** — github_workflows_ci_typecheck_job, github_workflows_ci_test_job, github_workflows_ci_security_job, github_workflows_ci_build_job, github_workflows_ci_image_scan_job, github_workflows_ci_push_job, github_workflows_ci_trigger_staging_job [EXTRACTED 1.00]
- **Deployment Wizard State + Guard + Live Updates** — claude_docs_architecture_routing_require_wizard_step_guard, claude_docs_architecture_state_deployment_draft, src_stores_deployment_store, claude_docs_architecture_state_sse_live_updates, readme_deployment_wizard_views [INFERRED 0.85]
- **Keycloak OIDC Authentication Flow** — src_composables_usekeycloak, src_stores_auth_store, claude_docs_decisions_2026_oidc_in_memory_tokens_oidc_in_memory_tokens_decision, public_silent_refresh_silent_refresh_html, claude_docs_architecture_api_client_request_interceptor [INFERRED 0.90]

## Communities (85 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (64): activeDataTask, activeTask, authStore, canDelete, canPause, canPauseOrResume, canResume, copiedKey (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (44): API-Client & Fehlerbehandlung Doc, dompurify Dependency, Frontend Overview, js-yaml Dependency, requireWizardStep Guard, Routing Doc, DeploymentDraft State, Pinia Stores Doc (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (41): activeTab, app, appBannerStatus, appId, approvalByVersion, approvals, authStore, canDelete (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (44): ApiError, AppCreate, AppUIConfig, AppUpdate, AppVariable, AppVariableMarkerError, AppVariableOsType, AppVersionApprovalStatus (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (43): adapt(), closeDropdown(), disableFreeText(), dropdownEl, emit, enableFreeText(), errorMessage, errorReason (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): activeTooltip, appStore, canSubmit, deploymentStore, effectiveScope(), formatSlotLabel(), formValues, handleNext() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (31): Request Interceptor (Bearer Token Injection), Response Interceptor — 401 Handling, Response Interceptor — 403 Handling (Logged Only), 401 Redirect Loop After Expired Session, LoginView, appApi, authApi, AuthToken (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (33): Backend UserRole Enum (app/models.py), UserRole Type, npm run build Includes Type-Checking, env.ts (Runtime + Build-Time Config), Lokales Setup Stolpersteine Doc, Manual Backend Enum Mirroring (No OpenAPI Client), App Domain Object (Blueprint/Template), Copilot Instructions (Frontend) (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (36): dompurify, marked, applyCodeBlock(), applyLinePrefix(), applyLink(), applyWrap(), autoResize(), emit (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (16): activeGroupIndex, draggedStudent, dragOverGroup, dragOverUnassigned, ensureDefaultGroupNames(), groupCount, groupNames, mode (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (23): closeAddModal(), courseId, courseStore, editNameValue, isAddingMembers, isEditingName, isSearching, { isStaff } (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (26): activeTab, allStudents, cacheStudents(), courses, coursesError, courseStudentsCache, credStore, filteredStudents (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (25): actingOn, approvalsMap, apps, expandedAppId, handleReject(), handleRevoke(), isLoading, isRejecting (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (24): appStore, appVariables, asOsResourceType(), deploymentStore, fetchAndSyncVariables(), fileVarSummaries, _formatSubmitError(), formatValue() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (11): @pinia/testing, vitest, vue-router, @vue/test-utils, layout, route, mockPush, mockToastError (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (17): In-Memory Token Handling, In-Memory Tokens Instead of localStorage (ADR), oidc-client-ts (CDN, unpkg), signinSilentCallback Flow, oidc-client-ts, isAuthenticated, isLoading, refreshTokenSingleFlight() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, composite, emitDeclarationOnly, erasableSyntaxOnly, lib, module, moduleDetection (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (18): activeTab, buildPayload(), credStore, formApp, formPwd, handleSave(), handleYamlFile(), isDragging (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (11): mockConfirm, mockFetch, mockPush, mockRemove, mockSave, mockTest, mockToastError, mockToastSuccess (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (11): courseStore, courseToDelete, formData, isDeleting, { isStaff }, memberCounts, router, showDeleteModal (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (17): @vue/tsconfig/tsconfig.dom.json, compilerOptions, composite, emitDeclarationOnly, erasableSyntaxOnly, noEmit, noFallthroughCasesInSwitch, noUncheckedSideEffectImports (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (16): fileInputRef, fileToDataUrl(), form, handleDrop(), handleFileChange(), handleSubmit(), iconColorClass, imagePreviewUrl (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (13): mockAuthUserId, mockDeployment, mockIsTeacherOrAdmin, mocks, mockStreamConnectionState, mockStreamCurrentPhase, mockStreamCurrentPhaseIndex, mockStreamLiveLogs (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (15): name, private, type, version, autoprefixer, happy-dom, postcss, tailwindcss (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, happy-dom, @pinia/testing, postcss, tailwindcss, @tailwindcss/typography, @types/js-yaml (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (11): mockAddMembers, mockCan, mockCurrentMembers, mockFetchCourseById, mockFetchCourses, mockIsStaff, mockPush, mockRemoveMember (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (12): authStore, { isAdmin, isStaff }, isMeshBgActive, { locale, t }, { logout }, navItems, pageTitle, route (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (12): approvalsMap, apps, authStore, badgeStatusForApp(), fetchApps(), filteredApps, isLoading, isOwnApp() (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): axios, error, loading, needsCredentials, quotas, useQuotas(), writeCachedQuotas(), extractError() (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (12): clearFile(), emit, fileInputRef, fileToBase64(), hasValue, isDragging, localError, onDrop() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (7): lucide-vue-next, config, props, { t }, authStore, error, router

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (7): borderClass, emit, props, { t }, toggleFocus, toggleOn, update()

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (9): cache, CachedItem, CacheEntry, cacheVersion, ensureLoaded(), fetchList(), getFresh(), prime() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (4): vue, allow, { isAdmin, isStaff }, props

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (9): detail, emit, errorMessage, isLoading, lifecyclePillClass, lifecycleTone, props, { t } (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (9): mockCan, mockCourses, mockCreateCourse, mockDeleteCourse, mockFetchCourses, mockIsStaff, mockPush, mockToastError (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (11): dependencies, axios, dompurify, js-yaml, lucide-vue-next, marked, oidc-client-ts, pinia (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (7): vue-i18n, progressWidth, props, steps, { t }, router, { t }

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (10): cardBorderClass, driftBanner, emit, flavorBrief, pillClass, pillText, pillTone, props (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (8): authStore, credStore, firstName, { formattedQuotas, loading: quotasLoading, needsCredentials, hasCachedQuotas, fetchQuotas, getColorClass }, { isStaff }, { stats, fetchStats }, { t }, timeGreeting

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (5): mockFetchCredentials, mockFetchQuotas, mockFetchStats, mockUser, TODO: Tests gegen die neue View-Struktur neu schreiben (main hat

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (5): mockApps, mockDeployments, mockFetchApps, mockFetchDeployments, TODO: Tests gegen die neue View-Struktur neu schreiben (main hat

### Community 42 - "Community 42"
Cohesion: 0.36
Nodes (7): js-yaml, AnyMap, asMap(), asString(), CloudsYamlError, parseCloudsYaml(), ParsedCloudsYaml

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (5): deploymentTimestamp, appStore, deploymentStore, formatDate(), sortedDeployments

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (7): mockBack, mockDeploymentDraft, mockDeploymentReset, mockPush, mockToastError, mockToastSuccess, mockToastWarning

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (7): scripts, build, dev, preview, test, test:coverage, test:watch

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (6): authStore, createdDate, roleBadgeVariant, roleLabel, { t }, user

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (5): OpenStackAuthType, OpenStackCredentialBase, OpenStackCredentialFromYaml, OpenStackCredentialResponse, OpenStackCredentialUpsert

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (5): ComputeQuotas, NetworkQuotas, QuotaItem, QuotaOverview, StorageQuotas

### Community 49 - "Community 49"
Cohesion: 0.50
Nodes (5): Frontend Architecture Rules, authStore (Pinia), OIDC Login Flow (Keycloak PKCE), useAuth() Composable, useKeycloak() Composable

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (4): ctaLocation, props, styles, Variant

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (5): confirmDelete(), confirmPauseResume(), confirmRedeploy(), executeRedeploy(), loadTasks()

### Community 54 - "Community 54"
Cohesion: 0.40
Nodes (3): authStore, route, router

### Community 57 - "Community 57"
Cohesion: 0.50
Nodes (4): AppQueryParams, DeploymentQueryParams, PaginationParams, UserQueryParams

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): App = Deployment Blueprint, OpenStack AppStore Domain, High Level Architecture (Frontend to OpenStack)

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (3): App, AppDefinition, AppWithUser

### Community 61 - "Community 61"
Cohesion: 1.00
Nodes (3): confirmSubmit(), fetchApprovals(), withdrawVersion()

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (3): handleEditDrop(), handleEditFileChange(), processEditFile()

## Knowledge Gaps
- **626 isolated node(s):** `docker-entrypoint.sh script`, `name`, `private`, `version`, `type` (+621 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 816 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `Community 33` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 19`, `Community 21`, `Community 22`, `Community 23`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 32`, `Community 34`, `Community 35`, `Community 37`, `Community 38`, `Community 39`, `Community 43`, `Community 44`, `Community 46`, `Community 50`, `Community 54`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `lucide-vue-next` connect `Community 30` to `Community 0`, `Community 2`, `Community 4`, `Community 5`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 19`, `Community 21`, `Community 23`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 33`, `Community 34`, `Community 37`, `Community 38`, `Community 39`, `Community 43`, `Community 46`, `Community 50`, `Community 54`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **Why does `vue-i18n` connect `Community 37` to `Community 0`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 17`, `Community 19`, `Community 21`, `Community 23`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 34`, `Community 38`, `Community 39`, `Community 46`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `name`, `private` to the rest of the system?**
  _626 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.024691358024691357 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05141242937853107 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._