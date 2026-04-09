/* eslint-disable sonarjs/no-duplicate-string */
import { Line1, Line2, Line3, Line4 } from '@teable/icons';
import { useMemo } from 'react';
import { useTranslation } from '../../context/app/i18n';

const ALL_ITEMS = [
  { value: 1, Icon: Line1 },
  { value: 2, Icon: Line2 },
  { value: 3, Icon: Line3 },
  { value: 4, Icon: Line4 },
];

export const useFieldNameDisplayLinesNodes = (min = 1, max = 3) => {
  const { t } = useTranslation();

  return useMemo(
    () =>
      ALL_ITEMS.filter((item) => item.value >= min && item.value <= max).map((item) => ({
        ...item,
        label: t('fieldNameConfig.displayLines', { count: item.value }),
      })),
    [t, min, max]
  );
};
