import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Database, Table, Eye, FunctionSquare, Zap, Loader2 } from 'lucide-react';
import { useSpotlight, SpotlightItem } from './useSpotlight';

const ICON_MAP = {
  table: Table,
  view: Eye,
  function: FunctionSquare,
  connection: Database,
  action: Zap,
};

function SpotlightItemIcon({ type }: { type: SpotlightItem['type'] }) {
  const Icon = ICON_MAP[type];
  return <Icon className="h-4 w-4 mr-2 shrink-0" />;
}

export function SpotlightSearch() {
  const {
    open,
    setOpen,
    search,
    setSearch,
    items,
    isLoading,
    handleSelect,
  } = useSpotlight();

  // Group items by type for display
  const tables = items.filter(i => i.type === 'table');
  const views = items.filter(i => i.type === 'view');
  const functions = items.filter(i => i.type === 'function');
  const connections = items.filter(i => i.type === 'connection');
  const actions = items.filter(i => i.type === 'action');

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search tables, views, connections..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>

            {tables.length > 0 && (
              <CommandGroup heading="Tables">
                {tables.slice(0, 10).map(item => (
                  <CommandItem 
                    key={item.id} 
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <SpotlightItemIcon type={item.type} />
                    <span>{item.name}</span>
                    {item.connectionName && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {item.connectionName}
                      </span>
                    )}
                  </CommandItem>
                ))}
                {tables.length > 10 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    +{tables.length - 10} more tables...
                  </div>
                )}
              </CommandGroup>
            )}

            {views.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Views">
                  {views.slice(0, 5).map(item => (
                    <CommandItem 
                      key={item.id} 
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <SpotlightItemIcon type={item.type} />
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {functions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Functions">
                  {functions.slice(0, 5).map(item => (
                    <CommandItem 
                      key={item.id} 
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <SpotlightItemIcon type={item.type} />
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {connections.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Connections">
                  {connections.map(item => (
                    <CommandItem 
                      key={item.id} 
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <SpotlightItemIcon type={item.type} />
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {actions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {actions.map(item => (
                    <CommandItem 
                      key={item.id} 
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <SpotlightItemIcon type={item.type} />
                      <span>{item.name}</span>
                      {item.shortcut && (
                        <kbd className="ml-auto bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium">
                          {item.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
