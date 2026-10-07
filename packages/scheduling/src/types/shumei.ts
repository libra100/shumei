/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ShumeiStaff {
  id: string;
  name: string;
  role?: string;
  color?: string;
  leader?: string;
}

export interface ShumeiTag {
  id: string;
  name: string;
  color: string;
}

export type ShiftSlotId = 'slot_09_12' | 'slot_12_15' | 'slot_15_18' | 'slot_18_21';

export interface ShiftSlotDefinition {
  id: ShiftSlotId;
  label: string;       // "09:00 ~ 12:00"
  periodName: string;  // "早班"
  start: string;       // "09:00"
  end: string;         // "12:00"
  totalHours: number;  // 3
}

export interface ShumeiAssignment {
  id: string;
  staffId: string;
  tagId?: string;
  date: string; // YYYY-MM-DD
  value?: number; // Used for "number of people" for Johrei tags

  // 時段排班欄位
  slotId?: ShiftSlotId;
  role?: 'main' | 'assist';
  startTime?: string;      // e.g. "09:00"
  endTime?: string;        // e.g. "12:00"
  durationHours?: number;  // e.g. 0.5, 1, 1.5, 3
}

export interface ShumeiActivity {
  id: string;
  staffId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  color: string;
}

export interface ShumeiProjectData {
  id: string;
  name: string;
  description?: string;
  shumeiStaff?: ShumeiStaff[];
  shumeiTags?: ShumeiTag[];
  shumeiAssignments?: ShumeiAssignment[];
  shumeiActivities?: ShumeiActivity[];
  workingDays?: number[];
  holidays?: string[];
  excludedDates?: string[]; // YYYY-MM-DD 免排班日期清單
  [key: string]: any;
}
