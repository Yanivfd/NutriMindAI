import { create } from 'zustand';

/** 0 = this week, 1 = next week. Shared by the dashboard and grocery tabs. */
export type WeekOffset = 0 | 1;

interface WeekState {
  offset: WeekOffset;
  setOffset: (offset: WeekOffset) => void;
}

export const useWeekStore = create<WeekState>()((set) => ({
  offset: 0,
  setOffset: (offset) => set({ offset }),
}));
