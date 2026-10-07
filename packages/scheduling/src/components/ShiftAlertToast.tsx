/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, X, ArrowRight, Bell } from "lucide-react";
import { ShiftSlotDefinition, ShumeiAssignment } from "../types/shumei";
import {
  SHIFT_SLOTS,
  calculateSlotCoverage,
  formatDateToYYYYMMDD,
} from "../constants/shiftSlots";

interface ShiftAlertToastProps {
  assignments: ShumeiAssignment[];
  excludedDates?: string[];
  dateStr?: string;
  onOpenShiftModal: (slot: ShiftSlotDefinition, dateStr: string) => void;
}

export default function ShiftAlertToast({
  assignments,
  excludedDates = [],
  dateStr = formatDateToYYYYMMDD(new Date()),
  onOpenShiftModal,
}: ShiftAlertToastProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if today is marked as excluded (no shift)
  const isExcluded = excludedDates.includes(dateStr);

  // Find slots missing a main person today
  const missingSlots = useMemo(() => {
    if (isExcluded) return [];
    return SHIFT_SLOTS.filter((slot) => {
      const coverage = calculateSlotCoverage(assignments, slot, dateStr);
      return !coverage.hasMain;
    });
  }, [assignments, excludedDates, dateStr, isExcluded]);

  // Reset dismissal if missing slots change or date changes
  useEffect(() => {
    setIsDismissed(false);
  }, [dateStr]);

  if (isDismissed || missingSlots.length === 0) return null;

  const content = (
    <div className="fixed bottom-6 right-4 sm:right-6 z-[9999] max-w-md w-[calc(100vw-2rem)] sm:w-96 animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-slate-100 flex items-start gap-3 relative ring-1 ring-black/50">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
          <Bell className="w-4 h-4 animate-bounce" />
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>今日值班排程未完成提醒</span>
          </div>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            今日尚有 <strong className="text-white">{missingSlots.length}</strong> 個時段尚未排定主班人員：
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            {missingSlots.map((s) => (
              <span
                key={s.id}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25"
              >
                {s.periodName} ({s.start})
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenShiftModal(missingSlots[0], dateStr)}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <span>立即排班 ({missingSlots[0].periodName})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
          title="關閉通知"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
