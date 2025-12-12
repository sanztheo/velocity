import { useAppStore } from "@/stores/app.store";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  return (
    <div className="flex items-center border-b bg-background overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "group flex items-center gap-2 px-3 py-2 text-sm border-r cursor-pointer min-w-[120px] max-w-[200px] select-none user-select-none",
            activeTabId === tab.id 
              ? "bg-background text-foreground font-medium border-b-2 border-b-primary -mb-[1px]" 
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="truncate flex-1">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      
      {/* AI Assistant Button */}

    </div>
  );
}

