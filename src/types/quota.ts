export interface QuotaItem {
  used: number
  /** -1: unlimited. */
  limit: number
  /** null when the limit is unlimited; negative when over quota. */
  available: number | null
  unit?: string | null
}

export interface ComputeQuotas {
  instances: QuotaItem
  vcpus: QuotaItem
  ram: QuotaItem
}

export interface StorageQuotas {
  volumes: QuotaItem
  snapshots: QuotaItem
  gigabytes: QuotaItem
}

export interface NetworkQuotas {
  floating_ips: QuotaItem
  security_groups: QuotaItem
  security_group_rules: QuotaItem
  networks: QuotaItem
  ports: QuotaItem
  routers: QuotaItem
}

export interface QuotaOverview {
  compute: ComputeQuotas
  storage: StorageQuotas
  network: NetworkQuotas
}
