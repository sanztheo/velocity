import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useAppStore } from "@/stores/app.store";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
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
          
          <ResizableHandle />
          
          <ResizablePanel defaultSize={80}>
            <div className="flex flex-col h-full w-full">
              <TabBar />
              <main className="flex-1 overflow-auto bg-background/50">
                {children}
              </main>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* Optional Status Bar could go here */}
    </div>
  );
}
