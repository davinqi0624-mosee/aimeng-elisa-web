'use client';

import { Edit3, X, Save, Check } from 'lucide-react';

interface EditModeToggleProps {
  isEditMode: boolean;
  onToggle: () => void;
  hasChanges: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  onSave: () => void;
}

/**
 * EditModeToggle - 编辑模式切换按钮
 * 
 * 固定在页面左上角，点击进入/退出编辑模式
 * 编辑模式下显示保存按钮
 */
export default function EditModeToggle({
  isEditMode,
  onToggle,
  hasChanges,
  saveStatus,
  onSave,
}: EditModeToggleProps) {
  return (
    <div className="fixed top-20 left-4 z-50 flex items-center gap-2">
      {/* Edit Mode Button */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-lg ${
          isEditMode
            ? 'bg-red-500/90 hover:bg-red-600 text-white'
            : 'bg-blue-500/90 hover:bg-blue-600 text-white'
        }`}
      >
        {isEditMode ? (
          <>
            <X className="w-4 h-4" />
            退出编辑
          </>
        ) : (
          <>
            <Edit3 className="w-4 h-4" />
            编辑模式
          </>
        )}
      </button>

      {/* Save Button (only in edit mode) */}
      {isEditMode && (
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving' || !hasChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-lg ${
            saveStatus === 'saved'
              ? 'bg-green-500/90 text-white'
              : hasChanges
              ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
              : 'bg-slate-600/90 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' && <Save className="w-4 h-4 animate-spin" />}
          {saveStatus === 'saved' && <Check className="w-4 h-4" />}
          {saveStatus === 'idle' && <Save className="w-4 h-4" />}
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存!' : '保存'}
        </button>
      )}

      {/* Changes indicator */}
      {isEditMode && hasChanges && (
        <span className="px-3 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium animate-pulse">
          有未保存更改
        </span>
      )}
    </div>
  );
}
