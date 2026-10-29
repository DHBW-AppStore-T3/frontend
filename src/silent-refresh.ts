// Callback page of the silent token renew: Keycloak redirects the hidden
// iframe here, and the page hands the URL (with the authorization code) to
// the app in the parent window.
//
// Built from the app's own oidc-client-ts instead of loading it from a CDN:
// the page runs on the app's origin and sees the code, so it must not run
// third-party script (and the CSP allows scripts from 'self' only).
import { UserManager } from 'oidc-client-ts'

// The callback only posts the URL to the parent on this origin; it talks to
// no server, so the client settings are not needed here.
void new UserManager({ authority: '', client_id: '', redirect_uri: '', response_mode: 'query' })
  .signinSilentCallback()
