import React, { useState, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { 
  TrendingUp, Filter, Printer, Table as TableIcon, 
  BarChart3, PieChart as PieIcon, Activity, Trophy, Calendar,
  ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import RecognitionBoard from './RecognitionBoard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function WorkspaceTab({ monthlyData }: { monthlyData: any[] }) {
  const [activeTab, setActiveTab] = useState('table');
  const [analysisPeriod, setAnalysisPeriod] = useState('Monthly');
  const [selectedYear, setSelectedYear] = useState('2016');
  const [selectedMonth, setSelectedMonth] = useState('Hamle');
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  const ethiopianMonths = ['Hamle', 'Nehasse', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tirr', 'Yekatit', 'Megabit', 'Miazia', 'Ginbot', 'Sene'];
  const quarters = ['Q1 (Hamle-Meskerem)', 'Q2 (Tikimt-Tahsas)', 'Q3 (Tirr-Megabit)', 'Q4 (Miazia-Sene)'];
  const years = ['2016', '2017', '2018'];

  // ዳታውን በወር እና በዓመት ማጣሪያ
  const filteredData = useMemo(() => {
    let data = monthlyData;
    if (analysisPeriod === 'Monthly') {
      data = data.filter(d => d.month === selectedMonth);
    }
    if (departmentFilter !== 'All') {
      data = data.filter(d => d.department === departmentFilter);
    }
    return data;
  }, [monthlyData, selectedMonth, selectedQuarter, analysisPeriod, departmentFilter]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const onTrack = filteredData.filter(d => (d.actual / d.target) >= 0.9).length;
    const offTrack = filteredData.filter(d => (d.actual / d.target) < 0.7).length;
    const atRisk = total - onTrack - offTrack;
    const avgAchv = total > 0 ? (filteredData.reduce((acc, curr) => acc + (curr.actual / curr.target), 0) / total) * 100 : 0;
    
    return { total, onTrack, atRisk, offTrack, avgAchv };
  }, [filteredData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters Header */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
          <Calendar className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</span>
        </div>

        <Select value={analysisPeriod} onValueChange={setAnalysisPeriod}>
          <SelectTrigger className="h-9 w-[130px] font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Monthly">Monthly</SelectItem>
            <SelectItem value="Quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="h-9 w-[110px] font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y} EFY</SelectItem>)}</SelectContent>
        </Select>

        {analysisPeriod === 'Monthly' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-[140px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>{ethiopianMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {analysisPeriod === 'Quarterly' && (
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="h-9 w-[190px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>{quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Indicators', value: stats.total, color: 'blue' },
          { label: 'On Track', value: stats.onTrack, color: 'green' },
          { label: 'At Risk', value: stats.atRisk, color: 'amber' },
          { label: 'Off Track', value: stats.offTrack, color: 'red' },
          { label: 'Avg Achv %', value: `${stats.avgAchv.toFixed(1)}%`, color: 'indigo' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-black text-${s.color}-600`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Modern Tabs Navigation */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'table', icon: TableIcon, label: 'Table' },
          { id: 'chart', icon: BarChart3, label: 'Bar Chart' },
          { id: 'recognition', icon: Trophy, label: 'Recognition' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[400px]">
        {activeTab === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Indicator</th>
                  <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Target</th>
                  <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Actual</th>
                  <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Achv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-sm font-semibold text-slate-700">{row.indicator}</td>
                    <td className="py-4 text-sm text-slate-500">{row.target}</td>
                    <td className="py-4 text-sm font-bold text-slate-900">{row.actual}</td>
                    <td className="py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full font-bold ${
                        (row.actual/row.target) >= 0.9 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {((row.actual/row.target) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="h-[400px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="indicator" hide />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'recognition' && (
          <RecognitionBoard monthlyData={filteredData} selectedPeriod={`${selectedMonth} ${selectedYear}`} />
        )}
      </div>
    </div>
  );
}
