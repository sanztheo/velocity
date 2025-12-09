import { create } from 'zustand';
import { Connection, Tab } from '@/types';

interface AppState {
  // Connections
  connections: Connection[];
  activeConnectionId: string | null;
  
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  
  // UI State
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  setConnections: (connections: Connection[]) => void;
  addConnection: (connection: Connection) => void;
  updateConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  
  openTab: (tab: Omit<Tab, 'id'>) => void;
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabSql: (id: string, sql: string) => void;
  
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>((set) => ({
  connections: [],
  activeConnectionId: null,
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
  theme: 'system',
  
  setConnections: (connections) => set({ connections }),
  
  addConnection: (connection) => set((state) => ({ 
    connections: [...state.connections, connection] 
  })),
  
  updateConnection: (updatedConn) => set((state) => ({
    connections: state.connections.map((c) => 
      c.id === updatedConn.id ? updatedConn : c
    )
  })),
  
  removeConnection: (id) => set((state) => ({
    connections: state.connections.filter((c) => c.id !== id)
  })),
  
  setActiveConnection: (id) => set({ activeConnectionId: id }),
  
  openTab: (tabData) => set((state) => {
    const newTab: Tab = { ...tabData, id: crypto.randomUUID() };
    return {
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id
    };
  }),
  
  addTab: (tab) => set((state) => {
    // Check if tab already exists
    const exists = state.tabs.some(t => t.id === tab.id);
    if (exists) {
      return { activeTabId: tab.id };
    }
    return {
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    };
  }),
  
  closeTab: (id) => set((state) => {
    const newTabs = state.tabs.filter((t) => t.id !== id);
    let newActiveId = state.activeTabId;
    
    // If we closed the active tab, switch to another one
    if (state.activeTabId === id) {
      newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
    }
    
    return { tabs: newTabs, activeTabId: newActiveId };
  }),
  
  setActiveTab: (id) => set({ activeTabId: id }),
  
  updateTabSql: (id, sql) => set((state) => ({
    tabs: state.tabs.map((t) => t.id === id ? { ...t, sql } : t)
  })),
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setTheme: (theme) => {
    // Basic theme toggle logic - will need to be enhanced to actually change DOM
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    return { theme };
  }
}));
