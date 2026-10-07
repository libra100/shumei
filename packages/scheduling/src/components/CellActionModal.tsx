/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Check,
  User,
  Tag as TagIcon,
  Layers,
  ChevronRight
} from "lucide-react";
import {
  ShumeiTag,
  ShumeiAssignment,
  ShiftSlotDefinition
} from "../types/shumei";
import { SHIFT_SLOTS } from "../constants/shiftSlots";

interface CellActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  dateStr: string;
  tagsList: ShumeiTag[];
  assignments: ShumeiAssignment[];
  onSaveTag: (staffId: string, dateStr: string, tagId: string, value?: number) => Promise<void>;
  onRemoveAssignment: (assignmentId: string) => Promise<void>;
  onToggleShift: (staffId: string, staffName: string, dateStr: string, slot: ShiftSlotDefinition) => Promise<void>;
  onOpenAddActivity: (staffId: string, dateStr: string) => void;
  readOnly?: boolean;
}

export default function CellActionModal({
  isOpen,
  onClose,
  staffId,
  staffName,
  dateStr,
  tagsList,
  assignments,
  onSaveTag,
  onRemoveAssignment,
  onToggleShift,
  onOpenAddActivity,
  readOnly = false,
}: CellActionModalProps) {
  if (!isOpen) return null;

  // Selected tag for custom count selection (e.g. 淨靈)
  const [activeCountTagId, setActiveCountTagId] = useState<string | null>(null);
  const [customCountValue, setCustomCountValue] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format date with day of week
  const formattedDate = useMemo(() => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const daysName = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日 (${daysName[d.getDay()]})`;
  }, [dateStr]);

  // Current assignments for this cell
  const currentCellAssignments = useMemo(() => {
    return assignments.filter((a) => a.staffId === staffId && a.date === dateStr);
  }, [assignments, staffId, dateStr]);

  // Filter into tags vs shifts
  const cellTags = useMemo(() => {
    return currentCellAssignments
      .filter((a) => a.tagId && !a.slotId)
      .map((a) => ({
        assignment: a,
        tag: tagsList.find((t) => t.id === a.tagId) || { id: a.tagId, name: "未知標籤", color: "#6366f1" },
      }));
  }, [currentCellAssignments, tagsList]);

  const cellShifts = useMemo(() => {
    return currentCellAssignments.filter((a) => a.slotId);
  }, [currentCellAssignments]);

  // Check which slots are assigned
  const isSlotAssigned = (slotId: string) => {
    return cellShifts.some((a) => a.slotId === slotId);
  };

  // Check which tags are assigned
  const getAssignedTag = (tagId: string) => {
    return cellTags.find((ct) => ct.tag.id === tagId);
  };

  const handleTagClick = async (tag: ShumeiTag) => {
    if (readOnly) return;
    
    const isCountTag = tag.name.includes("淨靈");
    const existing = getAssignedTag(tag.id);

    if (isCountTag) {
      setActiveCountTagId(activeCountTagId === tag.id ? null : tag.id);
      setCustomCountValue(existing?.assignment.value || 1);
      return;
    }

    try {
      setIsSubmitting(true);
      if (existing) {
        // Toggle off if already assigned
        await onRemoveAssignment(existing.assignment.id);
      } else {
        await onSaveTag(staffId, dateStr, tag.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCountTag = async (tagId: string, count: number) => {
    if (readOnly) return;
    try {
      setIsSubmitting(true);
      await onSaveTag(staffId, dateStr, tagId, count);
      setActiveCountTagId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShiftClick = async (slot: ShiftSlotDefinition) => {
    if (readOnly) return;
    try {
      setIsSubmitting(true);
      await onToggleShift(staffId, staffName, dateStr, slot);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-500/20 shrink-0">
              {staffId === "global" ? <Layers className="w-5 h-5" /> : staffName.charAt(0) || <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{staffName}</span>
                {staffId === "global" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-normal">
                    全域共用
                  </span>
                )}
              </h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedDate}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          {/* Section 1: 已安排項目 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                已指派項目 ({cellTags.length + cellShifts.length})
              </span>
            </div>

            {cellTags.length === 0 && cellShifts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                <p className="text-xs text-slate-400">目前尚無安排，請由下方點選標籤或時段加入</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cellTags.map(({ assignment, tag }) => (
                  <div
                    key={assignment.id}
                    style={{ backgroundColor: tag.color }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm"
                  >
                    <span>{tag.name}</span>
                    {assignment.value && assignment.value > 1 && (
                      <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">
                        x{assignment.value}
                      </span>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => onRemoveAssignment(assignment.id)}
                        className="ml-1 p-0.5 rounded-full hover:bg-black/30 transition-colors cursor-pointer"
                        title="移除此標籤"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {cellShifts.map((shift) => {
                  const slotDef = SHIFT_SLOTS.find((s) => s.id === shift.slotId);
                  return (
                    <div
                      key={shift.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-sm"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{slotDef?.periodName || "值班"} ({shift.startTime || slotDef?.start}~{shift.endTime || slotDef?.end})</span>
                      {!readOnly && (
                        <button
                          onClick={() => onRemoveAssignment(shift.id)}
                          className="ml-1 p-0.5 rounded-full hover:bg-black/30 transition-colors cursor-pointer"
                          title="取消此值班"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: 標籤快速指派 (符合手機 44px 觸控習慣) */}
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
              點擊指派標籤（單手快速排定）
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {tagsList.map((tag) => {
                const assigned = getAssignedTag(tag.id);
                const isCountTag = tag.name.includes("淨靈");
                const isSelectingCount = activeCountTagId === tag.id;

                return (
                  <div key={tag.id} className="relative">
                    <button
                      onClick={() => handleTagClick(tag)}
                      disabled={isSubmitting || readOnly}
                      style={{
                        borderColor: tag.color,
                        ...(assigned ? { backgroundColor: tag.color, color: "#fff" } : {})
                      }}
                      className={`w-full min-h-[46px] px-3 py-2 rounded-xl border-2 flex items-center justify-between font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm ${
                        assigned
                          ? "shadow-md brightness-105"
                          : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="truncate">{tag.name}</span>
                      {assigned ? (
                        <span className="flex items-center gap-1 shrink-0">
                          {assigned.assignment.value && assigned.assignment.value > 1 && (
                            <span className="bg-black/25 px-1.5 py-0.5 rounded text-[10px]">
                              x{assigned.assignment.value}
                            </span>
                          )}
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                    </button>

                    {/* Inline Quick Counter for 淨靈相關標籤 */}
                    {isCountTag && isSelectingCount && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 z-30 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-indigo-500/30 shadow-xl animate-scale-in">
                        <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center justify-between">
                          <span>選擇淨靈次數</span>
                          <button
                            onClick={() => setActiveCountTagId(null)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 mb-2">
                          {[1, 2, 3, 5].map((cnt) => (
                            <button
                              key={cnt}
                              onClick={() => handleSaveCountTag(tag.id, cnt)}
                              className={`py-1 rounded-lg text-xs font-bold border transition-all active:scale-90 ${
                                customCountValue === cnt
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                              }`}
                            >
                              {cnt}次
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={customCountValue}
                            onChange={(e) => setCustomCountValue(parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-2 py-1 text-center text-xs font-bold rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleSaveCountTag(tag.id, customCountValue)}
                            className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            確定指派
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: 四時段值班快捷 (僅限一般人員，全域行不顯示值班) */}
          {staffId !== "global" && (
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                四時段值班排定（點擊切換當日排班）
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SHIFT_SLOTS.map((slot) => {
                  const assigned = isSlotAssigned(slot.id);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => handleShiftClick(slot)}
                      disabled={isSubmitting || readOnly}
                      className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-left transition-all active:scale-98 cursor-pointer ${
                        assigned
                          ? "bg-amber-500/15 dark:bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-200 shadow-sm"
                          : "bg-white dark:bg-slate-800/80 border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{slot.periodName}</span>
                          <span className="text-[11px] opacity-75 font-mono">
                            {slot.start} ~ {slot.end}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {assigned ? "✅ 該員已排入此時段" : "點擊立即排班"}
                        </p>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          assigned
                            ? "bg-amber-500 text-white shadow-sm"
                            : "border border-slate-300 dark:border-slate-600 text-transparent"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: 跨日活動或自訂行程快捷 */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5">
            <button
              onClick={() => {
                onClose();
                onOpenAddActivity(staffId, dateStr);
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>建立跨日活動或長區間行程...</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />
            </button>
          </div>

        </div>

        {/* Bottom Done Button */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>完成</span>
          </button>
        </div>

      </div>
    </div>
  );
}
