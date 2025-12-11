import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
      <AppLayout>
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
              <h2 className="text-xl font-semibold mb-2 text-foreground">Welcome to Velocity</h2>
              <p className="text-muted-foreground">
                Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘K</kbd> to search, or double-click a connection
              </p>
            </div>
          </div>
        )}
      </AppLayout>
      
      {/* AI Assistant Sheet */}
      <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <SheetContent side="right" className="w-[500px] sm:max-w-[500px] p-0">
          {activeConnectionId && (
            <ChatPanel connectionId={activeConnectionId} />
          )}
        </SheetContent>
      </Sheet>
      
      <SpotlightSearch />
      <PerformanceMonitor />
      <Toaster position="top-right" />
    </>
  );
}

export default App;
