import { useAppStore } from "@/stores/app.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const { connections } = useAppStore();

  return (
    <div className="flex bg-sidebar h-full w-full flex-col border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <span className="font-semibold text-sm text-sidebar-foreground">Connections</span>
        <Button variant="ghost" size="icon" className="h-4 w-4">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {connections.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center">
              No connections
            </div>
          )}
          {connections.map((conn) => (
            <div key={conn.id} className="text-sm p-2 hover:bg-sidebar-accent rounded cursor-pointer">
              {conn.name}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
