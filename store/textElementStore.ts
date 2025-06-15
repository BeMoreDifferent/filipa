import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextElement } from '../types/textElement';

const STORAGE_KEY = 'textElements';

/**
 * Zustand store for managing text elements with AsyncStorage persistence.
 */
interface TextElementState {
  elements: TextElement[];
  hydrate: () => Promise<void>;
  add: (element: TextElement) => Promise<void>;
  update: (element: TextElement) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTextElementStore = create<TextElementState>((set, get) => ({
  elements: [],
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) set({ elements: JSON.parse(stored) });
    } catch (e) { /* handle error */ }
  },
  add: async (element) => {
    const elements = [...get().elements, element];
    set({ elements });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },
  update: async (element) => {
    const elements = get().elements.map(e => e.id === element.id ? element : e);
    set({ elements });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },
  remove: async (id) => {
    const elements = get().elements.filter(e => e.id !== id);
    set({ elements });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },
})); 