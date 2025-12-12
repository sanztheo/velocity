import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app.store";
import { cn } from "@/lib/utils";
import { 
  User, 
  Settings, 
  Bell, 
  WifiOff, 
  Users, 
  Shield, 
  Sparkles, 
  Globe
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsCategory = "preferences" | "profile" | "notifications" | "connections" | "offline" | "general" | "people" | "teamspaces" | "security" | "identity" | "ai";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("preferences");

  const sidebarGroups = [
    {
      title: "Compte",
      items: [
        { id: "profile", label: "Mon compte", icon: User },
        { id: "preferences", label: "Préférences", icon: Settings },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "connections", label: "Connexions", icon: Globe },
        { id: "offline", label: "Hors ligne", icon: WifiOff },
      ]
    },
    {
      title: "Espace de travail",
      items: [
        { id: "general", label: "Général", icon: Settings },
        { id: "people", label: "Personnes", icon: Users },
        { id: "teamspaces", label: "Espaces d'équipe", icon: Users },
        { id: "security", label: "Sécurité", icon: Shield },
        { id: "identity", label: "Identité", icon: User },
        { id: "ai", label: "IA de Velocity", icon: Sparkles },
      ]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] p-0 overflow-hidden flex h-[85vh] max-h-[900px] gap-0 border-none bg-background text-foreground shadow-2xl">
        
        {/* Sidebar */}
        <div className="w-[280px] bg-muted/40 border-r flex flex-col shrink-0">
          {/* User Profile Header */}
          <div className="p-4 flex items-center gap-3 mb-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>TS</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
               <span className="text-sm font-medium truncate">Theo Sanz</span>
               <span className="text-xs text-muted-foreground truncate">theo@velocity.app</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
            {sidebarGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                <h4 className="px-2 text-xs font-semibold text-muted-foreground mb-2">{group.title}</h4>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveCategory(item.id as SettingsCategory)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                      activeCategory === item.id 
                        ? "bg-muted text-foreground font-medium" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <DialogHeader className="px-8 py-6 border-b shrink-0 h-16 flex justify-center">
            <DialogTitle className="text-lg font-semibold">
              {sidebarGroups.flatMap(g => g.items).find(i => i.id === activeCategory)?.label || "Settings"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            {activeCategory === "preferences" && (
              <div className="max-w-2xl space-y-10">
                {/* Apparence */}
                <section className="space-y-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apparence</h3>
                  
                  <div className="flex items-start justify-between pb-4 border-b">
                    <div className="space-y-1">
                      <Label className="text-base font-normal">Apparence</Label>
                      <p className="text-sm text-muted-foreground max-w-[300px]">Personnalisez l'apparence de Velocity sur votre appareil.</p>
                    </div>
                    <Select 
                      value={theme} 
                      onValueChange={(val: any) => setTheme(val)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Thème" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Clair</SelectItem>
                        <SelectItem value="dark">Sombre</SelectItem>
                        <SelectItem value="system">Paramètres du système</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                {/* Langue et heure */}
                <section className="space-y-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Langue et heure</h3>
                  
                  <div className="flex items-start justify-between pb-4 border-b">
                    <div className="space-y-1">
                      <Label className="text-base font-normal">Langue</Label>
                      <p className="text-sm text-muted-foreground max-w-[300px]">Modifiez la langue utilisée dans l'interface utilisateur.</p>
                    </div>
                    <Select defaultValue="fr">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Langue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français (France)</SelectItem>
                        <SelectItem value="en">English (US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between pb-4 border-b">
                     <div className="pr-4 space-y-1">
                      <Label className="text-base font-normal">Toujours afficher les commandes de direction du texte</Label>
                      <p className="text-sm text-muted-foreground max-w-[380px]">Affichez les options pour modifier la direction du texte (LTR/RTL).</p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b">
                     <div className="pr-4 space-y-1">
                      <Label className="text-base font-normal">Commencer la semaine le lundi</Label>
                      <p className="text-sm text-muted-foreground max-w-[380px]">Cela modifiera l'affichage de tous vos calendriers.</p>
                    </div>
                    <Switch />
                  </div>
                
                 <div className="flex items-center justify-between pb-4 border-b">
                    <div className="pr-4 space-y-1">
                      <Label className="text-base font-normal">Définir automatiquement votre fuseau horaire</Label>
                       <p className="text-sm text-muted-foreground max-w-[380px]">L'heure d'envoi des rappels dépend de votre fuseau.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </section>
                
                 {/* Application de bureau */}
                <section className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Application de bureau</h3>
                  
                   <div className="flex items-center justify-between pb-4 border-b">
                    <div className="pr-4">
                      <Label className="text-base font-normal">Nouvel onglet de recherche</Label>
                      <p className="text-sm text-muted-foreground">Cherchez et accédez immédiatement à une page spécifique lorsque vous ouvrez un nouvel onglet.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </section>

              </div>
            )}
            
            {activeCategory !== "preferences" && (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Settings className="h-12 w-12 mb-4 opacity-20" />
                    <p>Cette section est en cours de développement.</p>
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
