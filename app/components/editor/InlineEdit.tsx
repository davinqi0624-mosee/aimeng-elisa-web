'use client';

import { useState, useRef, useEffect } from 'react';

interface InlineEditProps {
  isEditMode: boolean;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
}

/**
 * InlineEdit - 内联编辑组件
 * 
 * 当 isEditMode 为 true 时，内容可点击编辑
 * 当 isEditMode 为 false 时，正常显示
 */
export default function InlineEdit({
  isEditMode,
  value,
  onChange,
  className = '',
  multiline = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // Sync value from parent
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Click outside to save
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editValue]);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  // Normal display mode
  if (!isEditMode) {
    return <span className={className}>{value}</span>;
  }

  // Edit mode - show editable field
  if (isEditing) {
    return (
      <span
        ref={ref}
        className={`relative inline-block ${className}`}
      >
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="bg-blue-500/20 border-2 border-blue-400 rounded-lg px-3 py-1 text-inherit outline-none resize-none min-w-[200px] min-h-[60px]"
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="bg-blue-500/20 border-2 border-blue-400 rounded-lg px-3 py-1 text-inherit outline-none min-w-[150px]"
          />
        )}
      </span>
    );
  }

  // Edit mode - clickable display
  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`relative cursor-pointer group ${className}`}
      title="点击编辑"
    >
      {value}
      {/* Edit indicator */}
      <span className="absolute -top-1 -right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">编辑</span>
      </span>
    </span>
  );
}
