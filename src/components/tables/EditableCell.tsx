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

export function EditableCell({
  value,
  column: _column,
  dataType,
  isEditing,
  isModified,
  isDeleted,
  onStartEdit,
  onSave,
  onCancel,
  onNavigate,
}: EditableCellProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize input value when editing starts
  useEffect(() => {
    if (isEditing) {
      setInputValue(value === null ? '' : String(value));
      // Focus after a small delay to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
        if (e.altKey) {
          e.preventDefault();
          onSave(parseValue(inputValue, dataType, value));
          onNavigate('up');
        }
        break;
      case 'ArrowDown':
        if (e.altKey) {
          e.preventDefault();
          onSave(parseValue(inputValue, dataType, value));
          onNavigate('down');
        }
        break;
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(parseValue(inputValue, dataType, value))}
        className="h-7 px-1 py-0 text-sm font-mono border-primary"
        autoFocus
      />
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
