import api from './axios'
import type { QuotaOverview } from '@/types/quota'

// ----------------------------------------------------------------
// QUOTAS API
// ----------------------------------------------------------------
export const quotasApi = {
  /**
   * Quota and usage of the project behind one of the caller's OpenStack
   * credentials, asked live with that credential. 404 for anyone else's
   * credential, 502 when OpenStack does not answer.
   */
  getForCredential: (credentialId: string) => {
    return api.get<QuotaOverview>(`/me/openstack-credentials/${encodeURIComponent(credentialId)}/quota`)
  },
}
