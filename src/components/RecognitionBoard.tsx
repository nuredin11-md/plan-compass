import React, { useState, useMemo } from "react";
import { Award, Trophy, Medal, Star, Settings2, CheckCircle2, Calendar, Filter } from "lucide-react";

interface RecognitionBoardProps {
  monthlyData?: any[];
  selectedPeriod?: any;
}

const RecognitionBoard = ({ monthlyData = [], selectedPeriod }: RecognitionBoardProps) => {
  // 1. መመዘኛዎቹ (Criteria)
  const [activeCriteria] = useState([
    { id: 'progPerf', label: "Programme Performance", weight: 35 },
    { id: 'ehsig', label: "EHSIG Score", weight: 25 },
    { id: 'ipc', label: "IPC Practices", weight: 20 },
    { id: 'dataQuality', label: "Data Quality", weight: 20 }
  ]);

  // 2. የዲፓርትመንት ዝርዝርና ውጤት ስሌት
  const monthlyData = useMemo(() => {
    const departmentList = [
      { id: "mch", name: "MCH (Maternal & Child)", indicators: ["Maternal death audit", "Birth notification", "ANC4-8 dropout"] },
      { id: "nicu", name: "NICU", indicators: ["Neonate resuscitation", "KMC initiation", "Neonatal death review"] },
      { id: "or", name: "OR (Surgical)", indicators: ["Surgical volume", "Table productivity", "Cancellation rate"] },
      { id: "lab", name: "Laboratory", indicators: ["Essential test availability", "TAT record", "Stock out rate"] },
      { id: "pharmacy", name: "Pharmacy", indicators: ["Line fill rate", "Wastage rate", "AMR monitoring"] },
      { id: "emergency", name: "Emergency (EOPD)", indicators: ["Patient stay >24hrs", "Trauma registry", "Emergency mortality audit"] }
    ];

    return departmentList.map(dept => {
      // ለጊዜው እውነተኛው ዳታቤዝ ሙሉ በሙሉ እስኪገናኝ የዘፈቀደ ውጤት
      const baseScore = Math.floor(Math.random() * (98 - 65 + 1)) + 65; 
      return { ...dept, score: baseScore };
    }).sort((a, b) => b.score - a.score);
  }, [monthlyData, selectedPeriod]);

  const topThree = monthlyData.slice(0, 3);

  return (
    <div className="p-6 space-y-8 bg-white rounded-3xl border shadow-sm">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Recognition Board</h2>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100">
            <Calendar className="w-3.5 h-3.5" />
            Performance Tracking Active
          </div>
        </div>
        
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6">
          {activeCriteria.map((c, i) => (
            <div key={i} className="flex flex-col border-r last:border-0 pr-4 border-slate-200">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">{c.label}</span>
              <span className="text-xl font-black text-blue-600 leading-none">{c.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-4 md:gap-10 pt-16 pb-12 overflow-x-auto px-4">
        {/* Silver */}
        {topThree[1] && (
          <div className="flex flex-col items-center">
            <div className="bg-slate-50 p-6 rounded-3xl w-44 shadow-md border-b-8 border-slate-300 relative">
              <Medal className="absolute -top-8 left-1/2 -translate-x-1/2 w-12 h-12 text-slate-400" />
              <div className="text-center mt-4">
                <div className="font-bold text-slate-700 text-xs h-10 flex items-center justify-center uppercase">{topThree[1].name}</div>
                <div className="text-3xl font-black text-slate-400 mt-2">{topThree[1].score}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Gold */}
        {topThree[0] && (
          <div className="flex flex-col items-center">
            <div className="bg-yellow-50/50 p-8 rounded-3xl w-56 shadow-2xl border-b-8 border-yellow-400 relative scale-110">
              <Trophy className="absolute -top-10 left-1/2 -translate-x-1/2 w-16 h-16 text-yellow-500" />
              <div className="text-center mt-4">
                <div className="font-black text-yellow-900 text-sm h-10 flex items-center justify-center uppercase leading-none">{topThree[0].name}</div>
                <div className="text-5xl font-black text-yellow-600 mt-2">{topThree[0].score}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Bronze */}
        {topThree[2] && (
          <div className="flex flex-col items-center">
            <div className="bg-orange-50/30 p-6 rounded-3xl w-44 shadow-md border-b-8 border-orange-200 relative">
              <Star className="absolute -top-8 left-1/2 -translate-x-1/2 w-12 h-12 text-orange-400" />
              <div className="text-center mt-4">
                <div className="font-bold text-slate-700 text-xs h-10 flex items-center justify-center uppercase">{topThree[2].name}</div>
                <div className="text-3xl font-black text-orange-400 mt-2">{topThree[2].score}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {monthlyData.map((dept, i) => (
          <div key={i} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-black text-slate-800 text-xs uppercase">{dept.name}</h4>
              <span className="text-lg font-black text-blue-600">{dept.score}%</span>
            </div>
            <div className="space-y-2">
              {dept.indicators.map((ind, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[10px] text-slate-500 font-bold italic">
                  <CheckCircle2 className="w-3 h-3 text-blue-400/30 shrink-0 mt-0.5" />
                  {ind}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecognitionBoard;