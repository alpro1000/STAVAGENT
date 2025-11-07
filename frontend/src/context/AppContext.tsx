/**
 * App Context - Global state management
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Position, HeaderKPI, Bridge } from '@monolit/shared';

interface AppContextType {
  selectedBridge: string | null;
  setSelectedBridge: (bridgeId: string | null) => void;

  positions: Position[];
  setPositions: (positions: Position[]) => void;

  headerKPI: HeaderKPI | null;
  setHeaderKPI: (kpi: HeaderKPI | null) => void;

  bridges: Bridge[];
  setBridges: (bridges: Bridge[]) => void;

  daysPerMonth: 30 | 22;
  setDaysPerMonth: (days: 30 | 22) => void;

  showOnlyRFI: boolean;
  setShowOnlyRFI: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedBridge, setSelectedBridge] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [headerKPI, setHeaderKPI] = useState<HeaderKPI | null>(null);
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [daysPerMonth, setDaysPerMonth] = useState<30 | 22>(30);
  const [showOnlyRFI, setShowOnlyRFI] = useState(false);

  return (
    <AppContext.Provider
      value={{
        selectedBridge,
        setSelectedBridge,
        positions,
        setPositions,
        headerKPI,
        setHeaderKPI,
        bridges,
        setBridges,
        daysPerMonth,
        setDaysPerMonth,
        showOnlyRFI,
        setShowOnlyRFI
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
