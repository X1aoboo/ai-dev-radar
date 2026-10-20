import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Input, Select, Space, Spin, Tag, Typography } from 'antd'
import { InfoCircleOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons'

import { fetchJson } from '../../api'
import FocusRestoringDrawer from '../../components/FocusRestoringDrawer'
import PageHeader from '../../components/PageHeader'
import {
  METRIC_TYPE_FILTERS,
  METRIC_TYPE_META,
  metricFormula,
  metricMissingNote,
  metricSource,
  metricTypeLabel,
  metricTypeMeta,
  metricUsage,
} from './metricCatalog'
import './metric-dictionary.css'

const { Text } = Typography

function TypeTag({ metric }) {
  const meta = metricTypeMeta(metric)
  return <Tag className={`metric-type-tag metric-type-tag--${meta.tone}`}>{meta.label}</Tag>
}

function Formula({ metric }) {
  return <span className="metric-formula">{metricFormula(metric)}</span>
}

function UsageChips({ activity, metric }) {
  return (
    <span className="metric-usage">
      {metricUsage(activity, metric).map((page) => <span key={page} className="metric-usage__chip">{page}</span>)}
    </span>
  )
}

function MetricDetailDrawer({ value, onClose }) {
  if (!value) return null
  const { activity, metric } = value
  const meta = metricTypeMeta(metric)
  return (
    <FocusRestoringDrawer
      rootClassName="metric-detail-drawer"
      title={metric.name}
      open={Boolean(value)}
      size={560}
      onClose={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <div className="metric-detail">
        <div className="metric-detail__eyebrow">
          <Tag className={`metric-type-tag metric-type-tag--${meta.tone}`}>{meta.label}</Tag>
          <Text type="secondary">{activity.name} · {activity.kind === 'general' ? '通用研发能力' : '关键研发活动'}</Text>
        </div>

        <section className="metric-detail__formula-card" aria-label="计算公式">
          <div className="metric-detail__section-label">计算公式</div>
          <div className="metric-detail__formula">{metricFormula(metric)}</div>
          <div className="metric-detail__formula-note">
            {meta.label === '数量' || meta.label === '布尔' ? '没有分母' : '分子与分母均来自同一统计范围'}
          </div>
        </section>

        <div className="metric-detail__grid">
          <div className="metric-detail__field">
            <label>分子（业务含义）</label>
            <div>{metric.numerator_semantic}</div>
          </div>
          <div className="metric-detail__field">
            <label>分母（业务含义）</label>
            <div>{metric.denominator_semantic ?? '—'}</div>
          </div>
          <div className="metric-detail__field">
            <label>数据来源</label>
            <div>{metricSource(metric)}</div>
          </div>
          <div className="metric-detail__field">
            <label>使用位置</label>
            <div className="metric-detail__usage"><UsageChips activity={activity} metric={metric} /></div>
          </div>
        </div>

        <section>
          <div className="metric-detail__section-label">计算步骤</div>
          <ol className="metric-detail__steps">
            {meta.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>

        <section className="metric-detail__missing">
          <div className="metric-detail__section-label">缺失值处理</div>
          <p>{metricMissingNote(metric)}</p>
        </section>

        <Text type="secondary" className="metric-detail__source-note">
          定义来源：看板指标目录（代码/种子维护）。本页只读，修改口径需走设计评审。
        </Text>
      </div>
    </FocusRestoringDrawer>
  )
}

function TypeGuideDrawer({ open, onClose }) {
  return (
    <FocusRestoringDrawer
      rootClassName="metric-detail-drawer"
      title="计算方式说明"
      open={open}
      size={560}
      onClose={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <div className="metric-guide">
        <Text type="secondary">指标按计算方式分为五类。分子和分母的业务含义由每个指标单独定义。</Text>
        {Object.entries(METRIC_TYPE_META).map(([key, meta]) => (
          <section key={key} className="metric-guide__item">
            <div className="metric-guide__heading">
              <Tag className={`metric-type-tag metric-type-tag--${meta.tone}`}>{meta.label}</Tag>
            </div>
            <div className="metric-guide__formula">
              {key === 'penetration' && '分子 ÷ 分母'}
              {key === 'efficiency' && '（预估 − 实际）÷ 实际'}
              {key === 'count' && '分子合计'}
              {key === 'ratio' && '分子 ÷ 分母'}
              {key === 'boolean' && '最新周期状态（是 = 1，否 = 0）'}
            </div>
            <p>{meta.missing}</p>
          </section>
        ))}
      </div>
    </FocusRestoringDrawer>
  )
}

export default function MetricDictionaryPage({ onSessionExpired }) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState('all')
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchJson('/api/catalog')
      .then((data) => { if (active) { setCatalog(Array.isArray(data) ? data : []); setError(null) } })
      .catch((nextError) => {
        if (!active) return
        if (nextError.status === 401) onSessionExpired()
        setError(nextError)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onSessionExpired])

  const keyCount = catalog.filter((activity) => activity.kind === 'key').length
  const generalCount = catalog.filter((activity) => activity.kind === 'general').length
  const metricCount = catalog.reduce((count, activity) => count + (activity.metrics?.length ?? 0), 0)
  const typeCount = new Set(catalog.flatMap((activity) => (activity.metrics ?? []).map((metric) => metric.type))).size

  const filteredCatalog = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return catalog
      .map((activity) => ({
        ...activity,
        metrics: (activity.metrics ?? []).filter((metric) => {
          if (kind !== 'all' && activity.kind !== kind) return false
          if (type !== 'all' && metric.type !== type) return false
          if (!query) return true
          return [activity.name, activity.code, metric.name, metric.numerator_semantic, metric.denominator_semantic]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(query))
        }),
      }))
      .filter((activity) => activity.metrics.length > 0)
  }, [catalog, keyword, kind, type])

  function jumpTo(activityId) {
    setKeyword('')
    setKind('all')
    setType('all')
    window.setTimeout(() => {
      document.getElementById(`metric-group-${activityId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  return (
    <div className="metric-dictionary">
      <PageHeader
        className="metric-dictionary__header"
        eyebrow="指标口径"
        title="指标字典"
        description="查看看板指标的业务口径、计算公式、数据来源和使用位置。指标与看板图表一一对应，本页只读，不提供新增或编辑。"
        actions={(
          <Space wrap>
            <Tag className="metric-readonly-badge" icon={<LockOutlined />}>只读字典</Tag>
            <Button icon={<InfoCircleOutlined />} onClick={() => setGuideOpen(true)}>计算方式说明</Button>
          </Space>
        )}
      />

      <section className="metric-summary" aria-label="指标字典概览">
        <div className="metric-summary__cell"><div className="metric-summary__label">关键研发活动</div><div className="metric-summary__value"><strong>{keyCount}</strong><span>个</span></div><div className="metric-summary__note">SA / SE / 开发 / 编码 / 测试 / DTS</div></div>
        <div className="metric-summary__cell"><div className="metric-summary__label">通用研发能力</div><div className="metric-summary__value"><strong>{generalCount}</strong><span>个</span></div><div className="metric-summary__note">MR / E2E / CodeCheck / 三方件 / 漏洞 / 构建 / 白盒</div></div>
        <div className="metric-summary__cell"><div className="metric-summary__label">已定义指标</div><div className="metric-summary__value"><strong>{metricCount}</strong><span>个</span></div><div className="metric-summary__note">与看板图表一一对应</div></div>
        <div className="metric-summary__cell"><div className="metric-summary__label">计算方式</div><div className="metric-summary__value"><strong>{typeCount}</strong><span>种</span></div><div className="metric-summary__note">渗透率 / 效率提升 / 数量 / 比率 / 布尔</div></div>
      </section>

      <div className="metric-toolbar">
        <label className="metric-search">
          <SearchOutlined aria-hidden="true" />
          <Input variant="borderless" value={keyword} placeholder="搜索指标名称或活动" aria-label="搜索指标名称或活动" onChange={(event) => setKeyword(event.target.value)} />
        </label>
        <Select
          className="metric-select"
          value={kind}
          aria-label="活动类型"
          options={[{ value: 'all', label: '活动类型：全部' }, { value: 'key', label: '关键研发活动' }, { value: 'general', label: '通用研发能力' }]}
          onChange={setKind}
        />
        <Select
          className="metric-select"
          value={type}
          aria-label="指标类型"
          options={[{ value: 'all', label: '指标类型：全部' }, ...METRIC_TYPE_FILTERS.map((item) => ({ value: item.value, label: item.label }))]}
          onChange={setType}
        />
        <span className="metric-toolbar__note"><LockOutlined aria-hidden="true" />指标由代码/种子定义，本页不提供新增或编辑</span>
      </div>

      {error && <Alert className="metric-alert" type="error" showIcon message="指标字典加载失败" description={error.message} action={<Button size="small" onClick={() => window.location.reload()}>重试</Button>} />}

      <div className="metric-atlas">
        <aside className="metric-index" aria-label="活动目录">
          <div className="metric-index__head"><h2>活动目录</h2><span>共 {catalog.length} 个活动 · {metricCount} 个指标</span></div>
          {catalog.map((activity, index) => (
            <div key={activity.id}>
              {(index === 0 || catalog[index - 1].kind !== activity.kind) && (
                <div className="metric-index__group-label">{activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}</div>
              )}
              <button type="button" className="metric-index__item" onClick={() => jumpTo(activity.id)}>
                <span>{activity.name}</span>
                <span className="metric-index__count">{activity.metrics?.length ?? 0}</span>
              </button>
            </div>
          ))}
        </aside>

        <section className="metric-table-card" aria-labelledby="metric-table-title">
          <div className="metric-table-card__head">
            <div><h2 id="metric-table-title">指标口径</h2><span>按活动分组 · 点击任意指标查看完整解释</span></div>
            <span>当前显示 {filteredCatalog.reduce((count, activity) => count + activity.metrics.length, 0)} / {metricCount} 个指标</span>
          </div>
          {loading ? (
            <div className="metric-table-state"><Spin size="small" /><span>正在加载指标字典…</span></div>
          ) : filteredCatalog.length === 0 ? (
            <div className="metric-table-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下没有指标。" /></div>
          ) : (
            <div className="metric-table-scroll">
              <table className="metric-table">
                <colgroup>
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>指标</th>
                    <th>计算公式</th>
                    <th>分子（业务含义）</th>
                    <th>分母（业务含义）</th>
                    <th>数据来源</th>
                    <th>使用位置</th>
                    <th>口径说明</th>
                  </tr>
                </thead>
                {filteredCatalog.map((activity) => (
                  <tbody key={activity.id}>
                    <tr className="metric-group-row" id={`metric-group-${activity.id}`}>
                      <td colSpan={7}>
                        <div className="metric-group-row__inner">
                          <strong>{activity.name}</strong>
                          <Tag className="metric-kind-tag">{activity.kind === 'general' ? '通用研发能力' : '关键研发活动'}</Tag>
                          <span>{activity.metrics.length} 个指标</span>
                        </div>
                      </td>
                    </tr>
                    {activity.metrics.map((metric) => (
                      <tr
                        key={metric.id}
                        className="metric-row"
                        tabIndex={0}
                        aria-label={`查看指标 ${metric.name} 的口径详情`}
                        onClick={() => setSelected({ activity, metric })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelected({ activity, metric })
                          }
                        }}
                      >
                        <td>
                          <div className="metric-name">{metric.name}</div>
                          <div className="metric-name__type"><TypeTag metric={metric} /></div>
                        </td>
                        <td><Formula metric={metric} /></td>
                        <td><div className="metric-meaning">{metric.numerator_semantic}</div></td>
                        <td><div className="metric-meaning">{metric.denominator_semantic ?? '—'}</div></td>
                        <td><span className="metric-source">{metricSource(metric)}</span></td>
                        <td><UsageChips activity={activity} metric={metric} /></td>
                        <td><div className="metric-missing">{metricMissingNote(metric)}</div><div className="metric-detail-hint">点击查看公式与示例</div></td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
          <div className="metric-table-card__foot"><span>指标口径由代码与种子定义；新增或修改需走设计评审，不在此页直接配置。</span><strong>只读</strong></div>
        </section>
      </div>

      <MetricDetailDrawer value={selected} onClose={() => setSelected(null)} />
      <TypeGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
