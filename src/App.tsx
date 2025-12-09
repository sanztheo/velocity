import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app.store";
import { Toaster } from "@/components/ui/sonner";

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
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-2 text-foreground">{activeTab.title}</h1>
            <div className="text-muted-foreground">
              {activeTab.type === 'query' && "Query Editor Placeholder"}
              {activeTab.type === 'table' && "Table Viewer Placeholder"}
              {activeTab.type === 'structure' && "Schema Viewer Placeholder"}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2 text-foreground">Welcome to Velocity</h2>
              <p className="text-muted-foreground">Select a connection to start</p>
            </div>
          </div>
        )}
      </AppLayout>
      <Toaster position="top-right" />
    </>
  );
}

export default App;

