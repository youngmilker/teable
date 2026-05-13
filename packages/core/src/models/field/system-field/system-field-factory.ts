import { FieldType } from '../constant';
import type { IFieldRo } from '../field.schema';
import type { IConfigSource } from './config-source.schema';
import { SYSTEM_DB_FIELD_PREFIX, SystemFieldKey } from './constant';

export interface IBuildSystemFieldContext {
  spaceId: string;
}

export function buildSystemFieldPayload(
  key: SystemFieldKey,
  ctx: IBuildSystemFieldContext
): IFieldRo {
  switch (key) {
    case SystemFieldKey.Title:
      return {
        type: FieldType.SingleLineText,
        name: '标题',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}title`,
        isSystemField: true,
        systemFieldKey: key,
      };
    case SystemFieldKey.Assignee:
      return {
        type: FieldType.User,
        name: '负责人',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}assignee`,
        isSystemField: true,
        systemFieldKey: key,
      };
    case SystemFieldKey.StartDate:
      return {
        type: FieldType.Date,
        name: '开始日期',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}start_date`,
        isSystemField: true,
        systemFieldKey: key,
      };
    case SystemFieldKey.DueDate:
      return {
        type: FieldType.Date,
        name: '截止日期',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}due_date`,
        isSystemField: true,
        systemFieldKey: key,
      };
    case SystemFieldKey.Remark:
      return {
        type: FieldType.LongText,
        name: '备注',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}remark`,
        isSystemField: true,
        systemFieldKey: key,
      };
    case SystemFieldKey.Iteration:
      return {
        type: FieldType.SingleSelect,
        name: '迭代',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}iteration`,
        isSystemField: true,
        systemFieldKey: key,
        configSource: { type: 'iteration', spaceId: ctx.spaceId } satisfies IConfigSource,
        options: { choices: [] },
      };
    case SystemFieldKey.Department:
      return {
        type: FieldType.SingleSelect,
        name: '部门',
        dbFieldName: `${SYSTEM_DB_FIELD_PREFIX}department`,
        isSystemField: true,
        systemFieldKey: key,
        configSource: { type: 'department', spaceId: ctx.spaceId } satisfies IConfigSource,
        options: { choices: [] },
      };
    case SystemFieldKey.BugLevel:
    case SystemFieldKey.Status:
    case SystemFieldKey.Priority:
      throw new Error(`SystemFieldKey "${key}" is not implemented in Phase 0`);
  }
}
