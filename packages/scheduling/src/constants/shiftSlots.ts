/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShiftSlotDefinition, ShiftSlotId, ShumeiAssignment } from "../types/shumei";

export const SHIFT_SLOTS: ShiftSlotDefinition[] = [
  {
    id: "slot_09_12",
    label: "09:00 ~ 12:00",
    periodName: "早班",
    start: "09:00",
    end: "12:00",
    totalHours: 3,
  },
  {
    id: "slot_12_15",
    label: "12:00 ~ 15:00",
    periodName: "午班",
    start: "12:00",
    end: "15:00",
    totalHours: 3,
  },
  {
    id: "slot_15_18",
    label: "15:00 ~ 18:00",
    periodName: "傍晚班",
    start: "15:00",
    end: "18:00",
    totalHours: 3,
  },
  {
    id: "slot_18_21",
    label: "18:00 ~ 21:00",
    periodName: "晚班",
    start: "18:00",
    end: "21:00",
    totalHours: 3,
  },
];

export interface QuickDurationPreset {
  id: string;
  label: string;
  hours: number;
  startTime: string;
  endTime: string;
}

/**
 * 依據時段產生快捷時長設定
 */
export function getQuickDurationPresets(slot: ShiftSlotDefinition): QuickDurationPreset[] {
  const [startHour, startMin] = slot.start.split(":").map(Number);
  const [endHour, endMin] = slot.end.split(":").map(Number);

  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // 計算中點 (1.5h)
  const midTotalMin = startHour * 60 + startMin + 90;
  const midHour = Math.floor(midTotalMin / 60);
  const midMin = midTotalMin % 60;
  const midTime = formatTime(midHour, midMin);

  // 1 小時
  const oneHourEnd = formatTime(startHour + 1, startMin);

  // 30 分鐘
  const halfHourTotalMin = startHour * 60 + startMin + 30;
  const halfHourEnd = formatTime(Math.floor(halfHourTotalMin / 60), halfHourTotalMin % 60);

  return [
    {
      id: "full",
      label: "整段 (3 小時)",
      hours: 3,
      startTime: slot.start,
      endTime: slot.end,
    },
    {
      id: "first_half",
      label: "前半段 (1.5 小時)",
      hours: 1.5,
      startTime: slot.start,
      endTime: midTime,
    },
    {
      id: "second_half",
      label: "後半段 (1.5 小時)",
      hours: 1.5,
      startTime: midTime,
      endTime: slot.end,
    },
    {
      id: "one_hour",
      label: "1 小時",
      hours: 1,
      startTime: slot.start,
      endTime: oneHourEnd,
    },
    {
      id: "half_hour",
      label: "30 分鐘",
      hours: 0.5,
      startTime: slot.start,
      endTime: halfHourEnd,
    },
  ];
}

/**
 * 格式化 Date 為 YYYY-MM-DD
 */
export function formatDateToYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface SlotCoverageResult {
  slot: ShiftSlotDefinition;
  assignments: ShumeiAssignment[];
  mainAssignments: ShumeiAssignment[];
  assistAssignments: ShumeiAssignment[];
  mainHours: number;
  assistHours: number;
  totalHours: number;
  hasMain: boolean;
  isFullyCovered: boolean;
}

/**
 * 計算指定日期與時段的排班覆蓋狀況
 */
export function calculateSlotCoverage(
  assignments: ShumeiAssignment[],
  slot: ShiftSlotDefinition,
  dateStr: string
): SlotCoverageResult {
  const slotAssignments = assignments.filter(
    (a) => a.date === dateStr && a.slotId === slot.id
  );

  const mainAssignments = slotAssignments.filter((a) => a.role === "main");
  const assistAssignments = slotAssignments.filter((a) => a.role === "assist");

  const mainHours = mainAssignments.reduce((sum, a) => sum + (a.durationHours || 3), 0);
  const assistHours = assistAssignments.reduce((sum, a) => sum + (a.durationHours || 1), 0);
  const totalHours = mainHours + assistHours;

  return {
    slot,
    assignments: slotAssignments,
    mainAssignments,
    assistAssignments,
    mainHours,
    assistHours,
    totalHours,
    hasMain: mainAssignments.length > 0,
    isFullyCovered: mainHours >= 3,
  };
}
