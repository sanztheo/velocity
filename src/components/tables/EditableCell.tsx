import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: unknown;
  column: string;
  dataType: string;
  isEditing: boolean;
  isModified: boolean;
  isDeleted: boolean;
  onStartEdit: () => void;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
  onNavigate: (direction: 'left' | 'right' | 'up' | 'down') => void;
}

// Get color class based on data type
function getDataTypeColor(dataType: string, value: unknown): string {
  if (value === null) return 'text-muted-foreground italic';
  
  const type = dataType.toLowerCase();
  
  // Numbers
  if (type.includes('int') || type.includes('numeric') || type.includes('decimal') || 
      type.includes('float') || type.includes('double') || type.includes('real') ||
      type.includes('serial') || type.includes('money')) {
    return 'text-blue-400';
  }
  
  // Booleans
  if (type.includes('bool')) {
    return value ? 'text-green-400' : 'text-red-400';
  }
  
  // Dates/Times
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return 'text-purple-400';
  }
  
  // JSON/Arrays
  if (type.includes('json') || type.includes('array') || type.includes('[]')) {
    return 'text-orange-400';
  }
  
  // Binary/Blob
  if (type.includes('blob') || type.includes('bytea') || type.includes('binary')) {
    return 'text-gray-400';
  }
  
  // UUID
  if (type.includes('uuid')) {
    return 'text-cyan-400';
  }
  
  // Default (text/varchar etc)
  return '';
}

// Format value for display
function formatValue(value: unknown, dataType: string): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  
  const type = dataType.toLowerCase();
  
  // Boolean display
  if (type.includes('bool')) {
    return value ? 'true' : 'false';
  }
  
  // Binary/Blob - don't show actual content
  if (type.includes('blob') || type.includes('bytea') || type.includes('binary')) {
    return '[BINARY]';
  }
  
  // JSON - pretty print truncated
  if (type.includes('json') && typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 50 ? str.substring(0, 47) + '...' : str;
  }
  
  return String(value);
}

// Parse input value back to proper type
function parseValue(inputValue: string, dataType: string, originalValue: unknown): unknown {
  if (inputValue === '' || inputValue.toLowerCase() === 'null') return null;
  
  const type = dataType.toLowerCase();
  
  // Numbers
  if (type.includes('int') && !type.includes('interval')) {
    const parsed = parseInt(inputValue, 10);
    return isNaN(parsed) ? originalValue : parsed;
  }
  
  if (type.includes('numeric') || type.includes('decimal') || 
      type.includes('float') || type.includes('double') || type.includes('real')) {
    const parsed = parseFloat(inputValue);
    return isNaN(parsed) ? originalValue : parsed;
  }
  
  // Booleans
  if (type.includes('bool')) {
    const lower = inputValue.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return originalValue;
  }
  
  return inputValue;
}

import { getColumnValues } from '@/lib/tauri';

function getSuggestionsForType(
  dataType: string, 
  inputValue: string, 
  knownValues: string[] = [] // Add knownValues to the function signature
): string[] {
  const type = dataType.toLowerCase();
  const input = inputValue.toLowerCase();
  let suggestions: string[] = [];

  if (type.includes('bool')) {
    if ('true'.startsWith(input)) suggestions.push('true');
    if ('false'.startsWith(input)) suggestions.push('false');
  } else if (knownValues.length > 0) {
      // Filter known values
      suggestions = knownValues.filter(v => v.toLowerCase().includes(input));
  }

  return suggestions;
}

export function EditableCell({
  value,
  column: _column, // column name
  dataType,
  isEditing,
  isModified,
  isDeleted,
  connectionId,
  tableName,
  onStartEdit,
  onSave,
  onCancel,
  onNavigate,
}: EditableCellProps & { connectionId?: string; tableName?: string }) { // Add optional props to type
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [columnValues, setColumnValues] = useState<string[]>([]); // Store fetched values
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize input value when editing starts
  useEffect(() => {
    if (isEditing) {
      const initialVal = value === null ? '' : String(value);
      setInputValue(initialVal);
      
      // Fetch column values if context is provided and not boolean
      const type = dataType.toLowerCase();
      if (!type.includes('bool') && connectionId && tableName) {
           getColumnValues(connectionId, tableName, _column)
             .then(values => {
                 setColumnValues(values);
                 // Update suggestions immediately after fetch
                 setSuggestions(getSuggestionsForType(dataType, initialVal, values));
             })
             .catch(err => console.error("Failed to fetch column values", err));
      } else {
          setColumnValues([]);
          setSuggestions(getSuggestionsForType(dataType, initialVal, []));
      }
      
      setSelectedSuggestionIndex(0);
      
      // Focus after a small delay to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value, dataType, connectionId, tableName, _column]); 

  // Update suggestions when input changes
  useEffect(() => {
    if (isEditing) {
      const newSuggestions = getSuggestionsForType(dataType, inputValue, columnValues);
      setSuggestions(newSuggestions);
      setSelectedSuggestionIndex(prev => Math.min(prev, Math.max(0, newSuggestions.length - 1)));
    }
  }, [inputValue, isEditing, dataType, columnValues]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
          // If we have a suggestion selected and it's not just a generic enter/tab handling
          // But wait, Enter usually saves. If we are navigating suggestions, Enter should pick the suggestion.
          if (suggestions.length > 0) {
              e.preventDefault();
              const selectedValue = suggestions[selectedSuggestionIndex];
              // Update input to the selected suggestion
              setInputValue(selectedValue);
              // We want to save, but maybe just setting input value is enough for the next generic 'Enter' press?
              // Or should we save immediately? 
              // Standard behavior: Enter picks suggestion if list is open, then next Enter saves.
              // But here inline editing usually commits on Enter.
              // Let's make it commit immediately with the suggested value.
              onSave(parseValue(selectedValue, dataType, value));
              if (e.key === 'Tab') {
                   onNavigate(e.shiftKey ? 'left' : 'right');
              }
              return;
          }
      }
    }

    switch (e.key) {
      case 'Enter':
        onSave(parseValue(inputValue, dataType, value));
        break;
      case 'Escape':
        onCancel();
        break;
      case 'Tab':
        e.preventDefault();
        onSave(parseValue(inputValue, dataType, value));
        onNavigate(e.shiftKey ? 'left' : 'right');
        break;
      case 'ArrowUp':
        if (e.altKey && suggestions.length === 0) { // Only standard nav if no suggestions or Alt used
          e.preventDefault();
          onSave(parseValue(inputValue, dataType, value));
          onNavigate('up');
        }
        break;
      case 'ArrowDown':
        if (e.altKey && suggestions.length === 0) { // Only standard nav if no suggestions or Alt used
          e.preventDefault();
          onSave(parseValue(inputValue, dataType, value));
          onNavigate('down');
        }
        break;
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
              // Delay save to allow clicking suggestions if we added click handlers later
              // For now standard blur save
              onSave(parseValue(inputValue, dataType, value));
          }}
          className="h-7 px-1 py-0 text-sm font-mono border-primary"
          autoFocus // Technically redundant with the useEffect focus, but good backup
        />
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full min-w-[100px] mt-1 bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden">
             {suggestions.map((suggestion, index) => (
               <div
                 key={suggestion}
                 className={cn(
                   "px-2 py-1 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                   index === selectedSuggestionIndex && "bg-accent text-accent-foreground"
                 )}
                 onMouseDown={(e) => {
                     e.preventDefault(); // Prevent input blur
                     setInputValue(suggestion);
                     onSave(parseValue(suggestion, dataType, value));
                 }}
               >
                 {suggestion}
               </div>
             ))}
          </div>
        )}
      </div>
    );
  }

  const colorClass = getDataTypeColor(dataType, value);
  const displayValue = formatValue(value, dataType);

  return (
    <div
      className={cn(
        'px-2 py-1 font-mono text-sm cursor-pointer min-h-[28px] truncate',
        colorClass,
        isModified && 'bg-yellow-500/20 border-l-2 border-yellow-500',
        isDeleted && 'line-through opacity-50',
        value === null && 'italic'
      )}
      onDoubleClick={onStartEdit}
      title={String(value)}
    >
      {displayValue}
    </div>
  );
}
