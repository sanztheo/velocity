// MentionDropdown Component
// Autocomplete dropdown for @ mentions in chat input

import { useEffect, useRef } from 'react';
import { Globe, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mention } from './useMentions';

interface MentionDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  tables: string[];
  onSelect: (mention: Mention) => void;
  onClose: () => void;
  selectedIndex: number;
}

interface MentionOption {
  type: 'table' | 'web';
  value: string;
  displayName: string;
  icon: React.ReactNode;
}

export function MentionDropdown({
  isOpen,
  searchQuery,
  tables,
  onSelect,
  onClose,
  selectedIndex,
}: MentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build options list
  const options: MentionOption[] = [];

  // Add @web option
  if (!searchQuery || 'web'.includes(searchQuery.toLowerCase())) {
    options.push({
      type: 'web',
      value: 'web',
      displayName: '@web',
      icon: <Globe className="h-3.5 w-3.5 text-blue-500" />,
    });
  }

  // Add table options
  const filteredTables = tables.filter(t => 
    !searchQuery || t.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  filteredTables.slice(0, 10).forEach(table => {
    options.push({
      type: 'table',
      value: table,
      displayName: `@${table}`,
      icon: <Table2 className="h-3.5 w-3.5 text-muted-foreground" />,
    });
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || options.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute bottom-full left-0 mb-2 w-64 z-50",
        "bg-popover border border-border rounded-lg shadow-lg",
        "max-h-[200px] overflow-y-auto"
      )}
    >
      <div className="p-1">
        {options.map((option, index) => (
          <button
            key={`${option.type}-${option.value}`}
            onClick={() => onSelect({
              type: option.type,
              value: option.value,
              displayName: option.displayName,
            })}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
              "transition-colors hover:bg-muted/50",
              index === selectedIndex && "bg-muted"
            )}
          >
            {option.icon}
            <span className="font-medium">{option.displayName}</span>
            {option.type === 'web' && (
              <span className="text-xs text-muted-foreground ml-auto">Web search</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
