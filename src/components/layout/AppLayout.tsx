import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useAppStore } from "@/stores/app.store";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

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
  const { sidebarCollapsed, toggleSidebar, activeConnectionId, setAiPanelOpen } = useAppStore();
  const sidebarRef = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      if (sidebarCollapsed) {
        sidebar.collapse();
      } else {
        sidebar.expand();
      }
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground">
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel 
            ref={sidebarRef}
            defaultSize={20} 
            minSize={15} 
            maxSize={30}
            collapsible={true}
            collapsedSize={0}
            className="transition-[flex-grow,flex-shrink,flex-basis] duration-300 ease-in-out"
          >
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full"
                >
                  <Sidebar />
                </motion.div>
              )}
            </AnimatePresence>
          </ResizablePanel>
          
          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
          
          <ResizablePanel defaultSize={rightPanelOpen ? (100 - 20 - rightPanelSize) : 80}>
            <div className="flex flex-col h-full w-full bg-background">
              <div className="h-12 w-full shrink-0 bg-background border-b flex items-center justify-end pr-4" data-tauri-drag-region>
                 <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAiPanelOpen(true)}
                  disabled={!activeConnectionId}
                  className="gap-2"
                >
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Assistant</span>
                </Button>
              </div>
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
                minSize={28} 
                maxSize={45}
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

