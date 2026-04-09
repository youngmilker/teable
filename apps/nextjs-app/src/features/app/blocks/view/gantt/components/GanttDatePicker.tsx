import React, { useState, useEffect, useCallback } from 'react';
import { Calendar } from '@teable/ui-lib';
import { zhCN } from 'date-fns/locale';

interface IGanttDatePickerProps {
  openPicker: 'left' | 'right' | null;
  pickerAnchor: { top: number; left?: number; right?: number } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (date: Date | undefined) => void;
  onClose: () => void;
}

export const GanttDatePicker: React.FC<IGanttDatePickerProps> = React.memo(({
  openPicker,
  pickerAnchor,
  containerRef,
  onSelect,
  onClose,
}) => {
  const [displayMonth, setDisplayMonth] = useState<Date>(() => new Date());

  // Close picker on outside click
  useEffect(() => {
    if (!openPicker) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openPicker, containerRef, onClose]);

  const handleSelect = useCallback((date: Date | undefined) => {
    onSelect(date);
    onClose();
  }, [onSelect, onClose]);

  if (!openPicker || !pickerAnchor) return null;

  return (
    <div
      className="z-[100] bg-white border border-gray-200 rounded-lg shadow-lg"
      style={{
        position: 'fixed',
        top: pickerAnchor.top,
        ...(pickerAnchor.left !== undefined ? { left: pickerAnchor.left } : { right: pickerAnchor.right }),
      }}
    >
      <Calendar
        mode="single"
        locale={zhCN}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        onSelect={handleSelect}
      />
    </div>
  );
});

GanttDatePicker.displayName = 'GanttDatePicker';
