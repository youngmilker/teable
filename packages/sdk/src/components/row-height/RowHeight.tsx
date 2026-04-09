import type { RowHeightLevel } from '@teable/core';
import React from 'react';
import { RowHeightBase } from './RowHeightBase';
import { useRowHeightNode } from './useRowHeightNode';

export const RowHeight: React.FC<{
  rowHeight?: RowHeightLevel;
  fieldNameDisplayLines?: number;
  fieldNameDisplayLinesRange?: { min: number; max: number };
  onChange?: (type: 'rowHeight' | 'fieldNameDisplayLines', value: RowHeightLevel | number) => void;
  children: (
    text: string,
    isActive: boolean,
    Icon: React.FC<{ className?: string }>
  ) => React.ReactNode;
}> = ({ children, rowHeight, fieldNameDisplayLines, fieldNameDisplayLinesRange, onChange }) => {
  const { text, Icon, isActive } = useRowHeightNode(rowHeight);

  return (
    <RowHeightBase
      rowHeight={text}
      fieldNameDisplayLines={fieldNameDisplayLines ?? fieldNameDisplayLinesRange?.min ?? 1}
      fieldNameDisplayLinesRange={fieldNameDisplayLinesRange}
      onChange={onChange}
    >
      {children(text, isActive, Icon)}
    </RowHeightBase>
  );
};
