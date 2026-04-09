import { useMemo } from 'react';
import type { IEditorProps } from '../../grid/components';
import { GRID_CONTAINER_ATTR } from '../../grid/configs';

const SAFE_SPACING = 32;
const POPUP_MIN_WIDTH = 250;

export const useGridPopupPosition = (rect: IEditorProps['rect'], maxHeight?: number) => {
  const { x, y, width, height, editorId } = rect;

  return useMemo(() => {
    const editorElement = document.querySelector('#' + editorId);
    const gridElement = editorElement?.closest(`[${GRID_CONTAINER_ATTR}]`);
    const gridBound = gridElement?.getBoundingClientRect();

    if (gridBound == null) return;

    const screenH = window.innerHeight;
    const { y: gridY } = gridBound;
    const spaceAbove = Math.max(y, gridY);
    const spaceBelow = screenH - gridY - y - height;
    const isAbove = spaceAbove > spaceBelow;
    const finalHeight = Math.min(
      (isAbove ? spaceAbove : spaceBelow) - SAFE_SPACING,
      maxHeight ?? Infinity
    );

    // Horizontal: if the popup would overflow the grid container's right edge,
    // shift it leftward so it stays visible.
    const popupWidth = Math.max(width, POPUP_MIN_WIDTH);
    const gridWidth = gridBound.width;
    const rightOverflow = x + popupWidth - gridWidth;
    const left = rightOverflow > 0 ? Math.max(-x, -rightOverflow) : undefined;

    return {
      top: isAbove ? 'unset' : height + 1,
      bottom: isAbove ? height : 'unset',
      maxHeight: finalHeight,
      ...(left != null ? { left } : {}),
    };
  }, [editorId, x, y, width, height, maxHeight]);
};
