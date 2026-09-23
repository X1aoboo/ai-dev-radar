const STATUS_INFO = {
  UNCONFIGURED: { label: '未配置', color: 'default' },
  UNKNOWN: { label: '状态未知', color: 'default' },
  CONNECTED: { label: '已连接', color: 'green' },
  DEGRADED: { label: '连接降级', color: 'orange' },
  UNREACHABLE: { label: '无法连接', color: 'red' },
  AUTH_FAILED: { label: '认证失败', color: 'red' },
  SERVICE_MISMATCH: { label: '服务身份不匹配', color: 'red' },
  PROTOCOL_INCOMPATIBLE: { label: '协议不兼容', color: 'red' },
}

export function gatewayStatusInfo(status) {
  return STATUS_INFO[status] ?? STATUS_INFO.UNKNOWN
}

export function formatGatewayDate(value) {
  if (!value) return '—'
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
