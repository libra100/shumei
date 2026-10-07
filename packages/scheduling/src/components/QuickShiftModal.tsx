/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { X, Clock, Trash2, Check, User, Sparkles, Crown, Users } from "lucide-react";
import { ShiftSlotDefinition, ShumeiAssignment, ShumeiStaff } from "../types/shumei";
import { getQuickDurationPresets, QuickDurationPreset } from "../constants/shiftSlots";

interface QuickShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: ShiftSlotDefinition | null;
  dateStr: string;
  staffList: ShumeiStaff[];
  assignments: ShumeiAssignment[];
  onSaveAssignment: (assignment: ShumeiAssignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}

export default function QuickShiftModal({
  isOpen,
  onClose,
  slot,
  dateStr,
  staffList,
  assignments,
  onSaveAssignment,
  onDeleteAssignment,
}: QuickShiftModalProps) {
  if (!isOpen || !slot) return null;

  const presets = useMemo(() => getQuickDurationPresets(slot), [slot]);

  // Form state
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"main" | "assist">("main");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("full");
  const [startTime, setStartTime] = useState<string>(slot.start);
  const [endTime, setEndTime] = useState<string>(slot.end);
  const [durationHours, setDurationHours] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Existing assignments for this slot & date
  const slotAssignments = useMemo(() => {
    return assignments.filter((a) => a.date === dateStr && a.slotId === slot.id);
  }, [assignments, dateStr, slot.id]);

  // Filter staff list
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    const q = searchQuery.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.role && s.role.toLowerCase().includes(q))
    );
  }, [staffList, searchQuery]);

  const handleApplyPreset = (preset: QuickDurationPreset) => {
    setSelectedPresetId(preset.id);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setDurationHours(preset.hours);
  };

  const handleCustomTimeChange = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
    // 計算時數
    const [sH, sM] = start.split(":").map(Number);
    const [eH, eM] = end.split(":").map(Number);
    const totalMinutes = eH * 60 + eM - (sH * 60 + sM);
    if (totalMinutes > 0) {
      setDurationHours(Number((totalMinutes / 60).toFixed(1)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert("請先選擇排班人員！");
      return;
    }

    const newAssignment: ShumeiAssignment = {
      id: `shift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      staffId: selectedStaffId,
      date: dateStr,
      slotId: slot.id,
      role: selectedRole,
      startTime,
      endTime,
      durationHours,
    };

    onSaveAssignment(newAssignment);
    // 重設人員選擇，方便連續排入副班
    setSelectedStaffId("");
  };

  const getStaffName = (id: string) => {
    const s = staffList.find((st) => st.id === id);
    return s ? s.name : "未知人員";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {slot.periodName}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {slot.label} 排班設定
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              📅 日期：{dateStr}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 已排人員列表 */}
          {slotAssignments.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                已排班人員 ({slotAssignments.length})
              </label>
              <div className="space-y-2">
                {slotAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-black/5 dark:border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          a.role === "main"
                            ? "bg-amber-500 text-white shadow-xs shadow-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {a.role === "main" ? <Crown className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {getStaffName(a.staffId)}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              a.role === "main"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            }`}
                          >
                            {a.role === "main" ? "主班" : "副班"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {a.startTime || slot.start} ~ {a.endTime || slot.end} (
                            {a.durationHours || 3} 小時)
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteAssignment(a.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="移除此排班"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 新增排班表單 */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-black/5 dark:border-white/5">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              新增此時段排班
            </h4>

            {/* 1. 選擇身分（主班 / 副班） */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                值勤身分
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole("main")}
                  className={`p-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border transition-all cursor-pointer ${
                    selectedRole === "main"
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100"
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  👑 主班 (Main)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("assist")}
                  className={`p-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border transition-all cursor-pointer ${
                    selectedRole === "assist"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  🤝 副班 (Assist)
                </button>
              </div>
            </div>

            {/* 2. 快捷時長按鈕 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                快捷時長分配
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {presets.map((p) => {
                  const isSelected = selectedPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-black/5 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        {p.startTime}~{p.endTime}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 起訖自訂時間 */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleCustomTimeChange(e.target.value, endTime)}
                  className="w-full bg-white dark:bg-slate-900 border border-black/10 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  結束時間 (時數: {durationHours}h)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleCustomTimeChange(startTime, e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-black/10 dark:border-white/15 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 4. 選擇人員 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-500">
                  選擇值班人員
                </label>
                <input
                  type="text"
                  placeholder="搜尋姓名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 border border-black/10 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 w-32"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-black/5 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                {filteredStaff.map((s) => {
                  const isSelected = selectedStaffId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStaffId(s.id)}
                      className={`p-2 rounded-lg text-left text-xs font-bold border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. 提交按鈕 */}
            <button
              type="submit"
              disabled={!selectedStaffId}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              確認加入此時段排班
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
