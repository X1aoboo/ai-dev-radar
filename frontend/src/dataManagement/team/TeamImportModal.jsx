import React, { useEffect, useState } from 'react'
import { Alert, Button, Modal, Space, Spin, Table, Tag, Typography, Upload } from 'antd'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'

import { downloadFile, fetchJson } from '../../api'

const { Text } = Typography
const { Dragger } = Upload

const ACTION_META = {
  create: { label: '新增', color: 'success' },
  update: { label: '更新', color: 'processing' },
  unchanged: { label: '无变化', color: 'default' },
  invalid: { label: '错误', color: 'error' },
}

const CHANGE_LABELS = {
  team_name: '所属团队',
  name: '姓名',
  role: '角色',
}

function changeText(changes = {}) {
  return Object.entries(changes)
    .filter(([key]) => CHANGE_LABELS[key])
    .map(([key, value]) => `${CHANGE_LABELS[key]} → ${value}`)
    .join('；')
}

export default function TeamImportModal({ open, onClose, onImported, onSessionExpired }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!open) return
    setPreview(null)
    setLoading(false)
    setConfirming(false)
    setError(null)
    setResult(null)
  }, [open])

  async function previewFile(file) {
    setLoading(true)
    setError(null)
    setPreview(null)
    setResult(null)
    try {
      const body = await fetchJson('/api/teams/imports/preview', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': file.name,
        },
        body: await file.arrayBuffer(),
      })
      setPreview(body)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '文件解析失败。')
    } finally {
      setLoading(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    setConfirming(true)
    setError(null)
    try {
      const rows = preview.rows.map((row) => ({
        team_name: row.team_name,
        employee_id: row.employee_id,
        name: row.name,
        role: row.role,
      }))
      const nextResult = await fetchJson('/api/teams/imports/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      setResult(nextResult)
      await onImported(nextResult)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '导入失败。')
    } finally {
      setConfirming(false)
    }
  }

  const columns = [
    { title: '行', dataIndex: 'row_number', width: 52 },
    { title: '团队', dataIndex: 'team_name', width: 130 },
    { title: '工号', dataIndex: 'employee_id', width: 110 },
    { title: '姓名', dataIndex: 'name', width: 130 },
    { title: '角色', dataIndex: 'role', width: 84 },
    {
      title: '处理',
      key: 'action',
      width: 90,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag color={ACTION_META[row.action].color}>{ACTION_META[row.action].label}</Tag>
          {row.team_action === 'create' && <Tag>新建团队</Tag>}
        </Space>
      ),
    },
    {
      title: '差异 / 错误',
      key: 'detail',
      render: (_, row) => (
        <div className="team-import-detail">
          {changeText(row.changes) && <div className="team-import-detail__change">{changeText(row.changes)}</div>}
          {row.errors.map((item) => <div key={item} className="team-import-detail__error">{item}</div>)}
          {row.warnings.map((item) => <div key={item} className="team-import-detail__warning">{item}</div>)}
        </div>
      ),
    },
  ]

  const hasErrors = Boolean(preview && preview.invalid_rows > 0)
  const summary = preview?.summary

  return (
    <Modal
      className="team-personnel-modal team-import-modal"
      open={open}
      width={920}
      title="导入团队人员"
      onCancel={onClose}
      destroyOnClose
      footer={result ? (
        <Button type="primary" onClick={onClose}>完成</Button>
      ) : preview ? (
        <Space>
          <Button onClick={() => { setPreview(null); setError(null) }}>重新上传</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={confirming} disabled={hasErrors} onClick={confirmImport}>
            确认导入{summary ? `（${summary.create + summary.update} 条写入）` : ''}
          </Button>
        </Space>
      ) : (
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button icon={<DownloadOutlined />} onClick={() => downloadFile('/api/teams/import-template', '团队人员导入模板.xlsx')}>下载模板</Button>
        </Space>
      )}
    >
      {error && <Alert className="team-import-alert" type="error" showIcon message={error} />}
      {result ? (
        <div className="team-import-result">
          <Alert
            type="success"
            showIcon
            message="导入完成"
            description={`新建 ${result.created_teams} 个团队、${result.created_members} 名成员；更新 ${result.updated_members} 名成员；${result.unchanged_members} 名无变化。`}
          />
        </div>
      ) : preview ? (
        <div className="team-import-preview">
          <div className="team-import-summary">
            <span>共 <strong>{preview.total_rows}</strong> 行</span>
            <span className="is-create">新增 {summary?.create ?? 0}</span>
            <span className="is-update">更新 {summary?.update ?? 0}</span>
            <span>无变化 {summary?.unchanged ?? 0}</span>
            <span className={hasErrors ? 'is-error' : ''}>错误 {preview.invalid_rows}</span>
            <span>新建团队 {summary?.teams_create ?? 0}</span>
          </div>
          {hasErrors && <Alert type="error" showIcon message="存在错误行，整批不能导入。请修正文件后重新上传。" />}
          <Table
            className="operational-table team-import-table"
            rowKey="row_number"
            size="small"
            columns={columns}
            dataSource={preview.rows}
            pagination={false}
            scroll={{ x: 780, y: 320 }}
            rowClassName={(row) => row.action === 'invalid' ? 'is-invalid' : ''}
          />
          <Text type="secondary" className="team-import-hint">
            工号已存在时更新姓名/角色/所属团队；团队不存在时自动创建。任一行有错误则整批不写入。
          </Text>
        </div>
      ) : (
        <div className="team-import-upload">
          <Dragger
            accept=".xlsx,.csv"
            maxCount={1}
            showUploadList={false}
            disabled={loading}
            beforeUpload={(file) => { previewFile(file); return false }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">拖拽或点击选择团队人员 Excel 文件</p>
            <p className="ant-upload-hint">支持 .xlsx 与 .csv；首行必须是“团队名称、工号、姓名、角色”。上传后先预览，确认后才写入。</p>
          </Dragger>
          {loading && <div className="team-import-loading"><Spin size="small" /><span>正在解析并校验文件…</span></div>}
          <div className="team-import-template-note">
            <Text type="secondary">首次使用请先下载模板；角色只允许 SA / SE / MDE / 开发 / 测试。</Text>
          </div>
        </div>
      )}
    </Modal>
  )
}
