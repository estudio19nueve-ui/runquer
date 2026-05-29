import { create } from 'zustand';

export type Position = [number, number, number]; // [longitude, latitude, timestamp]

interface RunState {
  isRecording: boolean;
  route: Position[];
  totalDistance: number; // en metros
  duration: number; // en segundos
  currentPace: number; // min/km
  averagePace: number; // min/km
  lastKmPace: string; // MM:SS
  startTime: number | null;
  milestones: { km: number; timestamp: number }[];
  lastTriggeredKm: number;
  startRecording: () => void;
  stopRecording: () => void;
  addPosition: (pos: [number, number], timestamp?: number) => void;
  updateStats: (stats: Partial<Pick<RunState, 'totalDistance' | 'duration' | 'currentPace' | 'averagePace' | 'lastKmPace'>>) => void;
  clearRoute: () => void;
  addMilestone: (km: number, timestamp: number) => void;
  setLastTriggeredKm: (km: number) => void;
}

export const useRunStore = create<RunState>((set) => ({
  isRecording: false,
  route: [],
  totalDistance: 0,
  duration: 0,
  currentPace: 0,
  averagePace: 0,
  lastKmPace: '--:--',
  startTime: null,
  milestones: [],
  lastTriggeredKm: 0,
  startRecording: () => set({ 
    isRecording: true, 
    route: [], 
    totalDistance: 0, 
    duration: 0, 
    currentPace: 0, 
    averagePace: 0,
    lastKmPace: '--:--',
    startTime: Date.now(),
    milestones: [],
    lastTriggeredKm: 0
  }),
  stopRecording: () => set({ isRecording: false }),
  addPosition: (pos, timestamp) =>
    set((state) => ({
      route: [...state.route, [pos[0], pos[1], timestamp || Date.now()]],
    })),
  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
  clearRoute: () => set({ 
    route: [], 
    totalDistance: 0, 
    duration: 0, 
    currentPace: 0, 
    averagePace: 0,
    lastKmPace: '--:--',
    startTime: null,
    milestones: [],
    lastTriggeredKm: 0
  }),
  addMilestone: (km, timestamp) => set((state) => ({
    milestones: [...state.milestones, { km, timestamp }]
  })),
  setLastTriggeredKm: (km) => set({ lastTriggeredKm: km }),
}));
