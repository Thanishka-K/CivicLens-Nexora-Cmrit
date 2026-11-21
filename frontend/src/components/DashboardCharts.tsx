import { useState } from 'react'
import { Cell, Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardStats, TrendPoint } from '../api/client'
import { categoryData, trendData } from '../data/demo'
import { Panel, SelectButton } from './ui'

export function ComplaintTrendChart({ stats }: { stats: DashboardStats | null }) {
  const [range, setRange] = useState('This week')
  const chartData: TrendPoint[] = range === 'This week' ? (stats?.trend_7_days ?? trendData) : (stats?.trend_30_days ?? trendData.map((point, index) => ({ ...point, day: ['1–6', '7–12', '13–18', '19–24', '25–30', '—', '—'][index], received: point.received * 4, resolved: point.resolved * 4 })).slice(0, 5))
  return <Panel title="Complaint volume" subtitle={`${stats ? 'From local complaint records' : 'Demonstration sample'} · last ${range === 'This week' ? '7' : '30'} days`} action={<SelectButton label="Select trend period" value={range} options={['This week', 'Last 30 days']} onChange={setRange} />}>
    <div className="chart-legend"><span><i className="legend-dot received" />Received</span><span><i className="legend-dot resolved" />Resolved</span></div>
    <div className="trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#47d3c3" stopOpacity={0.2} /><stop offset="100%" stopColor="#47d3c3" stopOpacity={0} /></linearGradient><linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#73aaf2" stopOpacity={0.12} /><stop offset="100%" stopColor="#73aaf2" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} /><Area type="monotone" dataKey="received" name="Received" stroke="#49d5c5" strokeWidth={2} fill="url(#receivedFill)" /><Area type="monotone" dataKey="resolved" name="Resolved" stroke="#75a9f2" strokeWidth={2} fill="url(#resolvedFill)" /></AreaChart></ResponsiveContainer></div>
  </Panel>
}

export function CategoryChart({ stats }: { stats: DashboardStats | null }) {
  const colors = ['#49d5c5', '#67a8f7', '#a08bf5', '#f1b957', '#617078', '#e78392', '#7cc98d']
  const data = stats ? [
    ...stats.complaints_by_category.slice(0, 5).map((entry, index) => ({ name: entry.category, value: entry.percent, count: entry.count, color: colors[index % colors.length] })),
    ...(stats.complaints_by_category.length > 5 ? [{ name: 'Other', count: stats.complaints_by_category.slice(5).reduce((sum, entry) => sum + entry.count, 0), value: stats.complaints_by_category.slice(5).reduce((sum, entry) => sum + entry.percent, 0), color: colors[5] }] : []),
  ] : categoryData.map((entry) => ({ ...entry, count: Math.round(entry.value * 12.84) }))
  const total = stats?.total_complaints ?? 1284
  return <Panel title="By category" subtitle={stats ? 'Share of local complaint records' : 'Demonstration sample distribution'}><div className="category-chart-wrap"><div className="category-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={67} paddingAngle={3} stroke="none">{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-total"><strong>{total.toLocaleString()}</strong><small>reports</small></div></div><div className="category-legend">{data.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><b>{Math.round(item.value)}%</b></div>)}</div></div></Panel>
}
