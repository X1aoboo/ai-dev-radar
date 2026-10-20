import React, { useMemo, useState } from 'react'
import { Alert, Button, Segmented, Space, Spin, Steps, Table, Tag, Typography, Upload } from 'antd'
import { DownloadOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons'

import { downloadFile, fetchJson } from '../../api'
import FocusRestoringDrawer from '../../components/FocusRestoringDrawer'
import { IR_FIELD_LABELS } from './irFields'

const { Text } = Typography
const { Dragger } = Upload

const OPERATION_LABELS = {
  insert: '新增',
  update: '更新',
  fill: '补充空值',
  unchanged: '无变化',
}

const OPERATION_TONES = {
  insert: 'success',
  update: 'info',
  fill: 'warning',
  unchanged: 'neutral',
}

function operationTag(operation) {
  return <Tag className={`ir-tag ir-tag--${OPERATION_TONES[operation] ?? 'neutral'}`}>{OPERATION_LABELS[operation] ?? operation}</Tag>
}

function diffText(diff = {}) {
  return Object.entries(diff)
    .filter(([, value]) => value.action !== 'unchanged')
    .slice(0, 4)
    .map(([field, value]) => {
      const label = IR_FIELD_LABELS[field] ?? field
      if (value.action === 'add') return `${label} → ${value.to ?? '空'}`
      if (value.action === 'fill') return `${label} 补为 ${value.to ?? '空'}`
      if (value.action === 'overwrite') return `${label} ${value.from ?? '空'} → ${value.to ?? '空'}`
      return `${label} 保留正式值`
    })
}

export default function IRImportWizard({ open, onClose, onConfirmed, onSessionExpired }) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('upsert')
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const rows = batch?.rows ?? []
  const counts = useMemo(() => {
    const result = { insert: 0, update: 0, fill: 0, unchanged: 0, invalid: 0, warnings: 0 }
    rows.forEach((row) => {
      if (row.status === 'invalid') result.invalid += 1
      else if (row.operation in result) result[row.operation] += 1
      result.warnings += row.warnings?.length ?? 0
    })
    return result
  }, [rows])

  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    if (statusFilter === 'invalid') return rows.filter((row) => row.status === 'invalid')
    if (statusFilter === 'warning') return rows.filter((row) => row.warnings?.length)
    return rows.filter((row) => row.operation === statusFilter)
  }, [rows, statusFilter])

  function reset() {
    setStep(0)
    setFile(null)
    setBatch(null)
    setError(null)
    setMode('upsert')
    setStatusFilter('all')
  }

  function close() {
    reset()
    onClose()
  }

  async function preview(nextFile, nextMode) {
    if (!nextFile) return
    setLoading(true)
    setError(null)
    setBatch(null)
    try {
      const nextBatch = await fetchJson(`/api/data/ir/imports/preview?mode=${nextMode}`, {
        method: 'POST',
        headers: {
          'Content-Type': nextFile.type || 'application/octet-stream',
          'X-Filename': nextFile.name,
        },
        body: await nextFile.arrayBuffer(),
      })
      setBatch(nextBatch)
      setStep(1)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '文件解析失败，请检查模板格式。')
    } finally {
      setLoading(false)
    }
  }

  async function changeMode(nextMode) {
    setMode(nextMode)
    if (file) await preview(file, nextMode)
  }

  async function confirm() {
    if (!batch) return
    setConfirming(true)
    setError(null)
    try {
      const result = await fetchJson(`/api/data/ir/imports/${batch.id}/confirm`, { method: 'POST' })
      onConfirmed(result)
      close()
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '确认失败，请检查批次状态。')
    } finally {
      setConfirming(false)
    }
  }

  const columns = [
    { title: '行', dataIndex: 'row_number', width: 56 },
    { title: '需求编号', dataIndex: 'source_id', width: 180, render: (value) => <Text code>{value ?? '—'}</Text> },
    { title: '动作', dataIndex: 'operation', width: 100, render: (value) => operationTag(value) },
    {
      title: '变更',
      dataIndex: 'diff',
      render: (diff, row) => (
        <Space orientation="vertical" size={2}>
          {diffText(diff).map((text) => <Text key={text} type="secondary">{text}</Text>)}
          {!diffText(diff).length && <Text type="secondary">—</Text>}
          {row.status === 'invalid' && <Text type="secondary">该行不会写入</Text>}
        </Space>
      ),
    },
    {
      title: '校验',
      key: 'validation',
      width: 320,
      render: (_, row) => (
        <Space orientation="vertical" size={2}>
          {row.errors?.map((item) => <Text key={item} type="danger">{item}</Text>)}
          {row.warnings?.map((item) => <Text key={item} type="warning">{item}</Text>)}
          {!row.errors?.length && !row.warnings?.length && <Tag className="ir-tag ir-tag--success">通过</Tag>}
        </Space>
      ),
    },
  ]

  const footer = step === 0
    ? <Space><Button onClick={close}>取消</Button><Button icon={<DownloadOutlined />} onClick={() => downloadFile('/api/data/ir/import-template', 'IR需求导入模板.xlsx').catch((nextError) => setError(nextError.message))}>下载模板</Button></Space>
    : (
      <Space>
        <Button onClick={() => { setStep(0); setBatch(null); setError(null) }}>重新选择</Button>
        <Button onClick={close}>关闭</Button>
        <Button
          type="primary"
          loading={confirming}
          disabled={!batch || batch.invalid_rows > 0 || batch.status !== 'pending'}
          onClick={confirm}
        >
          {batch?.invalid_rows ? '存在错误，不能确认' : '确认写入正式数据'}
        </Button>
      </Space>
    )

  return (
    <FocusRestoringDrawer
      rootClassName="ir-import-drawer"
      title="导入 IR Excel"
      open={open}
      size={1100}
      onClose={close}
      destroyOnClose
      footer={footer}
    >
      <Steps current={step} size="small" items={[{ title: '上传文件' }, { title: '预览与校验' }, { title: '整批确认' }]} />
      {error && <Alert className="ir-import__error" type="error" showIcon message={error} />}

      {step === 0 && (
        <div className="ir-import-upload">
          <Dragger
            accept=".xlsx,.csv"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(nextFile) => {
              setFile(nextFile)
              preview(nextFile, mode)
              return false
            }}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">拖拽或点击选择 IR Excel 文件</p>
            <p className="ant-upload-hint">支持 .xlsx 与 .csv；第一行必须是模板列名。上传后先预览，整批确认后才写入正式数据。</p>
          </Dragger>
          <div className="ir-import-hint">
            <Text strong>模板规则</Text>
            <Text type="secondary">21 列模板；SA 可选、SE 必填；归属组、PI、迭代必须已存在；设计时间必填。</Text>
          </div>
          {loading && <Text type="secondary">正在解析文件并生成预览…</Text>}
        </div>
      )}

      {step === 1 && batch && (
        <div className="ir-import-preview">
          <div className="ir-import-summary">
            <Tag className="ir-tag ir-tag--neutral">总行数 {batch.total_rows}</Tag>
            <Tag className="ir-tag ir-tag--success">新增 {counts.insert}</Tag>
            <Tag className="ir-tag ir-tag--info">更新 {counts.update + counts.fill}</Tag>
            <Tag className="ir-tag ir-tag--neutral">无变化 {counts.unchanged}</Tag>
            <Tag className={`ir-tag ir-tag--${batch.invalid_rows ? 'danger' : 'neutral'}`}>错误 {batch.invalid_rows}</Tag>
            {counts.warnings > 0 && <Tag className="ir-tag ir-tag--warning">警告 {counts.warnings}</Tag>}
          </div>

          <div className="ir-import-toolbar">
            <Segmented
              value={mode}
              options={[
                { value: 'upsert', label: '更新（覆盖非空）' },
                { value: 'fill_empty', label: '仅补充空值' },
              ]}
              onChange={changeMode}
              disabled={loading}
            />
            <Segmented
              value={statusFilter}
              options={[
                { value: 'all', label: '全部' },
                { value: 'invalid', label: '错误' },
                { value: 'warning', label: '警告' },
                { value: 'insert', label: '新增' },
                { value: 'update', label: '更新' },
              ]}
              onChange={setStatusFilter}
            />
            <Button size="small" icon={<ReloadOutlined />} onClick={() => preview(file, mode)} disabled={!file || loading}>重新校验</Button>
            <Text type="secondary">{batch.filename ?? file?.name}</Text>
          </div>

          <Alert
            type={batch.invalid_rows ? 'error' : 'info'}
            showIcon
            message={batch.invalid_rows ? '存在错误行，整批不能确认。' : '预览通过；确认后按当前更新模式整批写入，并写入审计日志。'}
          />
          <Table
            className="ir-import-table"
            rowKey="row_number"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={visibleRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{ emptyText: '当前筛选条件下没有行。' }}
          />
        </div>
      )}

      {loading && step === 0 && <div className="ir-import-loading" role="status"><Spin /></div>}
    </FocusRestoringDrawer>
  )
}
