/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { X, Calendar, Check, ChevronLeft, ChevronRight, Ban, RotateCcw } from "lucide-react";
import { formatDateToYYYYMMDD } from "../constants/shiftSlots";

interface ExcludedDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  excludedDates: string[];
  onSaveExcludedDates: (dates: string[]) => void;
}

export default function ExcludedDatesModal({
  isOpen,
  onClose,
  excludedDates,
  onSaveExcludedDates,
}: ExcludedDatesModalProps) {
  if (!isOpen) return null;

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [localExcluded, setLocalExcluded] = useState<string[]>(excludedDates || []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate days in month
  const daysInMonth = useMemo(() => {
    const days: Date[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [year, month]);

  // First day offset (0 = Sunday, 1 = Monday...)
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const toggleDate = (dateStr: string) => {
    setLocalExcluded((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSave = () => {
    onSaveExcludedDates(localExcluded);
    onClose();
  };

  const handleClearMonth = () => {
    const monthDateStrings = daysInMonth.map((d) => formatDateToYYYYMMDD(d));
    setLocalExcluded((prev) => prev.filter((d) => !monthDateStrings.includes(d)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                設定免排班日期（休館/無值班）
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                點擊日期切換是否需排班，其餘日期預設皆需排班
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="p-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
            {year} 年 {month + 1} 月
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map((w, idx) => (
              <span
                key={w}
                className={`text-[10px] font-bold ${
                  idx === 0 || idx === 6 ? "text-rose-500" : "text-slate-400"
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty_${idx}`} className="h-9" />
            ))}

            {/* Days */}
            {daysInMonth.map((day) => {
              const dateStr = formatDateToYYYYMMDD(day);
              const isExcluded = localExcluded.includes(dateStr);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => toggleDate(dateStr)}
                  className={`h-9 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-bold cursor-pointer ${
                    isExcluded
                      ? "bg-rose-500 text-white shadow-xs"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {isExcluded && (
                    <span className="text-[9px] font-extrabold -mt-1 scale-90">
                      休
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClearMonth}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            清除本月設定
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
