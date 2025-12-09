import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { setTheme, theme, activeTabId, tabs } = useAppStore();

  useEffect(() => {
    // Initialize theme
    setTheme(theme);
  }, [setTheme, theme]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <>
      <AppLayout>
        {activeTab ? (
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-2">{activeTab.title}</h1>
            <div className="text-muted-foreground">
              {activeTab.type === 'query' && "Query Editor Placeholder"}
              {activeTab.type === 'table' && "Table Viewer Placeholder"}
              {activeTab.type === 'structure' && "Schema Viewer Placeholder"}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-1">Welcome to Velocity</h2>
              <p className="text-sm">Select a connection to start</p>
            </div>
          </div>
        )}
      </AppLayout>
      <Toaster />
    </>
  );
}

export default App;
