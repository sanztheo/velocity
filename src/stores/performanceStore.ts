import { create } from 'zustand';

export interface PerformanceMetrics {
  lastQueryDuration: number; // in milliseconds
  lastRowCount: number;
  lastQueryTimestamp: number;
  queryCount: number;
  isError: boolean;
  lastErrorMessage?: string;
}

interface PerformanceState extends PerformanceMetrics {
  recordQuery: (duration: number, rowCount: number, error?: string) => void;
  reset: () => void;
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  lastQueryDuration: 0,
  lastRowCount: 0,
  lastQueryTimestamp: 0,
  queryCount: 0,
  isError: false,
  lastErrorMessage: undefined,

  recordQuery: (duration, rowCount, error) => {
    set((state) => ({
      lastQueryDuration: duration,
      lastRowCount: rowCount,
      lastQueryTimestamp: Date.now(),
      queryCount: state.queryCount + 1,
      isError: !!error,
      lastErrorMessage: error,
    }));
  },

  reset: () => {
    set({
      lastQueryDuration: 0,
      lastRowCount: 0,
      lastQueryTimestamp: 0,
      queryCount: 0,
      isError: false,
      lastErrorMessage: undefined,
    });
  },
}));
