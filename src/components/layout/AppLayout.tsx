import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useAppStore } from "@/stores/app.store";

export function AppLayout({ 
  children,
  rightPanel,
  rightPanelOpen = false,
  rightPanelSize = 25
}: { 
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  rightPanelOpen?: boolean;
  rightPanelSize?: number;
}) {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground">
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel 
            defaultSize={20} 
            minSize={15} 
            maxSize={30}
            collapsible={true}
            collapsedSize={0}
            className={sidebarCollapsed ? "hidden" : ""}
          >
            <Sidebar />
          </ResizablePanel>
          
          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
          
          <ResizablePanel defaultSize={rightPanelOpen ? (100 - 20 - rightPanelSize) : 80}>
            <div className="flex flex-col h-full w-full bg-background">
              <TabBar />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </ResizablePanel>

          {rightPanel && rightPanelOpen && (
            <>
              <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
              <ResizablePanel 
                defaultSize={rightPanelSize} 
                minSize={20} 
                maxSize={40}
              >
                {rightPanel}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

