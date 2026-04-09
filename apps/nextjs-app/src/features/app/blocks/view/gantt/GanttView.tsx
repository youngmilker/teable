import {
  AggregationProvider,
  RecordProvider,
  RowCountProvider,
  TaskStatusCollectionProvider,
} from '@teable/sdk/context';
import { SearchProvider } from '@teable/sdk/context/query';
import { usePersonalView, useView } from '@teable/sdk/hooks';
import { useMemo } from 'react';
import { GanttGridToolBar } from '../tool-bar/GanttGridToolBar';
import type { IViewBaseProps } from '../types';
import { GanttProvider } from './context';
import { GridGanttViewBase } from './GanttViewBase';
import { AddDateFieldDialog } from './components';

export const GridGanttView = (props: IViewBaseProps) => {
  const { recordServerData, recordsServerData, groupPointsServerDataMap } = props;
  const { personalViewCommonQuery, personalViewAggregationQuery } = usePersonalView();
  
  const view = useView();
  // Include the view's filter in the RowCountProvider query so that when the
  // server-side filter changes, the React Query key changes and an immediate
  // refetch is triggered (instead of relying on the throttled applyViewFilter
  // event + keepPreviousData in RowCountProvider).
  const rowCountQuery = useMemo(
    () => ({ ...personalViewCommonQuery, filter: view?.filter }),
    [personalViewCommonQuery, view?.filter]
  );

  return (
    <SearchProvider>
      <RecordProvider serverRecords={recordsServerData.records} serverRecord={recordServerData}>
        <AggregationProvider query={personalViewAggregationQuery}>
          <TaskStatusCollectionProvider>
            <RowCountProvider query={personalViewCommonQuery}>
              <GanttProvider>
                <GanttGridToolBar />
                <div className="w-full grow overflow-hidden sm:pl-2">
                  <GridGanttViewBase groupPointsServerDataMap={groupPointsServerDataMap} />
                </div>
                <AddDateFieldDialog />
              </GanttProvider>
            </RowCountProvider>
          </TaskStatusCollectionProvider>
        </AggregationProvider>
      </RecordProvider>
    </SearchProvider>
  );
};
