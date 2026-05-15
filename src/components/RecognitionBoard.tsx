import React, { useState } from "react";
import { Award, Trophy, Medal, Star, Settings2, CheckCircle2 } from "lucide-react";

const RecognitionBoard = ({ monthlyData }: { monthlyData?: any }) => {
  // 1. መለኪያዎቹ በየአመቱ እንዲቀያየሩ (Editable Weights)
  // እነዚህን ቁጥሮች በመቀየር የቦርዱን የክብደት መመሪያ ማስተካከል ይቻላል
  const [weights] = useState([
    { label: "Programme Performance", weight: 35 },
    { label: "EHSIG Score", weight: 25 },
    { label: "IPC Practices", weight: 20 },
    { label: "Data Quality & Reporting", weight: 20 },
  ]);

  // 2. የዲፓርትመንት መለኪያዎች (ከሰነዱ የተወሰዱ)
  const departments = [
    {
      name: "MCH (Maternal & Child)",
      score: 88, // ይህ ከዳታቤዝ የሚመጣ ውጤት ይሆናል
      indicators: [
        "Maternal death audit & review",
        "Cervical cancer plan vs achievement",
        "Birth notification",
        "SBA plan vs achievement",
        "PMTCT/Viral load suppression",
        "ANC4 to ANC8 dropout rate"
      ]
    },
    {
      name: "NICU",
      score: 92,
      indicators: [
        "Neonate resuscitate and survive",
        "KMC initiation",
        "Neonatal death review",
        "Bed Occupancy Rate (BOR)",
        "Appropriate use of antibiotics"
      ]
    },
    {
      name: "OR (Surgical)",
      score: 85,
      indicators: [
        "Surgical volume",
        "Table productivity",
        "Reduction of waiting list",
        "Cancellation rate",
        "SSC checklist (10 cards)"
      ]
    },
    {
      name: "Laboratory",
      score: 79,
      indicators: [
        "Essential test availability",
        "TAT record and action taken",
        "EQA/IQA performance",
        "Stock out rate",
        "GenExpert performance"
      ]
    },
    {
      name: "Pharmacy",
      score: 82,
      indicators: [
        "Line fill rate",
        "Wastage rate",
        "Drug prescription from facility list",
        "AMR monitoring",
        "Clinical pharmacy functionality"
      ]
    },
    {
      name: "Emergency (EOPD)",
      score: 75,
      indicators: [
        "Patient stay >24hrs monitoring",
        "Trauma registry utilization",
        "Emergency mortality audit",
        "Emergency drug availability"
      ]
    }
  ];

  // ውጤታቸውን በማወዳደር 1ኛ፣ 2ኛ እና 3ኛን መለየት
  const topThree = [...departments].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div className="p-6 space-y-8 bg-white rounded-3xl border shadow-sm">
      {/* Header - መመዘኛዎቹን የሚያሳይ */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8">
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">HOSPITAL RECOGNITION BOARD</h2>
          <p className="text-slate-500 font-medium tracking-wide mt-1">2017 EFY Performance Ranking System</p>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-center gap-6">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r pr-4">
            <Settings2 className="w-4 h-4" /> Criteria Weights
          </div>
          {weights.map((w, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{w.label}</span>
              <span className="text-lg font-black text-blue-600">{w.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Podium - ከፍተኛ ውጤት ያመጡ ክፍሎች */}
      <div className="flex justify-center items-end gap-4 md:gap-10 pt-12 pb-8 overflow-x-auto">
        {/* Silver */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-slate-50 p-6 rounded-3xl w-44 shadow-md border-b-8 border-slate-300 relative transition-all hover:shadow-xl hover:-translate-y-2">
            <Medal className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 text-slate-400 drop-shadow-md" />
            <div className="text-center mt-4">
              <div className="font-bold text-slate-700 text-sm h-12 flex items-center justify-center uppercase">{topThree[1]?.name}</div>
              <div className="text-4xl font-black text-slate-400 mt-2">{topThree[1]?.score}%</div>
            </div>
          </div>
          <span className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Silver Award</span>
        </div>

        {/* Gold */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-yellow-50/50 p-8 rounded-3xl w-56 shadow-2xl border-b-8 border-yellow-400 relative transition-all hover:shadow-yellow-100 hover:-translate-y-4 scale-110">
            <Trophy className="absolute -top-10 left-1/2 -translate-x-1/2 w-16 h-16 text-yellow-500 drop-shadow-lg" />
            <div className="text-center mt-4">
              <div className="font-black text-yellow-900 text-lg h-12 flex items-center justify-center uppercase leading-none">{topThree[0]?.name}</div>
              <div className="text-5xl font-black text-yellow-600 mt-2">{topThree[0]?.score}%</div>
            </div>
          </div>
          <span className="mt-8 text-xs font-black text-yellow-600 uppercase tracking-[0.2em]">Gold Winner</span>
        </div>

        {/* Bronze */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-orange-50/30 p-6 rounded-3xl w-44 shadow-md border-b-8 border-orange-300 relative transition-all hover:shadow-xl hover:-translate-y-2">
            <Star className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 text-orange-400 drop-shadow-md" />
            <div className="text-center mt-4">
              <div className="font-bold text-slate-700 text-sm h-12 flex items-center justify-center uppercase">{topThree[2]?.name}</div>
              <div className="text-4xl font-black text-orange-400 mt-2">{topThree[2]?.score}%</div>
            </div>
          </div>
          <span className="mt-4 text-[10px] font-black text-orange-400 uppercase tracking-widest">Bronze Award</span>
        </div>
      </div>

      {/* ዝርዝር መረጃ ለእያንዳንዱ ዲፓርትመንት */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
        {departments.map((dept, i) => (
          <div key={i} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-5">
              <h4 className="font-black text-slate-800 text-sm leading-tight max-w-[70%]">{dept.name}</h4>
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-blue-600 leading-none">{dept.score}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Score</span>
              </div>
            </div>
            
            <div className="space-y-2.5">
              {dept.indicators.map((ind, idx) => (
                <div key={idx} className="flex items-start gap-3 text-[11px] text-slate-500 font-semibold leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/50 shrink-0 mt-0.5 group-hover:text-blue-500 transition-colors" />
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