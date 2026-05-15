import { useMemo } from "react";
import { Trophy, Medal, Star, Award } from "lucide-react";
import { indicators, getActualYTD, getProgramAreas, getStatus } from "@/data/hospitalIndicators";

interface Props {
  monthlyData: any[];
}

export default function RecognitionBoard({ monthlyData }: Props) {
  const departments = getProgramAreas();

  const rankings = useMemo(() => {
    const data = departments.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let totalPercent = 0;
      
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const percent = ind.target === 0 ? 0 : Math.min(Math.round((actual / ind.target) * 100), 100);
        totalPercent += percent;
      });

      const avgPercent = areaInds.length > 0 ? Math.round(totalPercent / areaInds.length) : 0;
      return { area, avgPercent, status: getStatus(avgPercent) };
    });

    return data.sort((a, b) => b.avgPercent - a.avgPercent).slice(0, 3);
  }, [monthlyData]);

  if (rankings.length < 3) return null;

  const top3 = {
    gold: rankings[0],
    silver: rankings[1],
    bronze: rankings[2]
  };

  return (
    <div className="space-y-12 py-10 animate-in fade-in duration-700">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 mb-4 shadow-inner">
          <Award className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">2017 EFY Recognition Board</h2>
        <p className="text-slate-500 font-medium text-lg italic">Top Departmental Performance Ranking based on EHSTG Metrics</p>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-5xl mx-auto px-4">
        {/* Silver - 2nd Place */}
        <div className="flex flex-col items-center group w-full md:w-64">
           <div className="mb-4 transform group-hover:scale-110 transition-transform">
             <Medal className="w-16 h-16 text-slate-400 drop-shadow-md" />
           </div>
           <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 w-full text-center shadow-lg relative overflow-hidden h-56 flex flex-col justify-center">
             <div className="absolute top-0 left-0 w-full h-2 bg-slate-300"></div>
             <h3 className="text-xl font-bold text-slate-800 mb-1">{top3.silver.area}</h3>
             <div className="text-4xl font-black text-slate-600 mb-2">{top3.silver.avgPercent}%</div>
             <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Silver Award</span>
           </div>
        </div>

        {/* Gold - 1st Place */}
        <div className="flex flex-col items-center group w-full md:w-72 order-first md:order-none">
           <div className="mb-6 transform group-hover:scale-125 transition-transform">
             <Trophy className="w-24 h-24 text-yellow-500 drop-shadow-xl" />
           </div>
           <div className="bg-gradient-to-b from-yellow-50 to-white border-4 border-yellow-400 rounded-3xl p-10 w-full text-center shadow-2xl relative overflow-hidden h-72 flex flex-col justify-center">
             <div className="absolute top-0 left-0 w-full h-3 bg-yellow-400 animate-pulse"></div>
             <h3 className="text-2xl font-black text-yellow-900 mb-2">{top3.gold.area}</h3>
             <div className="text-6xl font-black text-yellow-600 mb-3">{top3.gold.avgPercent}%</div>
             <span className="text-sm font-black uppercase tracking-widest text-yellow-700 bg-yellow-200 px-4 py-1 rounded-full mx-auto">Gold Winner</span>
           </div>
        </div>

        {/* Bronze - 3rd Place */}
        <div className="flex flex-col items-center group w-full md:w-64">
           <div className="mb-4 transform group-hover:scale-110 transition-transform">
             <Star className="w-14 h-14 text-orange-400 drop-shadow-md" />
           </div>
           <div className="bg-white border-2 border-orange-100 rounded-3xl p-6 w-full text-center shadow-md relative overflow-hidden h-48 flex flex-col justify-center">
             <div className="absolute top-0 left-0 w-full h-2 bg-orange-200"></div>
             <h3 className="text-lg font-bold text-slate-800 mb-1">{top3.bronze.area}</h3>
             <div className="text-3xl font-black text-orange-600 mb-1">{top3.bronze.avgPercent}%</div>
             <span className="text-xs font-bold uppercase tracking-widest text-orange-300">Bronze Award</span>
           </div>
        </div>
      </div>
    </div>
  );
}