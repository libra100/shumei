/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import {
  Calendar,
  Clock,
  Crown,
  Users,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Coffee,
  Sparkles,
} from "lucide-react";
import { ShiftSlotDefinition, ShumeiAssignment, ShumeiStaff } from "../types/shumei";
import {
  SHIFT_SLOTS,
  calculateSlotCoverage,
  formatDateToYYYYMMDD,
} from "../constants/shiftSlots";

interface TodayShiftBoardProps {
  dateStr?: string;
  assignments: ShumeiAssignment[];
  staffList: ShumeiStaff[];
  excludedDates?: string[];
  onOpenShiftModal: (slot: ShiftSlotDefinition, dateStr: string) => void;
  onOpenExcludedDatesModal: () => void;
}

export default function TodayShiftBoard({
  dateStr = formatDateToYYYYMMDD(new Date()),
  assignments,
  staffList,
  excludedDates = [],
  onOpenShiftModal,
  onOpenExcludedDatesModal,
}: TodayShiftBoardProps) {
  // Check if today is marked as excluded (no shift needed)
  const isExcludedDay = excludedDates.includes(dateStr);

  const getStaffName = (id: string) => {
    const s = staffList.find((st) => st.id === id);
    return s ? s.name : "未知人員";
  };

  // Calculate coverage for each slot
  const slotCoverages = useMemo(() => {
    return SHIFT_SLOTS.map((slot) => {
      return calculateSlotCoverage(assignments, slot, dateStr);
    });
  }, [assignments, dateStr]);

  // Overall stats for today
  const totalSlots = SHIFT_SLOTS.length;
  const coveredSlotsCount = slotCoverages.filter((c) => c.hasMain && c.isFullyCovered).length;
  const missingMainSlots = slotCoverages.filter((c) => !c.hasMain);

  // Formatted date string with weekday
  const formattedHeaderDate = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const w = weekdays[dateObj.getDay()];
    return `${y} 年 ${m} 月 ${d} 日 (星期${w})`;
  }, [dateStr]);

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm backdrop-blur-xl mb-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                今日值班時段看板
              </h2>
              {isExcludedDay ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  免排班日
                </span>
              ) : missingMainSlots.length === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 全時段完成
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 尚有 {missingMainSlots.length} 時段缺主班
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              📅 {formattedHeaderDate}
            </p>
          </div>
        </div>

        {/* Action button: Excluded dates */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={onOpenExcludedDatesModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5 transition-all cursor-pointer"
            title="設定每月不用排班之特定日期"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>設定免排班日</span>
          </button>
        </div>
      </div>

      {/* If today is an excluded day */}
      {isExcludedDay && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/20 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-rose-500" />
            <span>今天已被設定為<strong>免排班日</strong>（例休/休館日），預設無需安排值班人員。</span>
          </div>
          <span className="text-[11px] opacity-75 hidden sm:inline">仍可點擊下方卡片彈性指派</span>
        </div>
      )}

      {/* 4 Time Slot Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {slotCoverages.map(({ slot, assignments, mainAssignments, assistAssignments, mainHours, assistHours, totalHours, hasMain, isFullyCovered }) => {
          return (
            <div
              key={slot.id}
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                hasMain && isFullyCovered
                  ? "bg-slate-50/70 dark:bg-slate-800/50 border-emerald-500/30"
                  : hasMain
                  ? "bg-slate-50/70 dark:bg-slate-800/50 border-amber-500/30"
                  : "bg-rose-50/30 dark:bg-rose-950/10 border-rose-500/20"
              }`}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {slot.periodName}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {slot.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {totalHours}/3h
                  </span>
                </div>

                {/* Progress Bar for slot coverage */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      mainHours >= 3
                        ? "bg-emerald-500"
                        : hasMain
                        ? "bg-amber-500"
                        : "bg-rose-400"
                    }`}
                    style={{ width: `${Math.min(100, (totalHours / 3) * 100)}%` }}
                  />
                </div>

                {/* Main Staff Section */}
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-500" />
                    主班 (Main)
                  </div>
                  {mainAssignments.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {mainAssignments.map((a) => (
                        <span
                          key={a.id}
                          className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500 text-white shadow-xs flex items-center gap-1"
                        >
                          <Crown className="w-2.5 h-2.5" />
                          {getStaffName(a.staffId)}
                          <span className="text-[10px] font-normal opacity-85">
                            ({a.durationHours || 3}h)
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                      ⚠️ 缺主班
                    </span>
                  )}
                </div>

                {/* Assistant Staff Section */}
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    副班 (Assist)
                  </div>
                  {assistAssignments.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {assistAssignments.map((a) => (
                        <span
                          key={a.id}
                          className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40"
                        >
                          {getStaffName(a.staffId)} ({a.durationHours || 1}h)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      無副班
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer: Quick action */}
              <button
                type="button"
                onClick={() => onOpenShiftModal(slot, dateStr)}
                className="mt-2 w-full py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10 flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                排班 / 調整
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
