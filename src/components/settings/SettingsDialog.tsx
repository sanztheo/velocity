import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app.store";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsCategory = "preferences";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("preferences");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex h-[500px]">
        {/* Sidebar */}
        <div className="w-[200px] bg-muted/30 border-r p-4 flex flex-col gap-2">
           <DialogHeader className="mb-4 px-2">
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          
          <button
            onClick={() => setActiveCategory("preferences")}
            className={cn(
              "text-sm font-medium px-4 py-2 rounded-md text-left transition-colors",
              activeCategory === "preferences" 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Preferences
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeCategory === "preferences" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Appearance</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <ThemeCard 
                        active={theme === 'light'} 
                        onClick={() => setTheme('light')}
                        icon={<Sun className="h-6 w-6" />}
                        label="Light"
                      />
                      <ThemeCard 
                        active={theme === 'dark'} 
                        onClick={() => setTheme('dark')}
                        icon={<Moon className="h-6 w-6" />}
                        label="Dark"
                      />
                      <ThemeCard 
                        active={theme === 'system'} 
                        onClick={() => setTheme('system')}
                        icon={<Monitor className="h-6 w-6" />}
                        label="System"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThemeCard({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all flex flex-col items-center gap-2",
        active ? "border-primary bg-primary/5" : "border-muted bg-card"
      )}
    >
      <div className={cn("rounded-full p-2", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
