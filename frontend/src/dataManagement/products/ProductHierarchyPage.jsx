import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from 'antd'
import { DeleteOutlined, DownOutlined, EditOutlined, PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'

import { fetchJson } from '../../api'
import PageHeader from '../../components/PageHeader'
import './product-hierarchy.css'

const { Text } = Typography

function relationshipError(error) {
  const message = error?.message ?? ''
  if (message.includes('product is referenced by versions or IR data')) return '该产品仍被 PI 或 IR 数据引用，无法删除。'
  if (message.includes('version is referenced by iterations or IR data')) return '该 PI 仍被迭代或 IR 数据引用，无法删除。'
  if (message.includes('iteration is referenced by IR data')) return '该迭代仍被 IR 数据引用，无法删除。'
  if (message.includes('resource already exists')) return '名称已被使用，请修改后重试。'
  if (message.includes('team not found')) return '所属团队不存在，请刷新后重试。'
  return message || '操作失败，请稍后重试。'
}

function ProductDialog({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  React.useEffect(() => {
    if (editor) form.setFieldsValue({ team_id: String(editor.team_id ?? ''), name: editor.name ?? '' })
  }, [editor, form])
  return (
    <Modal
      className="product-hierarchy-modal"
      open={Boolean(editor)}
      title={editor?.id ? '编辑产品' : '新增产品'}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit({ team_id: Number(values.team_id), name: String(values.name).trim() })}>
        <Form.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}>
          <Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} placeholder="选择团队" />
        </Form.Item>
        <Form.Item name="name" label="产品名称" rules={[{ required: true, whitespace: true, message: '请输入产品名称' }]}>
          <Input autoFocus maxLength={100} placeholder="例如：SCC" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function PiDialog({ editor, products, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  React.useEffect(() => {
    if (editor) form.setFieldsValue({ product_id: String(editor.product_id ?? ''), name: editor.name ?? '' })
  }, [editor, form])
  return (
    <Modal
      className="product-hierarchy-modal"
      open={Boolean(editor)}
      title={editor?.id ? '编辑 PI（产品版本）' : '新增 PI（产品版本）'}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit({ product_id: Number(values.product_id), name: String(values.name).trim() })}>
        <Form.Item name="product_id" label="所属产品" rules={[{ required: true, message: '请选择产品' }]}>
          <Select options={products.map((product) => ({ value: String(product.id), label: `${product.team_name} / ${product.name}` }))} placeholder="选择产品" />
        </Form.Item>
        <Form.Item name="name" label="PI（产品版本）" rules={[{ required: true, whitespace: true, message: '请输入 PI 名称' }]} extra="与 IR 需求中的 PI 列对应，例如 SCC 20.6.3.02。">
          <Input autoFocus maxLength={50} placeholder="例如：SCC 20.6.3.02" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function IterationDialog({ editor, versions, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  React.useEffect(() => {
    if (editor) form.setFieldsValue({
      version_id: String(editor.version_id ?? ''),
      name: editor.name ?? '',
      start_date: editor.start_date ?? '',
      end_date: editor.end_date ?? '',
    })
  }, [editor, form])
  return (
    <Modal
      className="product-hierarchy-modal"
      open={Boolean(editor)}
      title={editor?.id ? '编辑开发迭代期' : '新增开发迭代期'}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit({
        version_id: Number(values.version_id),
        name: String(values.name).trim(),
        start_date: values.start_date,
        end_date: values.end_date,
      })}>
        <Form.Item name="version_id" label="所属 PI（产品版本）" rules={[{ required: true, message: '请选择 PI' }]}>
          <Select options={versions.map((version) => ({ value: String(version.id), label: `${version.team_name} / ${version.product_name} / ${version.name}` }))} placeholder="选择 PI" />
        </Form.Item>
        <Form.Item name="name" label="迭代名称" rules={[{ required: true, whitespace: true, message: '请输入迭代名称' }]}>
          <Input autoFocus maxLength={60} placeholder="例如：2026-10 迭代" />
        </Form.Item>
        <div className="product-hierarchy-modal__dates">
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]}><Input type="date" /></Form.Item>
          <Form.Item name="end_date" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]}><Input type="date" /></Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

function countIterations(version) {
  return version.iterations?.length ?? 0
}

export default function ProductHierarchyPage({ user, refs, onRefresh, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [teamFilter, setTeamFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [productEditor, setProductEditor] = useState(null)
  const [piEditor, setPiEditor] = useState(null)
  const [iterationEditor, setIterationEditor] = useState(null)
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set())
  const previousFilterActiveRef = useRef(false)
  const savedCollapsedRef = useRef(new Set())
  const filterSignature = `${teamFilter}|${keyword.trim()}`

  const visibleTeams = useMemo(() => (
    user.role === 'maintainer'
      ? refs.teams.filter((team) => team.id === user.maintainer_team_id)
      : refs.teams
  ), [refs.teams, user.role, user.maintainer_team_id])

  const visibleTeamIds = useMemo(() => new Set(visibleTeams.map((team) => team.id)), [visibleTeams])
  const visibleProducts = useMemo(() => refs.products.filter((product) => visibleTeamIds.has(product.team_id)), [refs.products, visibleTeamIds])
  const visibleProductIds = useMemo(() => new Set(visibleProducts.map((product) => product.id)), [visibleProducts])
  const visibleVersions = useMemo(() => refs.versions.filter((version) => visibleProductIds.has(version.product_id)), [refs.versions, visibleProductIds])
  const versionsByProduct = useMemo(() => {
    const result = new Map()
    visibleVersions.forEach((version) => {
      const list = result.get(version.product_id) ?? []
      list.push(version)
      result.set(version.product_id, list)
    })
    return result
  }, [visibleVersions])

  const piCount = visibleVersions.length
  const iterationCount = visibleVersions.reduce((count, version) => count + countIterations(version), 0)
  const productCount = visibleProducts.length

  const teamKey = (id) => `team:${id}`
  const productKey = (id) => `product:${id}`
  const versionKey = (id) => `version:${id}`
  const isCollapsed = (key) => collapsedKeys.has(key)

  function toggleCollapsed(key) {
    setCollapsedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const filterActive = Boolean(keyword.trim()) || teamFilter !== 'all'
    const wasActive = previousFilterActiveRef.current
    if (filterActive && !wasActive) {
      savedCollapsedRef.current = new Set(collapsedKeys)
      setCollapsedKeys(new Set())
    } else if (!filterActive && wasActive) {
      setCollapsedKeys(new Set(savedCollapsedRef.current))
    } else if (filterActive) {
      setCollapsedKeys(new Set())
    }
    previousFilterActiveRef.current = filterActive
  }, [filterSignature])

  function notify(type, text) {
    setNotice({ type, text })
  }

  function teamMatch(team) {
    if (teamFilter !== 'all' && String(team.id) !== teamFilter) return false
    return true
  }

  function textMatch(value) {
    const query = keyword.trim().toLowerCase()
    return !query || String(value ?? '').toLowerCase().includes(query)
  }

  const hierarchy = useMemo(() => visibleTeams
    .filter(teamMatch)
    .map((team) => {
      const products = visibleProducts
        .filter((product) => product.team_id === team.id)
        .map((product) => {
          const versions = versionsByProduct.get(product.id) ?? []
          const productMatch = textMatch(product.name)
          const versionMatches = versions.map((version) => {
            const versionMatch = productMatch || textMatch(version.name)
            const matchingIterations = (version.iterations ?? []).filter((iteration) => versionMatch || textMatch(iteration.name))
            if (versionMatch) return { version, iterations: version.iterations ?? [] }
            if (matchingIterations.length) return { version, iterations: matchingIterations }
            return null
          }).filter(Boolean)
          if (!keyword.trim()) return { product, versions }
          if (productMatch) return { product, versions }
          if (versionMatches.length) return { product, versions: versionMatches }
          return null
        })
        .filter(Boolean)
      if (keyword.trim() && !products.length) return null
      return { team, products }
    })
    .filter(Boolean), [visibleTeams, visibleProducts, versionsByProduct, teamFilter, keyword])

  const filteredProductCount = hierarchy.reduce((count, entry) => count + entry.products.length, 0)
  const filteredPiCount = hierarchy.reduce((count, entry) => count + entry.products.reduce((sum, item) => sum + item.versions.length, 0), 0)
  const filteredIterationCount = hierarchy.reduce((count, entry) => count + entry.products.reduce((sum, item) => sum + item.versions.reduce((inner, version) => inner + version.iterations.length, 0), 0), 0)

  const collapsibleKeys = useMemo(() => {
    const keys = []
    visibleTeams.forEach((team) => {
      const products = visibleProducts.filter((product) => product.team_id === team.id)
      if (products.length) keys.push(teamKey(team.id))
      products.forEach((product) => {
        const versions = versionsByProduct.get(product.id) ?? []
        if (versions.length) keys.push(productKey(product.id))
        versions.forEach((version) => {
          if (countIterations(version)) keys.push(versionKey(version.id))
        })
      })
    })
    return keys
  }, [visibleTeams, visibleProducts, versionsByProduct])
  const allCollapsed = collapsibleKeys.length > 0 && collapsibleKeys.every((key) => collapsedKeys.has(key))
  const expandAll = () => setCollapsedKeys(new Set())
  const collapseAll = () => setCollapsedKeys(new Set(collapsibleKeys))

  async function saveEntity(url, method, body, message, close) {
    setSubmitting(true)
    try {
      await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      close()
      notify('success', message)
      await onRefresh()
    } catch (error) {
      notify('error', relationshipError(error))
      if (error.status === 401) onSessionExpired()
    } finally {
      setSubmitting(false)
    }
  }

  async function removeEntity(url, message) {
    try {
      await fetchJson(url, { method: 'DELETE' })
      notify('success', message)
      await onRefresh()
    } catch (error) {
      notify('error', relationshipError(error))
      if (error.status === 401) onSessionExpired()
    }
  }

  function openCreateProduct(teamId) {
    if (!visibleTeams.length) {
      notify('warning', '请先创建团队，再新增产品。')
      return
    }
    setProductEditor({ id: null, team_id: String(teamId ?? visibleTeams[0].id), name: '' })
  }

  function openCreatePi(product) {
    setPiEditor({ id: null, product_id: String(product.id), name: '' })
  }

  function openCreateIteration(version) {
    setIterationEditor({ id: null, version_id: String(version.id), name: '', start_date: '', end_date: '' })
  }

  return (
    <div className="product-hierarchy">
      <PageHeader
        eyebrow="Product Hierarchy"
        title="产品、PI 与迭代"
        description="产品只归属一个团队；PI 即产品版本，对应 IR 需求中的 PI 列；每个 PI 下可选维护开发迭代期。"
        actions={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateProduct()}>新增产品</Button> : <Tag>只读</Tag>}
      />

      {notice && <Alert className="product-hierarchy__notice" type={notice.type} showIcon closable message={notice.text} onClose={() => setNotice(null)} />}
      {refs.error && <Alert className="product-hierarchy__notice" type="error" showIcon message="产品层级数据加载失败" description={refs.error.message} />}

      <section className="product-summary" aria-label="产品层级概览">
        <div className="product-summary__cell"><div className="product-summary__label">团队</div><div className="product-summary__value"><strong>{visibleTeams.length}</strong><span>个</span></div><div className="product-summary__note">产品归属的团队</div></div>
        <div className="product-summary__cell"><div className="product-summary__label">产品</div><div className="product-summary__value"><strong>{productCount}</strong><span>个</span></div><div className="product-summary__note">每个产品只归属一个团队</div></div>
        <div className="product-summary__cell"><div className="product-summary__label">PI（产品版本）</div><div className="product-summary__value"><strong>{piCount}</strong><span>个</span></div><div className="product-summary__note">对应 IR 需求的 PI 列</div></div>
        <div className="product-summary__cell"><div className="product-summary__label">迭代</div><div className="product-summary__value"><strong>{iterationCount}</strong><span>个</span></div><div className="product-summary__note">PI 下可选挂迭代</div></div>
      </section>

      <div className="product-toolbar">
        <label className="product-search"><SearchOutlined aria-hidden="true" /><Input variant="borderless" value={keyword} placeholder="搜索产品、PI 或迭代" aria-label="搜索产品、PI 或迭代" onChange={(event) => setKeyword(event.target.value)} /></label>
        <Select
          className="product-team-filter"
          size="small"
          value={teamFilter}
          aria-label="团队筛选"
          options={[{ value: 'all', label: '团队：全部' }, ...visibleTeams.map((team) => ({ value: String(team.id), label: team.name }))]}
          onChange={setTeamFilter}
        />
        <Button size="small" onClick={allCollapsed ? expandAll : collapseAll}>{allCollapsed ? '全部展开' : '全部收起'}</Button>
        <span className="product-toolbar__note">当前：{filteredProductCount} 个产品 · {filteredPiCount} 个 PI · {filteredIterationCount} 个迭代</span>
      </div>

      <section className="product-table-card" aria-labelledby="product-table-title">
        <div className="product-table-card__head">
          <div><h2 id="product-table-title">产品层级</h2><span>团队 → 产品 → PI（产品版本）→ 迭代；点击行内操作维护</span></div>
          <span>{filteredProductCount} 个产品 · {filteredPiCount} 个 PI</span>
        </div>
        <div className="product-table-scroll">
          <Spin spinning={refs.loading}>
            <table className="product-hierarchy-table">
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr><th>层级 / 名称</th><th>所属团队</th><th>关联信息</th><th className="product-hierarchy-table__actions-head">操作</th></tr>
              </thead>
              <tbody>
                {hierarchy.map(({ team, products }) => (
                  <React.Fragment key={`team-${team.id}`}>
                    <tr className="product-team-row">
                      <td colSpan={4}>
                        <div className="product-team-row__inner">
                          {products.length > 0 ? <button type="button" className="product-tree-toggle" aria-label={`${isCollapsed(teamKey(team.id)) ? '展开' : '收起'}团队 ${team.name}`} aria-expanded={!isCollapsed(teamKey(team.id))} onClick={() => toggleCollapsed(teamKey(team.id))}>{isCollapsed(teamKey(team.id)) ? <RightOutlined /> : <DownOutlined />}</button> : <span className="product-tree-toggle-spacer" />}
                          <strong>{team.name}</strong>
                          <span>{products.length} 个产品 · {products.reduce((sum, item) => sum + item.versions.length, 0)} 个 PI</span>
                          {canEdit && <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => openCreateProduct(team.id)}>新增产品</Button>}
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed(teamKey(team.id)) && products.map(({ product, versions }) => (
                      <React.Fragment key={`product-${product.id}`}>
                        <tr className="product-row">
                          <td><div className="product-hierarchy-name" style={{ paddingLeft: 16 }}>{versions.length > 0 ? <button type="button" className="product-tree-toggle" aria-label={`${isCollapsed(productKey(product.id)) ? '展开' : '收起'}产品 ${product.name}`} aria-expanded={!isCollapsed(productKey(product.id))} onClick={() => toggleCollapsed(productKey(product.id))}>{isCollapsed(productKey(product.id)) ? <RightOutlined /> : <DownOutlined />}</button> : <span className="product-tree-toggle-spacer" />}<Tag className="product-level-tag product-level-tag--product">产品</Tag><span className="product-hierarchy-name__main">{product.name}</span></div></td>
                          <td><span className="product-team-cell"><i />{team.name}</span></td>
                          <td><span className="product-related">{versions.length ? `${versions.length} 个 PI` : '0 个 PI（可添加）'}</span></td>
                          <td>{canEdit && <div className="product-row-actions"><Button size="small" type="link" icon={<PlusOutlined />} onClick={() => openCreatePi(product)}>新增 PI</Button><Button size="small" type="link" icon={<EditOutlined />} onClick={() => setProductEditor({ id: product.id, team_id: String(product.team_id), name: product.name })}>编辑</Button><Popconfirm okText="删除" cancelText="取消" title={`确定删除产品“${product.name}”？`} description="被 PI 或 IR 数据引用时无法删除；删除成功后无法恢复。" onConfirm={() => removeEntity(`/api/products/${product.id}`, '产品已删除。')}><Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></div>}</td>
                        </tr>
                        {!isCollapsed(productKey(product.id)) && versions.map((version) => (
                          <React.Fragment key={`version-${version.id}`}>
                            <tr className="product-pi-row">
                              <td><div className="product-hierarchy-name" style={{ paddingLeft: 46 }}>{countIterations(version) > 0 ? <button type="button" className="product-tree-toggle" aria-label={`${isCollapsed(versionKey(version.id)) ? '展开' : '收起'} PI ${version.name}`} aria-expanded={!isCollapsed(versionKey(version.id))} onClick={() => toggleCollapsed(versionKey(version.id))}>{isCollapsed(versionKey(version.id)) ? <RightOutlined /> : <DownOutlined />}</button> : <span className="product-tree-toggle-spacer" />}<Tag className="product-level-tag product-level-tag--pi">PI</Tag><span className="product-hierarchy-name__main">{version.name}</span></div></td>
                              <td><span className="product-team-cell"><i />{team.name}</span></td>
                              <td><span className="product-related">{countIterations(version) ? `${countIterations(version)} 个迭代` : '0 个迭代（可选）'}</span></td>
                              <td>{canEdit && <div className="product-row-actions"><Button size="small" type="link" icon={<PlusOutlined />} onClick={() => openCreateIteration(version)}>新增迭代</Button><Button size="small" type="link" icon={<EditOutlined />} onClick={() => setPiEditor({ id: version.id, product_id: String(version.product_id), name: version.name })}>编辑</Button><Popconfirm okText="删除" cancelText="取消" title={`确定删除 PI“${version.name}”？`} description="被迭代或 IR 数据引用时无法删除；删除成功后无法恢复。" onConfirm={() => removeEntity(`/api/versions/${version.id}`, 'PI 已删除。')}><Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></div>}</td>
                            </tr>
                            {!isCollapsed(versionKey(version.id)) && (version.iterations ?? []).map((iteration) => (
                              <tr key={`iteration-${iteration.id}`} className="product-iteration-row">
                                <td><div className="product-hierarchy-name" style={{ paddingLeft: 76 }}><span className="product-tree-toggle-spacer" /><Tag className="product-level-tag product-level-tag--iteration">迭代</Tag><span className="product-hierarchy-name__main">{iteration.name}</span></div></td>
                                <td><span className="product-team-cell"><i />{team.name}</span></td>
                                <td><span className="product-related product-related--date">{iteration.start_date} ~ {iteration.end_date}</span></td>
                                <td>{canEdit && <div className="product-row-actions"><Button size="small" type="link" icon={<EditOutlined />} onClick={() => setIterationEditor({ id: iteration.id, version_id: String(version.id), name: iteration.name, start_date: iteration.start_date, end_date: iteration.end_date })}>编辑</Button><Popconfirm okText="删除" cancelText="取消" title={`确定删除迭代“${iteration.name}”？`} description="被 IR 数据引用时无法删除；删除成功后无法恢复。" onConfirm={() => removeEntity(`/api/iterations/${iteration.id}`, '迭代已删除。')}><Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></div>}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                    {!isCollapsed(teamKey(team.id)) && !products.length && <tr className="product-empty-row"><td colSpan={4}><span>该团队暂无产品。</span>{canEdit && <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => openCreateProduct(team.id)}>新增产品</Button>}</td></tr>}
                  </React.Fragment>
                ))}
                {!hierarchy.length && <tr><td colSpan={4}><div className="product-hierarchy-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下没有产品层级。" /></div></td></tr>}
              </tbody>
            </table>
          </Spin>
        </div>
        <div className="product-table-card__foot"><span>PI 对应 IR 需求的 PI 列；迭代可选，不挂迭代的 PI 仍然有效。</span><strong>{filteredProductCount} 个产品 · {filteredPiCount} 个 PI · {filteredIterationCount} 个迭代</strong></div>
      </section>

      <ProductDialog editor={productEditor} teams={visibleTeams} onClose={() => setProductEditor(null)} onSubmit={(values) => saveEntity(productEditor.id ? `/api/products/${productEditor.id}` : '/api/products', productEditor.id ? 'PATCH' : 'POST', values, productEditor.id ? '产品已更新。' : '产品已创建。', () => setProductEditor(null))} submitting={submitting} />
      <PiDialog editor={piEditor} products={visibleProducts} onClose={() => setPiEditor(null)} onSubmit={(values) => saveEntity(piEditor.id ? `/api/versions/${piEditor.id}` : '/api/versions', piEditor.id ? 'PATCH' : 'POST', values, piEditor.id ? 'PI 已更新。' : 'PI 已创建。', () => setPiEditor(null))} submitting={submitting} />
      <IterationDialog editor={iterationEditor} versions={visibleVersions} onClose={() => setIterationEditor(null)} onSubmit={(values) => saveEntity(iterationEditor.id ? `/api/iterations/${iterationEditor.id}` : '/api/iterations', iterationEditor.id ? 'PATCH' : 'POST', values, iterationEditor.id ? '开发迭代期已更新。' : '开发迭代期已创建。', () => setIterationEditor(null))} submitting={submitting} />
    </div>
  )
}
