import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Table as TableIcon, BarChart3, Trophy, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import RecognitionBoard from './RecognitionBoard';

export default function WorkspaceTab({ monthlyData }: { monthlyData: any[] }) {
  const [activeTab, setActiveTab] = useState('table');
  const [selectedYear, setSelectedYear] = useState('2018');
  const [selectedMonth, setSelectedMonth] = useState('Hamle');

  const ethiopianMonths = ['Hamle', 'Nehasse', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tirr', 'Yekatit', 'Megabit', 'Miazia', 'Ginbot', 'Sene'];

  // ከ Master Plan የመጣውን ትክክለኛ ዳታ መለየት
  const filteredData = useMemo(() => {
    const monthData = monthlyData.filter(d => d.month === selectedMonth);
    // ዳታው በወር ተለይቶ ካልተገኘ ሁሉንም የገባ ዳታ ያሳያል
    return monthData.length > 0 ? monthData : monthlyData;
  }, [monthlyData, selectedMonth]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const onTrack = filteredData.filter(d => (d.actual / d.target) >= 0.9).length;
    const avgAchv = total > 0 ? (filteredData.reduce((acc, curr) => acc + (curr.actual / curr.target), 0) / total) * 100 : 0;
    return { total, onTrack, avgAchv };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 bg-white p-4 rounded-xl border">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2016">2016 EFY</SelectItem>
            <SelectItem value="2017">2017 EFY</SelectItem>
            <SelectItem value="2018">2018 EFY</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ethiopianMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Indicators</p>
          <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <p className="text-sm font-medium text-slate-500">On Track</p>
          <p className="text-3xl font-bold text-green-600">{stats.onTrack}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avg Achievement</p>
          <p className="text-3xl font-bold text-indigo-600">{stats.avgAchv.toFixed(1)}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('table')} className={`px-4 py-2 rounded-md ${activeTab === 'table' ? 'bg-white shadow' : ''}`}>Table</button>
        <button onClick={() => setActiveTab('chart')} className={`px-4 py-2 rounded-md ${activeTab === 'chart' ? 'bg-white shadow' : ''}`}>Chart</button>
        <button onClick={() => setActiveTab('recognition')} className={`px-4 py-2 rounded-md ${activeTab === 'recognition' ? 'bg-white shadow' : ''}`}>Recognition</button>
      </div>

      <div className="bg-white p-6 rounded-2xl border">
        {activeTab === 'table' && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b"><th className="pb-2">Indicator</th><th className="pb-2">Target</th><th className="pb-2">Actual</th></tr>
            </thead>
            <tbody>
              {filteredData.map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-3 text-sm">{d.indicator}</td>
                  <td className="py-3 text-sm">{d.target}</td>
                  <td className="py-3 text-sm font-bold">{d.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'chart' && (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="indicator" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
