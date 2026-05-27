import React, { createContext, useContext, useState, useEffect } from 'react';
import { Indicator, setIndicatorsFromDB } from '@/data/hospitalIndicators';
import { fetchIndicatorsFromDB } from '../../hospitalDataSync';

interface IndicatorsContextType {
  indicators: Indicator[];
  addIndicator: (indicator: Indicator) => boolean;
  updateIndicator: (code: string, patch: Partial<Indicator>) => void;
  removeIndicator: (code: string) => void;
  isCustom: (code: string) => boolean;
}

const IndicatorsContext = createContext<IndicatorsContextType | undefined>(undefined);

export const useIndicators = () => {
  const context = useContext(IndicatorsContext);
  if (!context) throw new Error('useIndicators must be used within an IndicatorsProvider');
  return context;
};

export const IndicatorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [indicators, setIndicators] = useState<Indicator[]>([]); // መጀመሪያ ባዶ ይሁን

  // 1. ዳታውን ከሱፓቤዝ የሚያመጣው useEffect
  useEffect(() => {
    const loadIndicators = async () => {
      try {
        const inds = await fetchIndicatorsFromDB();
        setIndicatorsFromDB(inds);
        setIndicators(inds);
      } catch (error) {
        console.error('Failed to load indicators from Supabase:', error);
      }
    };

    loadIndicators();
  }, []);

  // 2. ሌሎች ተግባራት (add/update/remove)
  // እዚህ ጋር ወደ ሱፓቤዝም የመላክ (upsert) ሎጂክ ማከል አለብን
  const addIndicator = (indicator: Indicator): boolean => {
    if (indicators.some(ind => ind.code === indicator.code)) return false;
    setIndicators(prev => [...prev, indicator]);
    // እዚህ ጋር supabase.from('...').insert(...) ይጨመራል
    return true;
  };

  const updateIndicator = (code: string, patch: Partial<Indicator>) => {
    setIndicators(prev => prev.map(ind => ind.code === code ? { ...ind, ...patch } : ind));
  };

  const removeIndicator = (code: string) => {
    setIndicators(prev => prev.filter(ind => ind.code !== code));
  };

  const isCustom = (code: string): boolean => true; // እንደ አስፈላጊነቱ አስተካክለው

  return (
    <IndicatorsContext.Provider value={{ indicators, addIndicator, updateIndicator, removeIndicator, isCustom }}>
      {children}
    </IndicatorsContext.Provider>
  );
};
