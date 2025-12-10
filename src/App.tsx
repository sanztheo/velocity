import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";
import { EnhancedTableViewer } from "@/features/table-viewer";
import { StructurePanel } from "@/features/structure-editor";
import { SpotlightSearch } from "@/features/spotlight";
import { SqlEditor } from "@/features/sql-editor";
import { ERDiagram } from "@/features/erd";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
function App() {
  const { theme, activeTabId, tabs } = useAppStore();

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
      <AppLayout>
        {activeTab ? (
          <div className="flex-1 flex flex-col min-w-0 bg-background/50 backdrop-blur-sm relative">
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
            {/* Global Performance Monitor */}
            <PerformanceMonitor />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/50"> {/* Replaced empty state */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-light">Velocity</span>
              <span className="text-sm">Select a table or open a new query to get started</span>
              <SpotlightSearch /> {/* Moved SpotlightSearch here */}
            </div>
          </div>
        )}
      </AppLayout>
      {/* SpotlightSearch is now inside the empty state */}
      <Toaster position="top-right" />
    </>
  );
}

export default App;


