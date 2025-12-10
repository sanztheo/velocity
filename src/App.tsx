import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";
import { TableViewer } from "@/components/tables/TableViewer";
import { SpotlightSearch } from "@/features/spotlight";

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
          <div className="h-full flex flex-col">
            {activeTab.type === 'table' && activeTab.connectionId && (
              <TableViewer 
                connectionId={activeTab.connectionId} 
                tableName={activeTab.title}
              />
            )}
            {activeTab.type === 'query' && (
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-2 text-foreground">{activeTab.title}</h1>
                <div className="text-muted-foreground">Query Editor - Coming soon</div>
              </div>
            )}
            {activeTab.type === 'structure' && (
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-2 text-foreground">{activeTab.title}</h1>
                <div className="text-muted-foreground">Schema Viewer - Coming soon</div>
              </div>
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
      <SpotlightSearch />
      <Toaster position="top-right" />
    </>
  );
}

export default App;


