import { create } from 'zustand';

export type Position = [number, number]; // [longitude, latitude]

interface RunState {
  isRecording: boolean;
  route: Position[];
  totalDistance: number; // en metros
  duration: number; // en segundos
  currentPace: number; // min/km
  averagePace: number; // min/km
  startTime: number | null;
  startRecording: () => void;
  stopRecording: () => void;
  addPosition: (pos: Position, distanceInc: number) => void;
  updateStats: (stats: Partial<Pick<RunState, 'totalDistance' | 'duration' | 'currentPace' | 'averagePace'>>) => void;
  clearRoute: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  isRecording: false,
  route: [],
  totalDistance: 0,
  duration: 0,
  currentPace: 0,
  averagePace: 0,
  startTime: null,
  startRecording: () => set({ 
    isRecording: true, 
    route: [], 
    totalDistance: 0, 
    duration: 0, 
    currentPace: 0, 
    averagePace: 0,
    startTime: Date.now() 
  }),
  stopRecording: () => set({ isRecording: false }),
  addPosition: (pos, distanceInc) =>
    set((state) => ({
      route: [...state.route, pos],
      totalDistance: state.totalDistance + distanceInc,
    })),
  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
  clearRoute: () => set({ 
    route: [], 
    totalDistance: 0, 
    duration: 0, 
    currentPace: 0, 
    averagePace: 0,
    startTime: null 
  }),
}));
