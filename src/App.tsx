import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";
import { EnhancedTableViewer } from "@/features/table-viewer";
import { StructurePanel } from "@/features/structure-editor";
import { SpotlightSearch } from "@/features/spotlight";
import { SqlEditor } from "@/features/sql-editor";
import { ERDiagram } from "@/features/erd";
import { ChatPanel } from "@/features/ai";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";

function App() {
  const { theme, activeTabId, tabs, aiPanelOpen, setAiPanelOpen, activeConnectionId } = useAppStore();

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <>
      <AppLayout
        rightPanel={activeConnectionId ? <ChatPanel connectionId={activeConnectionId} /> : null}
        rightPanelOpen={aiPanelOpen}
        rightPanelSize={30}
      >
        {activeTab ? (
          <div className="h-full flex flex-col">
            {activeTab.type === 'table' && activeTab.connectionId && (
              <EnhancedTableViewer 
                connectionId={activeTab.connectionId} 
                tableName={activeTab.title}
              />
            )}
            {activeTab.type === 'query' && activeTab.connectionId && (
              <SqlEditor 
                connectionId={activeTab.connectionId}
                initialSql={activeTab.sql || ''}
              />
            )}
            {activeTab.type === 'structure' && activeTab.connectionId && (
              <StructurePanel 
                connectionId={activeTab.connectionId}
                tableName={activeTab.title}
              />
            )}
            {activeTab.type === 'erd' && activeTab.connectionId && (
              <ERDiagram connectionId={activeTab.connectionId} />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <img src="/icon.png" alt="Velocity" className="w-80 h-80 mx-auto mb-6 opacity-25" />
              <h2 className="text-xl font-semibold mb-2 text-foreground">Welcome to Velocity</h2>
              <p className="text-muted-foreground">
                Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘K</kbd> to search, or double-click a connection
              </p>
            </div>
          </div>
        )}
      </AppLayout>
      
      <SpotlightSearch />
      <PerformanceMonitor />
      <Toaster position="top-right" duration={1500} />
    </>
  );
}

export default App;
