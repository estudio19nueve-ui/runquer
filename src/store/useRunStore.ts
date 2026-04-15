import { create } from 'zustand';

export type Position = [number, number]; // [longitude, latitude]

interface RunState {
  isRecording: boolean;
  route: Position[];
  startRecording: () => void;
  stopRecording: () => void;
  addPosition: (pos: Position) => void;
  clearRoute: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  isRecording: false,
  route: [],
  startRecording: () => set({ isRecording: true, route: [] }),
  stopRecording: () => set({ isRecording: false }),
  addPosition: (pos) =>
    set((state) => ({
      route: [...state.route, pos],
    })),
  clearRoute: () => set({ route: [] }),
}));
