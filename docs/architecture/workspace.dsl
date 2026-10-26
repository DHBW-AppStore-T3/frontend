workspace "DHBW AppStore – Frontends" "Ist-Architektur der beiden Frontends: Frontend (React-SPA, dev @ 916c93f) und self-service-ui (Fork, dev @ 1e67bd1). Beides ist der Stand von dev und damit von Staging, Stand 2026-10-26. Prod läuft auf älteren Ständen (siehe architecture.md)." {

    !impliedRelationships true

    configuration {
        scope softwaresystem
    }

    model {

        // ------------------------------------------------------------ Personen
        student = person "Studierende" "Nutzen den Katalog und ihre Deployments als Team-Mitglied."
        teacher = person "Dozierende" "Registrieren Apps und starten Deployments für Kurse."
        admin = person "Administrierende" "Geben Versionen frei und steuern Empfehlungen."

        // ---------------------------------------------------------- Fremdsysteme
        keycloak = softwareSystem "Keycloak" "Identity Provider (OIDC, Realm dhbw)." "Extern"
        moodle = softwareSystem "Moodle" "Lernplattform, startet das Frontend per LTI 1.3." "Extern"
        openstack = softwareSystem "OpenStack" "Keystone-Prüfung der Zugangsdaten, VM-Laufzeit (vm-executor)." "Extern"
        kubernetes = softwareSystem "Kubernetes (k3s)" "Laufzeit der Apps: Pods (Namespace dep-{id}) und KubeVirt-VMs." "Extern"

        // ------------------------------------------------------------ AppStore
        appstore = softwareSystem "DHBW AppStore" "Apps verwalten, deployen und Deployments verfolgen, über zwei Oberflächen." {

            // ---- Frontend (React-SPA)
            gateway = container "Frontend-Web-Server (nginx)" "Liefert die SPA aus, setzt Sicherheits-Header, ist in Kubernetes das Gateway für /api." "nginx-unprivileged" "Server"

            spa = container "Frontend-SPA" "Läuft im Browser: Katalog, Wizard, Deployment-Detail, Kurse, Admin." "React 19, TypeScript, Vite" "Browser" {

                c_bootstrap = component "Bootstrap" "Startsequenz: Theme, LTI, Auth, Render (main, bootstrap, env)." "React"
                c_router = component "Router & Guards" "Routen, Lazy-Loading, Login-, Rollen- und Wizard-Guards, Error Boundaries (router/)." "React Router 7"
                c_layouts = component "Layouts" "Auth-, App- und User-Rahmen (layouts/)." "React"
                c_views = component "Views & Feature-Hooks" "20 Seiten mit eigenen Hooks (views/)." "React"
                c_ui = component "UI-Komponenten" "Wiederverwendbare Bausteine, RouteError (components/)." "React, Tailwind CSS"
                c_composables = component "Composables" "Querschnitts-Hooks wie useRole, useToast (composables/)." "React Hooks"
                c_stream = component "Live-Stream-Client" "SSE per fetch, Reconnect mit Backoff (useDeploymentStream)." "fetch, ReadableStream"
                c_stores = component "Stores" "Gemeinsamer Zustand inkl. Wizard-Draft (stores/)." "Zustand 5"
                c_api = component "API-Layer" "axios mit Token- und 401-Interceptor, *.api.ts je Ressource (api/)." "axios"
                c_auth = component "Auth-Services" "OIDC, User-Cache, LTI-Einlösung (services/)." "oidc-client-ts"
                c_silent = component "Silent-Refresh-Seite" "Iframe-Callback der stillen Anmeldung (silent-refresh)." "oidc-client-ts"
                c_i18n = component "i18n" "Mehrsprachigkeit DE/EN, Rollenlabels (i18n/)." "react-i18next"
                c_theme = component "Theming" "White-Label-Branding, Standard t3 (theme/)." "CSS Custom Properties"
                c_shared = component "Utils, Config & Types" "Helfer, Kataloge, OpenAPI-Typen (utils, config, types)." "TypeScript"
            }

            // ---- self-service-ui (Fork von pfisterer/self-service-ui)
            ssu_proxy = container "oauth2-proxy (self-service-ui)" "Meldet bei Keycloak an, hält die Sitzung als Cookie, setzt den Access-Token als Bearer." "oauth2-proxy v7.15" "Server"

            ssu_web = container "Web-Server (Caddy, self-service-ui)" "Liefert die SPA und config.js, leitet /api/app-store/ an die API." "Caddy" "Server"

            ssu_spa = container "self-service-ui-SPA" "Läuft im Browser: Katalog, Wizard, Deployments, Zugangsdaten. Rest ist Upstream-Code." "React 19, Vite, Mantine" "Browser" {

                c_ssu_shell = component "Shell & Upstream-Rahmen" "Einstieg, Routen, Navigation, Header, Feature-Flags (index, nav, features)." "React, wouter"
                c_ssu_auth = component "Auth & Session" "Identität vom Proxy, Session-Probe bei Fokus, Dialog bei Ablauf (providers/)." "React Context, fetch"
                c_ssu_views = component "App-Store-Seiten" "Katalog, Details, Deployments, Detail, Zugangsdaten, Einstellungen, Hilfe (app-store/)." "React, Mantine"
                c_ssu_wizard = component "Deploy-Wizard" "Vier Schritte, Logik aus dem Frontend übernommen (app-store/wizard/)." "React"
                c_ssu_queries = component "Queries & Rollen" "TanStack-Query-Hooks, Rollen, Admin-Ansicht, Polling, Live-Log (queries.jsx)." "TanStack Query, EventSource"
                c_ssu_api = component "App-Store-API-Client" "fetch same-origin, Listen seitenweise, 401-Callback (api.js)." "fetch"
                c_ssu_upstream = component "Upstream-Bereiche (aus)" "DNS, Cloud, LLM, Workspaces, Tokens: im Code, per Feature-Flag abgeschaltet." "React, Upstream-Clients" "Abgeschaltet"
            }

            backend = container "Backend-API" "Außerhalb des Scopes: API-Vertrag, Tokens, SSE-Stream." "FastAPI (Python)" "Ausserhalb"
            worker = container "Worker" "Außerhalb des Scopes: führt Deployments aus (pod-deployer, vm-executor)." "Python" "Ausserhalb"
        }

        // ------------------------------------------- Beziehungen: Personen und Fremdsysteme
        student -> c_views "Nutzt Katalog, Deployments, Zugangsdaten" "Browser"
        teacher -> c_views "Nutzt Apps, Kurse, Wizard" "Browser"
        admin -> c_views "Nutzt Freigaben, Admin-Einstellungen" "Browser"
        student -> c_ssu_views "Nutzt Katalog und Deployments" "Browser"
        teacher -> c_ssu_views "Nutzt Katalog, Wizard, Zugangsdaten" "Browser"
        admin -> c_ssu_views "Nutzt Admin-Ansicht" "Browser"
        student -> ssu_proxy "Öffnet die Adresse von self-service-ui" "Browser"
        student -> moodle "Öffnet die AppStore-Aktivität" "Browser"
        student -> keycloak "Meldet sich an" "Browser"

        moodle -> backend "LTI-1.3-Launch" "HTTPS, LTI 1.3"
        moodle -> spa "Bettet per iframe ein" "HTTPS"
        backend -> c_bootstrap "Leitet nach dem Launch zur SPA" "HTTP-Redirect"
        keycloak -> c_router "Leitet zurück auf /callback" "HTTP-Redirect"
        keycloak -> c_silent "Leitet im Iframe zurück" "HTTP-Redirect"
        keycloak -> ssu_proxy "Leitet zurück auf /oauth2/callback" "HTTP-Redirect"

        backend -> worker "Reiht Deployment-Jobs ein" "Postgres-Queue"
        backend -> openstack "Prüft Zugangsdaten" "OpenStack-API"
        backend -> kubernetes "Liest Workload-Status" "Kubernetes-API"
        worker -> kubernetes "Legt Namespaces und Pods an" "Kubernetes-API"
        worker -> openstack "Baut VMs (vm-executor)" "OpenStack-API"

        gateway -> spa "Liefert HTML, JS, CSS, env-config.js" "HTTPS"
        gateway -> backend "Reverse-Proxy /api/ (Präfix entfernt)" "HTTP"

        ssu_proxy -> keycloak "Login-Redirect, Code einlösen, Token erneuern" "OIDC, PKCE S256"
        ssu_proxy -> ssu_web "Leitet weiter, setzt Authorization: Bearer" "HTTP"
        ssu_web -> ssu_spa "Liefert SPA und config.js" "HTTP"
        ssu_web -> backend "Reverse-Proxy /api/app-store/ (Präfix entfernt)" "HTTP"

        // ------------------------------------------- Beziehungen: Komponenten des Frontends
        c_bootstrap -> c_theme "wendet Theme an"
        c_bootstrap -> c_auth "löst LTI-Code ein"
        c_bootstrap -> c_stores "initialisiert Auth"
        c_bootstrap -> c_router "rendert"

        c_router -> c_layouts "Layout-Routen"
        c_router -> c_views "lädt lazy"
        c_router -> c_stores "Guards lesen Zustand"
        c_router -> c_ui "Toast-Host, RouteError"
        c_router -> c_i18n "Texte"

        c_layouts -> c_ui "Sidebar, Header"
        c_layouts -> c_composables "useRole"
        c_layouts -> c_stores "Auth-Zustand"
        c_layouts -> c_theme "Branding"
        c_layouts -> c_i18n "Sprachwahl"

        c_views -> c_ui "setzt zusammen"
        c_views -> c_composables "nutzt Hooks"
        c_views -> c_stores "liest, schreibt"
        c_views -> c_api "⚠ direkt, an den Stores vorbei" "axios" "Abweichung"
        c_views -> c_stream "startet, stoppt"
        c_views -> c_router "paths, navigate"
        c_views -> c_i18n "Texte"
        c_views -> c_shared "Helfer, Typen"

        c_ui -> c_composables "useOverlay, useToast"
        c_ui -> c_stores "Toast-Store"
        c_ui -> c_shared "Helfer, Typen"

        c_composables -> c_stores "useRole, useAuth"
        c_composables -> c_api "Dashboard" "axios"

        c_stores -> c_api "Fetch-Aktionen" "axios"
        c_stores -> c_auth "Login, fetchMe"
        c_stores -> c_shared "Fehlertexte, Payload"

        c_api -> c_auth "Token, 401-Behandlung"
        c_auth -> c_api "⚠ fetchMe, LTI-Session" "axios" "Abweichung"
        c_stream -> c_auth "Access-Token holen"

        c_auth -> c_silent "lädt Iframe" "iframe"
        c_silent -> c_auth "Callback-URL" "postMessage"
        c_auth -> keycloak "Login, Token, UserInfo, Logout" "HTTPS, OIDC"

        c_api -> backend "REST, Bearer-Token" "HTTPS, JSON (in K8s über das Gateway)"
        c_stream -> backend "GET …/stream" "HTTPS, SSE (in K8s über das Gateway)"
        backend -> c_stream "SSE-Events" "SSE"

        // ------------------------------------------- Beziehungen: Komponenten von self-service-ui
        c_ssu_shell -> c_ssu_auth "AuthProvider, SessionProvider"
        c_ssu_shell -> c_ssu_views "lädt /app-store lazy"
        c_ssu_shell -> c_ssu_upstream "Routen nur mit Feature-Flag (aus)" "" "Abgeschaltet"
        c_ssu_views -> c_ssu_queries "nutzt Hooks"
        c_ssu_views -> c_ssu_wizard "Route /apps/:id/deploy"
        c_ssu_views -> spa "Übergabe per Link: Apps und Versionen verwalten" "Browser-Link"
        c_ssu_wizard -> c_ssu_queries "Runtime, Variablen, Anlegen"
        c_ssu_queries -> c_ssu_api "ruft"
        c_ssu_queries -> c_ssu_auth "useSession"
        c_ssu_api -> c_ssu_auth "401: expire()"

        c_ssu_api -> ssu_proxy "fetch /api/app-store/ (Cookie)" "HTTPS, JSON"
        c_ssu_queries -> ssu_proxy "EventSource …/stream (Cookie)" "HTTPS, SSE"
        c_ssu_auth -> ssu_proxy "/oauth2/userinfo, /oauth2/auth, /oauth2/start, /oauth2/sign_out" "HTTPS"
        backend -> c_ssu_queries "SSE-Events" "SSE"

        // ------------------------------------------- Laufzeitumgebung
        deploymentEnvironment "Kubernetes" {

            deploymentNode "Gerät der Nutzer" "Studierende, Dozierende, Administrierende." "Desktop oder Laptop" {
                deploymentNode "Webbrowser" "Frontend: Tokens nur im Speicher. self-service-ui: nur das Proxy-Cookie." "Chrome, Firefox, Safari" {
                    spaInstance = containerInstance spa
                    ssuSpaInstance = containerInstance ssu_spa
                }
            }

            deploymentNode "k3s-Cluster" "Ein Node, Staging und Prod getrennt per Namespace." "Kubernetes (k3s)" {
                deploymentNode "Namespace appstore-staging / appstore-prod" "dev → Staging, main → Prod, Rollout per Argo CD." "Kubernetes-Namespace" {

                    ingress = infrastructureNode "Ingress (Frontend)" "Ein Host je Umgebung (TLS), zeigt auf das Frontend." "Ingress-Controller, cert-manager"
                    ssuIngress = infrastructureNode "Ingress (self-service-ui)" "Eigener Host, ein Label unter der Zone (Wildcard-Zertifikat), zeigt auf den Proxy :4180." "Ingress-Controller"

                    deploymentNode "Deployment frontend" "2 Replikate, UID 101, read-only Root." "Kubernetes Deployment" {
                        gatewayInstance = containerInstance gateway
                    }
                    deploymentNode "Deployment self-service-ui" "1 Replika, ein Pod mit zwei Containern, UID 65532, read-only Root." "Kubernetes Deployment" {
                        ssuProxyInstance = containerInstance ssu_proxy
                        ssuWebInstance = containerInstance ssu_web
                    }
                    deploymentNode "Deployment api" "2 Replikate, ohne eigenen Ingress." "Kubernetes Deployment" {
                        backendInstance = containerInstance backend
                    }
                    deploymentNode "Worker" "pod-deployer in Staging und Prod, vm-executor nur in Prod." "Kubernetes Deployments" {
                        workerInstance = containerInstance worker
                    }

                    keycloakInstance = softwareSystemInstance keycloak
                    moodleInstance = softwareSystemInstance moodle
                }
            }

            spaInstance -> ingress "Seite, /api, SSE" "HTTPS"
            ingress -> gatewayInstance "Leitet je Host weiter" "HTTP"
            ssuSpaInstance -> ssuIngress "Seite, /oauth2/, /api/app-store/" "HTTPS"
            ssuIngress -> ssuProxyInstance "Leitet je Host weiter" "HTTP"
        }
    }

    views {

        systemContext appstore "context" "Systemkontext: Wer nutzt den AppStore über seine zwei Oberflächen, und welche Fremdsysteme sind beteiligt." {
            include *
            autoLayout lr
        }

        container appstore "containers" "Container: zwei Oberflächen mit je eigenem Web-Server, dazu Backend und Worker. Personen, OpenStack und Kubernetes zeigt der Kontext." {
            include gateway spa ssu_proxy ssu_web ssu_spa backend worker keycloak moodle
            autoLayout lr
        }

        component spa "components" "Frontend: Schichtung nach Verzeichnissen. Rote Pfeile mit Warnzeichen weichen von der dokumentierten Schichtung ab." {
            include c_bootstrap c_router c_layouts c_views c_ui c_composables c_stores c_api c_auth c_i18n c_theme c_shared
            exclude "* -> c_i18n"
            exclude "* -> c_theme"
            exclude "* -> c_shared"
            autoLayout tb
        }

        component spa "components-runtime" "Frontend: Auth, Session und Live-Stream, die Bausteine, die mit Keycloak, Moodle und dem Backend sprechen." {
            include c_bootstrap c_stores c_api c_auth c_silent c_stream backend keycloak moodle
            autoLayout lr
        }

        component ssu_spa "components-ssu" "self-service-ui: Bausteine der SPA und ihr Weg über Proxy und Caddy zur API." {
            include c_ssu_shell c_ssu_auth c_ssu_views c_ssu_wizard c_ssu_queries c_ssu_api c_ssu_upstream ssu_proxy spa
            autoLayout tb
        }

        dynamic spa "dyn-login" "Frontend: Anmeldung per OIDC Authorization Code + PKCE" {
            student -> c_views "Klickt „Anmelden“ (LoginView)"
            c_views -> c_stores "auth.login(returnUrl)"
            c_stores -> c_auth "keycloak.login(): returnUrl in sessionStorage, signinRedirect()"
            c_auth -> keycloak "Redirect zum Login-Endpunkt (code_challenge S256)"
            keycloak -> c_router "Redirect auf /callback?code=…&state=…"
            c_router -> c_views "Guard lässt /callback zu, lädt CallbackView"
            c_views -> c_stores "auth.handleCallback()"
            c_stores -> c_auth "signinRedirectCallback(): Code einlösen"
            c_auth -> keycloak "Token-Endpunkt: Code + code_verifier → Tokens (nur im Speicher)"
            c_stores -> c_auth "AuthService.fetchMe()"
            c_auth -> c_api "userApi.getMe()"
            c_api -> backend "GET /users/me mit Bearer-Token"
            c_views -> c_router "navigate(returnUrl)"
        }

        dynamic spa "dyn-session" "Frontend: Seiten-Reload, Sitzung still wiederherstellen" {
            c_bootstrap -> c_stores "auth.initialize() vor dem ersten Render"
            c_stores -> c_auth "keycloak.initialize(): Speicher leer → signinSilent()"
            c_auth -> keycloak "Versteckter Iframe: /auth?prompt=none (SSO-Cookie)"
            keycloak -> c_silent "Redirect auf silent-refresh.html?code=…"
            c_silent -> c_auth "postMessage(URL) an das Eltern-Fenster"
            c_auth -> keycloak "Token-Endpunkt: Code einlösen"
            c_stores -> c_auth "fetchMe(), bis dahin gilt der User aus localStorage"
            c_auth -> c_api "userApi.getMe()"
            c_api -> backend "GET /users/me mit Bearer-Token"
            c_bootstrap -> c_router "Rendert die App"
        }

        dynamic spa "dyn-fetch" "Frontend: Standard-Datenfluss mit Token und 401-Behandlung (Beispiel: App-Katalog)" {
            student -> c_views "Öffnet /apps"
            c_views -> c_stores "appStore.fetchApps()"
            c_stores -> c_api "appApi.list() über runRequest (isLoading, error)"
            c_api -> c_auth "Request-Interceptor: getAccessToken(), bei Ablauf Single-Flight-Refresh"
            c_api -> backend "GET /apps/ mit Bearer-Token"
            c_api -> c_auth "Bei 401: ensureValidToken(), scheitert das: keycloak.login(returnUrl)"
        }

        dynamic spa "dyn-lti" "Frontend: Start aus Moodle per LTI 1.3 (Einmal-Code im URL-Fragment)" {
            student -> moodle "Öffnet die AppStore-Aktivität"
            moodle -> backend "LTI-Launch: OIDC-Login und id_token"
            backend -> c_bootstrap "Setzt Binding-Cookie, leitet auf die SPA mit #lti=1&code=…"
            c_bootstrap -> c_auth "takeLtiLaunch(): Code lesen, Adresszeile bereinigen"
            c_bootstrap -> c_auth "redeemLtiCode(code)"
            c_auth -> c_api "POST /lti13/session (withCredentials)"
            c_api -> backend "Code + Cookie → session_token, email, role"
            c_bootstrap -> c_stores "setLtiUser(): Stub-User, Token statt Keycloak"
            c_stores -> c_auth "fetchMe()"
            c_auth -> c_api "userApi.getMe()"
            c_api -> backend "GET /users/me (Bearer = LTI-Session-Token)"
            c_bootstrap -> c_router "Rendert die App"
        }

        dynamic spa "dyn-deploy" "Frontend: Deployment starten, App-Detail → Wizard → Absenden" {
            teacher -> c_views "App-Detail: „Deployment starten“"
            c_views -> c_stores "updateDraft(appId, Version, Laufzeit)"
            c_views -> c_router "navigate(/deployment/new/config)"
            c_router -> c_stores "Guard: Rolle staff und Wizard-Schritt (appId, name, studentIds)"
            c_views -> c_api "GET /apps/{id}/runtime, /variables, GET /users/search"
            c_api -> backend "Anfragen mit Bearer-Token"
            c_views -> c_stores "updateDraft: Name, Studierende → Teams → Variablen"
            c_views -> c_stores "submitDraft(): Payload aus Teams, userInputVar, files"
            c_stores -> c_api "deploymentApi.create()"
            c_api -> backend "POST /deployments/ (Antwort: angelegtes Deployment)"
            backend -> worker "Reiht den Deployment-Job ein, Ausführung läuft asynchron"
            c_views -> c_router "resetDraft, Toast, navigate(/deployments)"
        }

        dynamic spa "dyn-sse" "Frontend: Live-Fortschritt für Eigentümer und Dozierende (SSE)" {
            teacher -> c_views "Öffnet /deployments/:id"
            c_views -> c_stores "fetchDeploymentById() → GET /deployments/{id}"
            c_views -> c_api "GET /tasks/deployment/{id}, /my-access, /resources"
            c_api -> backend "Anfragen mit Bearer-Token"
            c_views -> c_stream "start(), sobald Owner-Ansicht und Task PENDING oder RUNNING"
            c_stream -> c_auth "getAccessToken()"
            c_stream -> backend "GET /deployments/{id}/stream (Accept: text/event-stream)"
            backend -> c_stream "Events: snapshot, progress, log – Ende mit succeeded, failed oder revoked"
            c_views -> c_stores "Stream beendet: Deployment und Tasks neu laden, Soft-Delete erkennen"
        }

        dynamic spa "dyn-poll" "Frontend: Statusanzeige für Mitglieder ohne Stream (Polling)" {
            student -> c_views "Öffnet /deployments/:id (Mitglied, kein Owner)"
            c_views -> c_api "GET /deployments/{id} alle 10 s (setTimeout-Kette, AbortController)"
            c_api -> backend "Anfrage mit Bearer-Token, Antwort: aktueller Status"
            c_views -> c_stores "currentDeployment setzen, nur bei Änderung"
            c_views -> c_api "Ende des Pollings: GET /deployments/{id}/my-access (Zugangsdaten)"
            c_api -> backend "Anfrage mit Bearer-Token"
        }

        dynamic appstore "dyn-ssu-login" "self-service-ui: Anmeldung über den oauth2-proxy (BFF), der Browser hält nur ein Cookie" {
            student -> ssu_proxy "Öffnet die Adresse, noch ohne Cookie"
            ssu_proxy -> keycloak "Redirect zum Login (Client appstore-self-service, PKCE S256)"
            student -> keycloak "Meldet sich an"
            keycloak -> ssu_proxy "Redirect auf /oauth2/callback?code=…"
            ssu_proxy -> keycloak "Löst den Code über die interne Cluster-URL ein, setzt das Session-Cookie"
            ssu_proxy -> ssu_web "Leitet an Caddy weiter, Authorization: Bearer (Access-Token)"
            ssu_web -> ssu_spa "Liefert SPA und config.js"
            ssu_spa -> ssu_proxy "GET /oauth2/userinfo (Cookie): E-Mail für die Anzeige"
            ssu_spa -> ssu_proxy "GET /api/app-store/users/me (Cookie)"
            ssu_proxy -> ssu_web "Setzt den Bearer ein, leitet weiter"
            ssu_web -> backend "Entfernt /api/app-store, ruft die API"
        }

        dynamic ssu_spa "dyn-ssu-session" "self-service-ui: Sitzung läuft ab, Probe bei Tab-Fokus und 401 als zweiter Auslöser" {
            c_ssu_auth -> ssu_proxy "Tab-Fokus: GET /oauth2/auth (202 gültig, 401 abgelaufen)"
            c_ssu_views -> c_ssu_queries "Ein Aufruf, zum Beispiel useDeployments()"
            c_ssu_queries -> c_ssu_api "api.deployments()"
            c_ssu_api -> ssu_proxy "GET /api/app-store/deployments/ ohne gültiges Cookie: 401 statt Login-Seite"
            c_ssu_api -> c_ssu_auth "onUnauthorized: expire(), Dialog „Sitzung abgelaufen“, Seite bleibt stehen"
            c_ssu_auth -> ssu_proxy "„Anmelden“: Vollseiten-Navigation zu /oauth2/start?rd=…"
        }

        dynamic ssu_spa "dyn-ssu-detail" "self-service-ui: Deployment-Detail mit Status-Polling (5 s) und Live-Log" {
            teacher -> c_ssu_views "Öffnet /app-store/deployments/:id"
            c_ssu_views -> c_ssu_queries "useDeployment(): alle 5 s, solange der Status in Bewegung ist"
            c_ssu_queries -> c_ssu_api "api.deployment(id)"
            c_ssu_api -> ssu_proxy "GET /api/app-store/deployments/{id}"
            ssu_proxy -> ssu_web "Setzt den Bearer ein, leitet weiter"
            ssu_web -> backend "Entfernt /api/app-store, ruft die API"
            c_ssu_views -> c_ssu_queries "useDeploymentStream(): nur Owner-Ansicht und laufende Task"
            c_ssu_queries -> ssu_proxy "new EventSource(…/stream, withCredentials)"
            backend -> c_ssu_queries "Events: snapshot, progress, log, overflow, started, succeeded, failed, revoked"
            c_ssu_queries -> c_ssu_api "Task endet: Stream zu, Deployment, Tasks und Liste neu laden"
        }

        deployment appstore "Kubernetes" "deployment-k8s" "Laufzeitumgebung in Staging und Prod (gleicher Aufbau, je ein Namespace). Keycloak und Moodle laufen im selben Namespace und sind hier ausgeblendet." {
            include *
            exclude keycloakInstance
            exclude moodleInstance
            // Aus den logischen Beziehungen abgeleitete Direktpfeile Browser <-> Server: physisch läuft alles über den Ingress.
            exclude "spaInstance -> backendInstance"
            exclude "backendInstance -> spaInstance"
            exclude "backendInstance -> ssuSpaInstance"
            exclude "gatewayInstance -> spaInstance"
            exclude "ssuSpaInstance -> spaInstance"
            exclude "ssuSpaInstance -> ssuProxyInstance"
            exclude "ssuWebInstance -> ssuSpaInstance"
            autoLayout lr
        }

        styles {
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Extern" {
                background #8a8a8a
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Browser" {
                shape webBrowser
            }
            element "Ausserhalb" {
                background #b3b3b3
                color #1a1a1a
            }
            element "Component" {
                background #85bbf0
                color #0b2540
            }
            element "Abgeschaltet" {
                background #d9d9d9
                color #555555
                border dashed
            }
            relationship "Abweichung" {
                color #cc0000
                dashed true
                thickness 3
            }
        }
    }
}
