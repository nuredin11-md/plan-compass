import React, { createContext, useContext, useState, useEffect } from 'react';
import { Indicator, indicators as defaultIndicators } from '@/data/hospitalIndicators';

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
  if (!context) {
    throw new Error('useIndicators must be used within an IndicatorsProvider');
  }
  return context;
};

interface IndicatorsProviderProps {
  children: React.ReactNode;
}

export const IndicatorsProvider: React.FC<IndicatorsProviderProps> = ({ children }) => {
  const [indicators, setIndicators] = useState<Indicator[]>(defaultIndicators);

  // Load custom indicators from localStorage or database if needed
  useEffect(() => {
    // For now, just use defaults. In a real app, load from storage.
  }, []);

  const addIndicator = (indicator: Indicator): boolean => {
    if (indicators.some(ind => ind.code === indicator.code)) {
      return false;
    }
    setIndicators(prev => [...prev, indicator]);
    return true;
  };

  const updateIndicator = (code: string, patch: Partial<Indicator>) => {
    setIndicators(prev => prev.map(ind => ind.code === code ? { ...ind, ...patch } : ind));
  };

  const removeIndicator = (code: string) => {
    setIndicators(prev => prev.filter(ind => ind.code !== code));
  };

  const isCustom = (code: string): boolean => {
    return !defaultIndicators.some(ind => ind.code === code);
  };

  return (
    <IndicatorsContext.Provider value={{
      indicators,
      addIndicator,
      updateIndicator,
      removeIndicator,
      isCustom,
    }}>
      {children}
    </IndicatorsContext.Provider>
  );
};