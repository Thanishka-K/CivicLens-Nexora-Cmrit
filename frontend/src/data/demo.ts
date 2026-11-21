export const trendData = [
  { day: 'Mon', received: 42, resolved: 31 }, { day: 'Tue', received: 56, resolved: 38 },
  { day: 'Wed', received: 48, resolved: 44 }, { day: 'Thu', received: 68, resolved: 47 },
  { day: 'Fri', received: 61, resolved: 52 }, { day: 'Sat', received: 39, resolved: 34 },
  { day: 'Sun', received: 54, resolved: 41 },
]

export const categoryData = [
  { name: 'Roads', value: 32, color: '#49d5c5' },
  { name: 'Waste', value: 24, color: '#67a8f7' },
  { name: 'Water', value: 18, color: '#a08bf5' },
  { name: 'Lighting', value: 14, color: '#f1b957' },
  { name: 'Other', value: 12, color: '#617078' },
]

export const departments = [
  { name: 'Roads & transport', open: 38, total: 58, color: '#49d5c5' },
  { name: 'Waste management', open: 27, total: 45, color: '#67a8f7' },
  { name: 'Water & drainage', open: 21, total: 39, color: '#a08bf5' },
  { name: 'Public lighting', open: 16, total: 31, color: '#f1b957' },
]

export type Incident = { id: string; title: string; area: string; category: string; priority: 'Critical' | 'High' | 'Medium'; age: string; department: string }
export const incidents: Incident[] = [
  { id: 'CL-2841', title: 'Waterlogging near underpass', area: 'Central Ward · Sector 4', category: 'Drainage', priority: 'Critical', age: '12 min ago', department: 'Water & drainage' },
  { id: 'CL-2838', title: 'Large pothole on arterial road', area: 'North Ward · Ring Road', category: 'Roads', priority: 'High', age: '28 min ago', department: 'Roads & transport' },
  { id: 'CL-2835', title: 'Streetlight outage cluster', area: 'East Ward · Lake View', category: 'Lighting', priority: 'High', age: '46 min ago', department: 'Public lighting' },
  { id: 'CL-2831', title: 'Missed waste collection', area: 'South Ward · Market Lane', category: 'Waste', priority: 'Medium', age: '1 hr ago', department: 'Waste management' },
]

export const activity = [
  { title: 'Incident escalated', detail: 'Waterlogging · Central Ward', time: '12 min ago', color: 'amber' },
  { title: 'Work order assigned', detail: 'Roads & transport · CL-2838', time: '28 min ago', color: 'blue' },
  { title: 'Issue resolved', detail: 'Streetlight repair · West Ward', time: '42 min ago', color: 'teal' },
]
