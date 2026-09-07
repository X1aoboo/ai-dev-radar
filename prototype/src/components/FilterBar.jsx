// 顶部筛选行：一行、置于内容上方，作用域覆盖下方全部图表（dataviz interaction 规范）
import { VERSIONS } from '../data/mock'
import { periodsFor } from '../data/compute'

function Seg({ label, options, value, onChange }) {
  return (
    <div className="ctl">
      <span className="lbl">{label}</span>
      <span className="seg">
        {options.map((o) => (
          <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.t}</button>
        ))}
      </span>
    </div>
  )
}

export default function FilterBar({ filter, setFilter, showMetricSlot }) {
  const periods = periodsFor(filter)

  // 维度/粒度/版本切换后重置周期为最新，避免残留无效 periodId
  const setDim = (dim) => {
    const f = { ...filter, dim }
    if (dim === 'iter') f.gran = 'month'
    setFilter({ ...f, periodId: periodsFor(f)[periodsFor(f).length - 1].id })
  }
  const setGran = (gran) => {
    const f = { ...filter, gran }
    setFilter({ ...f, periodId: periodsFor(f)[periodsFor(f).length - 1].id })
  }
  const setVersion = (versionId) => {
    const f = { ...filter, versionId }
    setFilter({ ...f, periodId: periodsFor(f)[periodsFor(f).length - 1].id })
  }

  return (
    <div className="filterbar">
      <Seg label="统计维度" options={[{ v: 'time', t: '按时间' }, { v: 'iter', t: '按版本/迭代' }]} value={filter.dim} onChange={setDim} />
      {filter.dim === 'time' && (
        <Seg label="时间粒度" options={[{ v: 'month', t: '月' }, { v: 'week', t: '周' }]} value={filter.gran} onChange={setGran} />
      )}
      {filter.dim === 'iter' && (
        <div className="ctl">
          <span className="lbl">版本</span>
          <select className="psel" value={filter.versionId} onChange={(e) => setVersion(e.target.value)}>
            <option value="all">全部版本</option>
            {VERSIONS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}
      <div className="ctl">
        <span className="lbl">周期</span>
        <select className="psel" value={filter.periodId} onChange={(e) => setFilter({ ...filter, periodId: e.target.value })}>
          <option value="all">全部周期</option>
          {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      {showMetricSlot && (
        <Seg label="展示指标" options={[{ v: 0, t: '第一指标' }, { v: 1, t: '第二指标' }]} value={filter.metricSlot} onChange={(v) => setFilter({ ...filter, metricSlot: v })} />
      )}
    </div>
  )
}
