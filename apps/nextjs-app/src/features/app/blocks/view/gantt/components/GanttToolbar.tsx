import React from 'react';

interface IGanttToolbarProps {
  onTodayClick: () => void;
}

export const GanttToolbar: React.FC<IGanttToolbarProps> = React.memo(({ onTodayClick }) => (
  <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 h-10 flex items-center px-2 gap-2">
    <button
      className="text-[11px] px-2 py-1 rounded border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-600 font-medium transition-colors"
      onClick={onTodayClick}
    >
      今天
    </button>
  </div>
));

GanttToolbar.displayName = 'GanttToolbar';
