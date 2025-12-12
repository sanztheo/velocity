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
  aiPanelOpen: boolean;
  
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
  setAiPanelOpen: (open: boolean) => void;
  closeTabsForConnection: (connectionId: string) => void;
}

import { persist } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      tabs: [],
      activeTabId: null,
      sidebarCollapsed: false,
      theme: 'system',
      aiPanelOpen: false,
      
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
        // Check if a tab with the same properties already exists
        const existingTab = state.tabs.find(t => {
          // Basic checks
          if (t.connectionId !== tabData.connectionId || t.type !== tabData.type) {
            return false;
          }
          
          // For table tabs, check table name
          if (t.type === 'table' && t.tableName !== tabData.tableName) {
            return false;
          }
          
          return true;
        });

        if (existingTab) {
          return { activeTabId: existingTab.id };
        }

        const newTab: Tab = { ...tabData, id: crypto.randomUUID() };
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id
        };
      }),
      
      addTab: (tab) => set((state) => {
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
      
      setTheme: (theme) => set({ theme }),
      
      setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
      
      closeTabsForConnection: (connectionId) => set((state) => {
        const newTabs = state.tabs.filter((t) => t.connectionId !== connectionId);
        let newActiveId = state.activeTabId;

        // If active tab was removed, switch to another
        if (newActiveId && !newTabs.find(t => t.id === newActiveId)) {
            newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }

        return { tabs: newTabs, activeTabId: newActiveId };
      }),
    }),
    {
      name: 'velocity-storage',
      partialize: (state) => ({ 
        connections: state.connections,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed
      }),
    }
  )
);
