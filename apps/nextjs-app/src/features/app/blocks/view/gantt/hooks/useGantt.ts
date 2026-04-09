import { useContext } from 'react';
import { GanttContext } from '../context';

export const useGantt = () => {
  return useContext(GanttContext);
};
