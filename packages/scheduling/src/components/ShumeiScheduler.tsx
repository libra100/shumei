/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ShumeiProjectData as Project, ShumeiStaff, ShumeiTag, ShumeiAssignment, ShumeiActivity, ShiftSlotDefinition } from "../types/shumei";
import TodayShiftBoard from "./TodayShiftBoard";
import QuickShiftModal from "./QuickShiftModal";
import ExcludedDatesModal from "./ExcludedDatesModal";
import ShiftAlertToast from "./ShiftAlertToast";
import CellActionModal from "./CellActionModal";
import { SHIFT_SLOTS, formatDateToYYYYMMDD } from "../constants/shiftSlots";
import {
  UserPlus,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  PlusCircle,
  Calendar,
  Check,
  Tag,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Globe,
} from "lucide-react";

interface ShumeiSchedulerProps {
  onUpdateProject: (partial: Partial<Project>) => Promise<void>;
  currentUserId: string;
  readOnly?: boolean;
}

export const DEFAULT_TAGS: ShumeiTag[] = [
  { id: "tag_worship", name: "參拜", color: "#3b82f6" }, // blue
  { id: "tag_study", name: "上秀勉", color: "#10b981" }, // emerald
  { id: "tag_bag", name: "換神光袋", color: "#f59e0b" }, // amber
  { id: "tag_johrei", name: "做淨靈", color: "#8b5cf6" }, // purple
  { id: "tag_nonbeliever", name: "未信徒淨靈", color: "#ec4899" }, // pink
];

const DEFAULT_STAFF: ShumeiStaff[] = [
  { id: "staff_1", name: "愛麗絲", role: "前端工程師" },
  { id: "staff_2", name: "鮑伯", role: "後端工程師" },
  { id: "staff_3", name: "查理", role: "UI 設計師" },
  { id: "staff_4", name: "大衛", role: "專案經理" },
];

export default function ShumeiScheduler({ project, onUpdateProject, currentUserId, readOnly }: ShumeiSchedulerProps) {
  // Use project data or fall back to defaults
  const staffList = useMemo(() => project.shumeiStaff || DEFAULT_STAFF, [project.shumeiStaff]);
  const tagsList = useMemo(() => project.shumeiTags || DEFAULT_TAGS, [project.shumeiTags]);
  const [localAssignments, setLocalAssignments] = useState<ShumeiAssignment[]>([]);
  useEffect(() => {
    setLocalAssignments(project.shumeiAssignments || []);
  }, [project.shumeiAssignments]);

  const assignments = localAssignments;
  const activities = useMemo(() => project.shumeiActivities || [], [project.shumeiActivities]);

  // Date and View State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // Paint Mode state for mobile (tap tag, then tap cell)
  const [selectedPaintTagId, setSelectedPaintTagId] = useState<string | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Selected date for bottom status panel (defaults to today or first day of month)
  const [selectedStatusDate, setSelectedStatusDate] = useState(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    return todayStr;
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");

  // Modals & Popups State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ShumeiStaff | null>(null);
  const [showAddActivityModal, setShowAddActivityModal] = useState<string | null>(null); // staffId
  const [editingActivity, setEditingActivity] = useState<ShumeiActivity | null>(null);
  const [showTagConfigModal, setShowTagConfigModal] = useState(false);

  // Shift modal state
  const [activeShiftModalSlot, setActiveShiftModalSlot] = useState<ShiftSlotDefinition | null>(null);
  const [activeShiftModalDate, setActiveShiftModalDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
  const [showExcludedDatesModal, setShowExcludedDatesModal] = useState(false);

  // Cell Action modal state (touch / mobile-friendly cell actions)
  const [selectedCellModal, setSelectedCellModal] = useState<{
    staffId: string;
    staffName: string;
    dateStr: string;
  } | null>(null);

  const handleOpenShiftModal = (slot: ShiftSlotDefinition, dateStr: string) => {
    setActiveShiftModalSlot(slot);
    setActiveShiftModalDate(dateStr);
  };

  const handleSaveShiftAssignment = async (newAssign: ShumeiAssignment) => {
    const updated = [...assignments, newAssign];
    setLocalAssignments(updated);
    await syncToFirebase({ shumeiAssignments: updated });
  };

  const handleDeleteShiftAssignment = async (assignId: string) => {
    const updated = assignments.filter((a) => a.id !== assignId);
    setLocalAssignments(updated);
    await syncToFirebase({ shumeiAssignments: updated });
  };

  const handleToggleShiftFromCell = async (
    staffId: string,
    staffName: string,
    dateStr: string,
    slot: ShiftSlotDefinition
  ) => {
    const existing = assignments.find(
      (a) => a.staffId === staffId && a.date === dateStr && a.slotId === slot.id
    );
    if (existing) {
      await handleDeleteShiftAssignment(existing.id);
    } else {
      const newAssign: ShumeiAssignment = {
        id: `shift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        staffId,
        date: dateStr,
        slotId: slot.id,
        role: "main",
        startTime: slot.start,
        endTime: slot.end,
        durationHours: slot.totalHours || 3,
      };
      await handleSaveShiftAssignment(newAssign);
    }
  };

  const handleOpenAddActivityFromCell = (staffId: string, dateStr: string) => {
    setShowAddActivityModal(staffId);
    setTimeout(() => {
      if (activityStartRef.current) activityStartRef.current.value = dateStr;
      if (activityEndRef.current) activityEndRef.current.value = dateStr;
    }, 50);
  };

  const handleSaveExcludedDates = async (dates: string[]) => {
    await syncToFirebase({ excludedDates: dates });
  };

  // Scroll Sync Refs
  const leftListRef = useRef<HTMLDivElement>(null);
  const rightGridRef = useRef<HTMLDivElement>(null);
  const isSyncingLeftScroll = useRef(false);
  const isSyncingRightScroll = useRef(false);

  const handleLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingLeftScroll.current) {
      isSyncingLeftScroll.current = false;
      return;
    }
    if (rightGridRef.current) {
      isSyncingRightScroll.current = true;
      rightGridRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRightScroll.current) {
      isSyncingRightScroll.current = false;
      return;
    }
    if (leftListRef.current) {
      isSyncingLeftScroll.current = true;
      leftListRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // 1. Subscribe to member, staff, assignments, activities
  // Tag Drop dialog state
  const [pendingTagDrop, setPendingTagDrop] = useState<{staffId: string, dateStr: string, tagId: string, tagName: string} | null>(null);
  const tagValueRef = useRef<HTMLInputElement>(null);
  
  // Form input refs/states
  const staffNameRef = useRef<HTMLInputElement>(null);
  const staffRoleRef = useRef<HTMLInputElement>(null);
  const activityTitleRef = useRef<HTMLInputElement>(null);
  const activityStartRef = useRef<HTMLInputElement>(null);
  const activityEndRef = useRef<HTMLInputElement>(null);
  const [activityColor, setActivityColor] = useState("#6366f1");

  // Tag manager form states
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#8b5cf6");

  // Generate days in the current month
  const days = useMemo(() => {
    const date = new Date(year, month, 1);
    const result: Date[] = [];
    while (date.getMonth() === month) {
      result.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return result;
  }, [year, month]);

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getDayName = (d: Date) => {
    const daysName = ["日", "一", "二", "三", "四", "五", "六"];
    return daysName[d.getDay()];
  };

  // Check if a day is weekend
  const isWeekend = (d: Date) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  // Helper to horizontally center "today" in the scrollable timeline grid
  const scrollToToday = (smooth = true) => {
    const today = new Date();
    const todayIndex = days.findIndex((d) => d.toDateString() === today.toDateString());
    if (todayIndex !== -1 && rightGridRef.current) {
      const colWidth = 80;
      const containerWidth = rightGridRef.current.clientWidth || 360;
      const targetLeft = Math.max(0, todayIndex * colWidth - (containerWidth / 2) + (colWidth / 2));
      rightGridRef.current.scrollTo({
        left: targetLeft,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  // Navigations
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    const todayStr = formatDateStr(now);
    setSelectedStatusDate(todayStr);

    if (year !== now.getFullYear() || month !== now.getMonth()) {
      setCurrentDate(now);
    } else {
      scrollToToday(true);
    }
  };

  // Auto-scroll to today if currently viewing today's month
  useEffect(() => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) {
      const timer = setTimeout(() => {
        scrollToToday(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [year, month, days]);

  // --- Database Sync Helpers ---
  const syncToFirebase = async (updates: Partial<Project>) => {
    try {
      await onUpdateProject(updates);
    } catch (err) {
      console.error("Failed to sync Shumei scheduling data:", err);
    }
  };

  // Staff operations
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = staffNameRef.current?.value.trim();
    const role = staffRoleRef.current?.value.trim() || "";
    if (!name) return;

    const newStaff: ShumeiStaff = {
      id: `staff_${Date.now()}`,
      name,
      role,
    };

    const newRoster = [...staffList, newStaff];
    await syncToFirebase({ shumeiStaff: newRoster });
    setShowAddStaffModal(false);
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editingStaff.name.trim()) return;

    const updated = staffList.map((s) => (s.id === editingStaff.id ? editingStaff : s));
    await syncToFirebase({ shumeiStaff: updated });
    setEditingStaff(null);
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!window.confirm("確定要刪除此人員嗎？這會同時移除他們的所有安排與活動！")) return;
    const updatedStaff = staffList.filter((s) => s.id !== staffId);
    const updatedAssignments = assignments.filter((a) => a.staffId !== staffId);
    const updatedActivities = activities.filter((a) => a.staffId !== staffId);

    await syncToFirebase({
      shumeiStaff: updatedStaff,
      shumeiAssignments: updatedAssignments,
      shumeiActivities: updatedActivities,
    });
  };

  // Tag Template operations
  const handleAddTagTemplate = async () => {
    if (!newTagName.trim()) return;
    const newTag: ShumeiTag = {
      id: `tag_${Date.now()}`,
      name: newTagName.trim(),
      color: newTagColor,
    };
    await syncToFirebase({ shumeiTags: [...tagsList, newTag] });
    setNewTagName("");
  };

  const handleDeleteTagTemplate = async (tagId: string) => {
    if (tagsList.length <= 1) {
      alert("請至少保留一個標籤！");
      return;
    }
    const updatedTags = tagsList.filter((t) => t.id !== tagId);
    const updatedAssignments = assignments.filter((a) => a.tagId !== tagId);

    await syncToFirebase({
      shumeiTags: updatedTags,
      shumeiAssignments: updatedAssignments,
    });
  };

  // Assignment Drag & Drop operations
  const handleDropTag = async (staffId: string, dateStr: string, tagId: string) => {
    const tag = tagsList.find((t) => t.id === tagId);
    if (!tag) return;
    
    if (tag.name === "做淨靈" || tag.name === "未信徒淨靈") {
      setPendingTagDrop({ staffId, dateStr, tagId, tagName: tag.name });
      return;
    }
    
    await saveTagAssignment(staffId, dateStr, tagId);
  };

  const saveTagAssignment = async (staffId: string, dateStr: string, tagId: string, value?: number) => {
    // Check if THIS SPECIFIC tag already assigned on this day for this staff. If so, overwrite it, but KEEP other tags.
    const filtered = assignments.filter((a) => !(a.staffId === staffId && a.date === dateStr && a.tagId === tagId));
    const newAssign: ShumeiAssignment = {
      id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      staffId,
      tagId,
      date: dateStr,
      ...(value !== undefined && { value }),
    };
    
    const newAssignments = [...filtered, newAssign];
    setLocalAssignments(newAssignments); // Optimistic update
    
    await syncToFirebase({
      shumeiAssignments: newAssignments,
    });
  };

  const confirmPendingTagDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTagDrop) return;
    const value = parseInt(tagValueRef.current?.value || "1", 10) || 1;
    await saveTagAssignment(pendingTagDrop.staffId, pendingTagDrop.dateStr, pendingTagDrop.tagId, value);
    setPendingTagDrop(null);
  };

  const handleRemoveAssignment = async (assignId: string) => {
    const updated = assignments.filter((a) => a.id !== assignId);
    setLocalAssignments(updated); // Optimistic update
    await syncToFirebase({ shumeiAssignments: updated });
  };

  // Activity operations
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = activityTitleRef.current?.value.trim();
    const startDate = activityStartRef.current?.value;
    const endDate = activityEndRef.current?.value;
    const staffId = showAddActivityModal;

    if (!title || !startDate || !endDate || !staffId) return;
    if (new Date(startDate) > new Date(endDate)) {
      alert("結束日期不能早於開始日期！");
      return;
    }

    const newAct: ShumeiActivity = {
      id: `act_${Date.now()}`,
      staffId,
      title,
      startDate,
      endDate,
      color: activityColor,
    };

    await syncToFirebase({
      shumeiActivities: [...activities, newAct],
    });
    setShowAddActivityModal(null);
  };

  const handleSaveEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !editingActivity.title.trim()) return;
    if (new Date(editingActivity.startDate) > new Date(editingActivity.endDate)) {
      alert("結束日期不能早於開始日期！");
      return;
    }

    const updated = activities.map((a) => (a.id === editingActivity.id ? editingActivity : a));
    await syncToFirebase({ shumeiActivities: updated });
    setEditingActivity(null);
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!window.confirm("確定要刪除此區間活動嗎？")) return;
    const updated = activities.filter((a) => a.id !== actId);
    await syncToFirebase({ shumeiActivities: updated });
    setEditingActivity(null);
  };

  // Find assignments and activities for a cell
  const getCellData = (staffId: string, dateStr: string) => {
    const cellAssignments = assignments.filter((a) => a.staffId === staffId && a.date === dateStr);
    return cellAssignments.map(assignment => ({
      assignment,
      tag: tagsList.find((t) => t.id === assignment.tagId) || null
    })).filter(d => d.tag);
  };

  const getRowHeight = (staffId: string) => {
    const staffAssignments = assignments.filter((a) => a.staffId === staffId);
    const tagCounts: Record<string, number> = {};
    staffAssignments.forEach((a) => {
      tagCounts[a.date] = (tagCounts[a.date] || 0) + 1;
    });
    const counts = Object.values(tagCounts);
    const maxTags = counts.length > 0 ? Math.max(...counts) : 1;
    return Math.max(56, maxTags * 52 + 4); // 56px default.
  };

  // Calculate layout of activities on a specific staff row for visual display
  const getStaffActivitiesInView = (staffId: string) => {
    return activities.filter((a) => {
      if (a.staffId !== staffId) return false;
      // Overlaps with current month
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      return start <= monthEnd && end >= monthStart;
    });
  };

  // Calculate position coordinates (pixels) for a multi-day activity bar
  const calculateActivityStyle = (activity: ShumeiActivity) => {
    const cellWidth = 80; // px
    const startOfCurrentMonth = new Date(year, month, 1);
    const endOfCurrentMonth = new Date(year, month + 1, 0);

    const actStart = new Date(activity.startDate);
    const actEnd = new Date(activity.endDate);

    // Clamp values to current month view boundary
    const displayStart = actStart < startOfCurrentMonth ? startOfCurrentMonth : actStart;
    const displayEnd = actEnd > endOfCurrentMonth ? endOfCurrentMonth : actEnd;

    // Calculate columns
    const startIdx = days.findIndex((d) => d.getDate() === displayStart.getDate());
    const endIdx = days.findIndex((d) => d.getDate() === displayEnd.getDate());

    if (startIdx === -1 || endIdx === -1) return { display: "none" };

    const left = startIdx * cellWidth + 4; // 4px padding
    const width = (endIdx - startIdx + 1) * cellWidth - 8; // 8px padding total

    return {
      left: `${left}px`,
      width: `${width}px`,
      backgroundColor: activity.color,
    };
  };



  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent text-slate-800 dark:text-slate-200">
      
      {/* 0. 登入/今日未排班警示 Toast */}
      <ShiftAlertToast
        assignments={assignments}
        excludedDates={project.excludedDates || []}
        onOpenShiftModal={handleOpenShiftModal}
      />

      {/* 0. 今日四時段排班狀況看板 */}
      <TodayShiftBoard
        assignments={assignments}
        staffList={staffList}
        excludedDates={project.excludedDates || []}
        onOpenShiftModal={handleOpenShiftModal}
        onOpenExcludedDatesModal={() => setShowExcludedDatesModal(true)}
      />

      {/* 1. Main Control Panel & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-t-2xl z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold font-display tracking-wide flex items-center gap-2">
            <span>{year} 年 {month + 1} 月</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-sans font-normal">
              月排程視圖
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Actions */}
          
          {/* Mobile Tag Paint Selector (only visible on small screens) */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-[60vw]">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">點擊標籤再點格子：</span>
            {tagsList.map(tag => (
              <button
                key={tag.id}
                onClick={() => setSelectedPaintTagId(prev => prev === tag.id ? null : tag.id)}
                style={{ backgroundColor: selectedPaintTagId === tag.id ? tag.color : 'transparent', borderColor: tag.color, color: selectedPaintTagId === tag.id ? '#fff' : tag.color }}
                className={`px-2 py-1 rounded border text-xs font-bold shrink-0 transition-colors ${selectedPaintTagId === tag.id ? 'ring-2 ring-offset-1' : ''}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
          
          {/* Controls - Mobile optimized */}
          <button
            onClick={handlePrevMonth}
            className="p-2 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active-glow-effect hover-spring-effect cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs active-glow-effect hover-spring-effect cursor-pointer"
          >
            今天
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active-glow-effect hover-spring-effect cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 hover:bg-indigo-500 active-glow-effect hover-spring-effect cursor-pointer animate-pulse"
              >
                <UserPlus className="w-3.5 h-3.5" />
                新增人員
              </button>
              <button
                onClick={() => setShowTagConfigModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-black/10 dark:border-white/10 rounded-xl font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 active-glow-effect hover-spring-effect cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                管理標籤
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Timeline Calendar Core Grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative border-b border-black/5 dark:border-white/5">
        
        {/* Left Side: Staff List Column Header (Fixed) */}
        <div 
          ref={leftListRef}
          onScroll={handleLeftScroll}
          className="w-[100px] md:w-[200px] border-r border-black/10 dark:border-white/10 flex flex-col bg-white/25 dark:bg-slate-900/25 shrink-0 min-h-0 overflow-y-auto no-scrollbar"
        >
          {/* Header row corner */}
          <div className="h-14 border-b border-black/10 dark:border-white/10 flex items-center px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm font-bold text-xs tracking-wider text-slate-500 shrink-0 sticky top-0 z-40">
            名單成員
          </div>

          {/* Members list */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Global Calendar Row */}
            <div className="border-b-2 border-indigo-500/20 flex items-center justify-between px-3 group bg-indigo-50/95 dark:bg-indigo-900/80 backdrop-blur-sm shrink-0 sticky top-14 z-30" style={{ height: getRowHeight('global') }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs truncate leading-snug text-indigo-700 dark:text-indigo-400">共同行事曆</p>
                  <p className="text-[10px] text-indigo-500/70 truncate leading-none mt-0.5 hidden md:block">團隊共用排程</p>
                </div>
              </div>
              {!readOnly && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150">
                  <button
                    onClick={() => setShowAddActivityModal('global')}
                    title="新增共用活動"
                    className="p-1 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-md hover:bg-indigo-500/10 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {staffList.map((staff, idx) => (
              <div
                key={staff.id}
                style={{ contentVisibility: "auto", height: getRowHeight(staff.id) }}
                className="border-b border-black/5 dark:border-white/5 flex items-center justify-between px-3 group hover:bg-slate-500/5 transition-colors shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {staff.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate leading-snug">{staff.name}</p>
                    {staff.role && (
                      <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5 hidden md:block">{staff.role}</p>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150">
                    <button
                      onClick={() => setShowAddActivityModal(staff.id)}
                      title="新增區間活動"
                      className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingStaff(staff)}
                      title="編輯姓名"
                      className="p-1 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(staff.id)}
                      title="刪除成員"
                      className="p-1 text-slate-500 hover:text-red-500 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {staffList.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                暫無人員，請點擊上方按鈕新增！
              </div>
            )}
          </div>
        </div>

        {/* Middle: Scrollable Scheduling Matrix */}
        <div 
          ref={rightGridRef}
          onScroll={handleRightScroll}
          className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto bg-[#fafaf9] dark:bg-[#07080f]"
        >
          
          {/* Header Month Days */}
          <div className="flex shrink-0 z-40 sticky top-0 bg-white dark:bg-slate-900" style={{ width: `${days.length * 80}px` }}>
            {days.map((day) => {
              const dateStr = formatDateStr(day);
              const isToday = new Date().toDateString() === day.toDateString();
              const isSel = selectedStatusDate === dateStr;
              const weekend = isWeekend(day);
              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedStatusDate(dateStr);
                    if (isToday) scrollToToday(true);
                  }}
                  className={`w-20 h-14 border-b border-r border-black/10 dark:border-white/10 flex flex-col items-center justify-center cursor-pointer select-none relative transition-colors ${
                    weekend ? "bg-black/5 dark:bg-white/5" : "bg-white/40 dark:bg-slate-900/40"
                  } ${isToday ? "bg-amber-500/20 ring-2 ring-amber-500 ring-inset" : ""} ${isSel && !isToday ? "ring-2 ring-indigo-500 ring-inset" : ""}`}
                >
                  {isToday && (
                    <span className="absolute top-1 right-1 px-1 py-0.2 rounded bg-amber-500 text-white text-[8px] font-extrabold leading-tight shadow-sm">
                      今
                    </span>
                  )}
                  <span className={`text-[10px] font-bold ${weekend ? "text-rose-500" : isToday ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-slate-400 dark:text-slate-500"}`}>
                    {getDayName(day)}
                  </span>
                  <span className={`text-xs font-semibold leading-none mt-1 ${isToday ? "text-amber-600 dark:text-amber-400 font-extrabold scale-110" : ""}`}>
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid rows */}
          <div className="relative" style={{ width: `${days.length * 80}px` }}>
            
            {/* Global Calendar Row Grid */}
            <div
              className="border-b-2 border-indigo-500/20 flex relative items-center bg-indigo-50/50 dark:bg-indigo-900/20 sticky top-14 z-30 backdrop-blur-sm"
              style={{ width: `${days.length * 80}px`, height: getRowHeight('global') }}
            >
              {days.map((day) => {
                const dateStr = formatDateStr(day);
                const cellDataList = getCellData('global', dateStr);
                const weekend = isWeekend(day);
                const isToday = new Date().toDateString() === day.toDateString();

                return (
                  <div
                    key={dateStr}
                    onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
                    onDragEnter={!readOnly ? (e) => e.currentTarget.classList.add("bg-indigo-500/10") : undefined}
                    onDragLeave={!readOnly ? (e) => e.currentTarget.classList.remove("bg-indigo-500/10") : undefined}
                    onDrop={!readOnly ? async (e) => {
                      e.currentTarget.classList.remove("bg-indigo-500/10");
                      const tagId = e.dataTransfer.getData("text/plain");
                      if (tagId) await handleDropTag('global', dateStr, tagId);
                    } : undefined}
                    onClick={() => {
                      if (!readOnly && selectedPaintTagId) {
                        handleDropTag('global', dateStr, selectedPaintTagId);
                      } else {
                        setSelectedStatusDate(dateStr);
                        if (!readOnly) {
                          setSelectedCellModal({
                            staffId: 'global',
                            staffName: '全域共用',
                            dateStr
                          });
                        }
                      }
                    }}
                    className={`w-20 h-full border-r border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-0.5 shrink-0 relative group/cell overflow-hidden cursor-pointer ${
                      weekend ? "bg-black/5 dark:bg-white/5" : ""
                    } ${isToday ? "bg-amber-500/[0.05]" : ""} ${selectedPaintTagId ? "cursor-crosshair" : "hover:bg-indigo-500/5"}`}
                  >
                    {cellDataList.map(({ assignment, tag }) => (
                      <div
                        key={assignment.id}
                        className="w-[calc(100%-8px)] h-[48px] px-1 py-1 rounded-md text-white text-xs font-bold shadow-sm shadow-black/10 flex flex-col items-center justify-center gap-0.5 select-none z-[10] group/tag relative cursor-pointer text-center leading-none"
                        style={{ ...tag?.color ? { backgroundColor: tag.color } : {} }}
                      >
                        <span className="whitespace-nowrap truncate w-full">{tag?.name}</span>
                        {assignment.value && assignment.value > 1 && (
                          <span className="whitespace-nowrap opacity-90 font-medium scale-90">({assignment.value})</span>
                        )}
                        {!readOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAssignment(assignment.id);
                            }}
                            className="opacity-0 group-hover/tag:opacity-100 hover:scale-125 transition-opacity w-3.5 h-3.5 flex items-center justify-center bg-black/40 shadow-sm rounded-full text-white cursor-pointer absolute -top-1.5 -right-1.5 z-20"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              {getStaffActivitiesInView('global').map((act) => {
                const actStyle = calculateActivityStyle(act);
                return (
                  <div
                    key={act.id}
                    style={actStyle}
                    onClick={!readOnly ? () => setEditingActivity(act) : undefined}
                    className="absolute h-9 rounded-lg px-2.5 text-white flex items-center justify-center text-[11px] font-semibold cursor-pointer shadow-lg shadow-black/15 z-[2] select-none hover:brightness-110 active-glow-effect group/act"
                  >
                    <span className="truncate">{act.title}</span>
                    {!readOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteActivity(act.id);
                        }}
                        className="opacity-0 group-hover/act:opacity-100 hover:scale-125 transition-opacity w-3.5 h-3.5 flex items-center justify-center bg-black/40 shadow-sm rounded-full text-white cursor-pointer absolute -top-1.5 -right-1.5 z-20"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {staffList.map((staff) => {
              const staffActs = getStaffActivitiesInView(staff.id);
              return (
                <div
                  key={staff.id}
                  className="border-b border-black/5 dark:border-white/5 flex relative items-center"
                  style={{ width: `${days.length * 80}px`, height: getRowHeight(staff.id) }}
                >
                  {days.map((day) => {
                    const dateStr = formatDateStr(day);
                    const cellDataList = getCellData(staff.id, dateStr);
                    const weekend = isWeekend(day);
                    const isToday = new Date().toDateString() === day.toDateString();

                    return (
                      <div
                        key={dateStr}
                        onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
                        onDragEnter={!readOnly ? (e) => e.currentTarget.classList.add("bg-indigo-500/10") : undefined}
                        onDragLeave={!readOnly ? (e) => e.currentTarget.classList.remove("bg-indigo-500/10") : undefined}
                        onDrop={!readOnly ? async (e) => {
                          e.currentTarget.classList.remove("bg-indigo-500/10");
                          const tagId = e.dataTransfer.getData("text/plain");
                          if (tagId) await handleDropTag(staff.id, dateStr, tagId);
                        } : undefined}
                        onClick={() => {
                          if (!readOnly && selectedPaintTagId) {
                            handleDropTag(staff.id, dateStr, selectedPaintTagId);
                          } else {
                            setSelectedStatusDate(dateStr);
                            if (!readOnly) {
                              setSelectedCellModal({
                                staffId: staff.id,
                                staffName: staff.name,
                                dateStr
                              });
                            }
                          }
                        }}
                        className={`w-20 h-full border-r border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-0.5 shrink-0 relative group/cell overflow-hidden cursor-pointer ${
                          weekend ? "bg-black/5 dark:bg-white/5" : ""
                        } ${isToday ? "bg-amber-500/[0.05]" : ""} ${selectedPaintTagId ? "cursor-crosshair hover:bg-black/5 dark:hover:bg-white/5" : "hover:bg-indigo-500/5"}`}
                      >
                        {cellDataList.map(({ assignment, tag }) => (
                          <div
                            key={assignment.id}
                            className="w-[calc(100%-8px)] h-[48px] px-1 py-1 rounded-md text-white text-xs font-bold shadow-sm shadow-black/10 flex flex-col items-center justify-center gap-0.5 select-none z-[10] group/tag relative cursor-pointer text-center leading-none"
                            style={{ ...tag?.color ? { backgroundColor: tag.color } : {} }}
                          >
                            <span className="whitespace-nowrap truncate w-full">{tag?.name}</span>
                            {assignment.value && assignment.value > 1 && (
                              <span className="whitespace-nowrap opacity-90 font-medium scale-90">({assignment.value})</span>
                            )}
                            {!readOnly && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAssignment(assignment.id);
                                }}
                                className="opacity-0 group-hover/tag:opacity-100 hover:scale-125 transition-opacity w-3.5 h-3.5 flex items-center justify-center bg-black/40 shadow-sm rounded-full text-white cursor-pointer absolute -top-1.5 -right-1.5 z-20"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Absolute Positioned Activity Bars */}
                  {staffActs.map((act) => {
                    const actStyle = calculateActivityStyle(act);
                    return (
                      <div
                        key={act.id}
                        style={actStyle}
                        onClick={!readOnly ? () => setEditingActivity(act) : undefined}
                        className="absolute h-9 rounded-lg px-2.5 text-white flex items-center justify-center text-[11px] font-semibold cursor-pointer shadow-lg shadow-black/15 z-[2] select-none hover:brightness-110 active-glow-effect group/act"
                      >
                        <span className="truncate">{act.title}</span>
                        {!readOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteActivity(act.id);
                            }}
                            className="opacity-0 group-hover/act:opacity-100 hover:scale-125 transition-opacity w-3.5 h-3.5 flex items-center justify-center bg-black/40 shadow-sm rounded-full text-white cursor-pointer absolute -top-1.5 -right-1.5 z-20"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {staffList.length === 0 && (
              <div
                className="h-28 flex items-center justify-center text-slate-400 text-xs"
                style={{ width: `${days.length * 80}px` }}
              >
                左側新增人員後，拖曳右側標籤到此處進行安排
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Fixed Tag Templates */}
        {!readOnly && (
          <div className="hidden md:flex w-[180px] border-l border-black/10 dark:border-white/10 flex-col bg-white/20 dark:bg-slate-900/20 shrink-0 min-h-0">
            <div className="h-14 border-b border-black/10 dark:border-white/10 flex items-center justify-between px-3 bg-white/40 dark:bg-slate-900/40 shrink-0">
              <span className="font-bold text-xs tracking-wider text-slate-500">標籤庫</span>
              <div className="w-4.5 h-4.5 flex items-center justify-center bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-full" title="拖曳標籤至日曆以放置">
                <HelpCircle className="w-3 h-3" />
              </div>
            </div>

            <div className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto min-h-0 select-none">
              {tagsList.map((tag) => (
                <div
                  key={tag.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", tag.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  style={{ backgroundColor: tag.color }}
                  className="px-3 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-black/10 cursor-grab active:cursor-grabbing hover:opacity-90 active:opacity-80 flex items-center justify-between group/tagcard"
                >
                  <span>{tag.name}</span>
                  <span className="opacity-45 text-[9px] font-mono tracking-tighter uppercase shrink-0 px-1 border border-white/20 bg-black/10 rounded">
                    DRAG
                  </span>
                </div>
              ))}
              
              <p className="text-[10px] text-slate-400 text-center leading-normal mt-3 select-text">
                ☝️ 拖曳上述標籤<br />至日曆格子中進行安排
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- POPUPS / MODALS --- */}
      <>
        {/* A. Add Staff Modal */}
        {showAddStaffModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handleAddStaff}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                新增人員
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">人員姓名 *</label>
                  <input
                    ref={staffNameRef}
                    required
                    type="text"
                    placeholder="請輸入人員姓名..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">角色職位 (選填)</label>
                  <input
                    ref={staffRoleRef}
                    type="text"
                    placeholder="例如：設計師、工程師、經理"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-xl font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-xs hover:bg-indigo-500 active-glow-effect cursor-pointer"
                >
                  確認新增
                </button>
              </div>
            </form>
          </div>
        )}

        {/* B. Edit Staff Modal */}
        {editingStaff && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handleSaveEditStaff}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                編輯人員資料
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">人員姓名 *</label>
                  <input
                    required
                    type="text"
                    value={editingStaff.name}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    placeholder="請輸入人員姓名..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">角色職位 (選填)</label>
                  <input
                    type="text"
                    value={editingStaff.role || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                    placeholder="例如：設計師、工程師、經理"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-xl font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-xl text-xs hover:bg-amber-400 active-glow-effect cursor-pointer"
                >
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        )}

        {/* C. Add Activity Modal */}
        {showAddActivityModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handleAddActivity}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setShowAddActivityModal(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-500" />
                新增區間活動
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">活動名稱 *</label>
                  <input
                    ref={activityTitleRef}
                    required
                    type="text"
                    placeholder="例如：年度旅遊、出差客戶開發..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">開始日期 *</label>
                    <input
                      ref={activityStartRef}
                      required
                      type="date"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">結束日期 *</label>
                    <input
                      ref={activityEndRef}
                      required
                      type="date"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">活動顏色</label>
                  <div className="flex gap-2.5">
                    {["#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#10b981", "#06b6d4", "#f59e0b"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setActivityColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform relative ${
                          activityColor === col ? "scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : ""
                        }`}
                      >
                        {activityColor === col && <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddActivityModal(null)}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-xl font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-xs hover:bg-indigo-500 active-glow-effect cursor-pointer"
                >
                  確認新增
                </button>
              </div>
            </form>
          </div>
        )}

        {/* D. Edit Activity Modal */}
        {editingActivity && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handleSaveEditActivity}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-500" />
                編輯區間活動
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">活動名稱 *</label>
                  <input
                    required
                    type="text"
                    value={editingActivity.title}
                    onChange={(e) => setEditingActivity({ ...editingActivity, title: e.target.value })}
                    placeholder="請輸入活動名稱..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">開始日期 *</label>
                    <input
                      required
                      type="date"
                      value={editingActivity.startDate}
                      onChange={(e) => setEditingActivity({ ...editingActivity, startDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">結束日期 *</label>
                    <input
                      required
                      type="date"
                      value={editingActivity.endDate}
                      onChange={(e) => setEditingActivity({ ...editingActivity, endDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">活動顏色</label>
                  <div className="flex gap-2.5">
                    {["#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#10b981", "#06b6d4", "#f59e0b"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setEditingActivity({ ...editingActivity, color: col })}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform relative ${
                          editingActivity.color === col ? "scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : ""
                        }`}
                      >
                        {editingActivity.color === col && <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={() => handleDeleteActivity(editingActivity.id)}
                  className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-500/20 active-glow-effect cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  刪除活動
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingActivity(null)}
                    className="px-4 py-2 border border-black/10 dark:border-white/10 rounded-xl font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-xs hover:bg-indigo-500 active-glow-effect cursor-pointer"
                  >
                    儲存
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* E. Manage Tags Modal */}
        {showTagConfigModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh] min-h-0"
            >
              <button
                type="button"
                onClick={() => setShowTagConfigModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-base font-bold mb-4 flex items-center gap-2 shrink-0">
                <Tag className="w-5 h-5 text-indigo-500" />
                標籤庫管理
              </h3>

              {/* Add Custom Tag Form */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border border-black/5 dark:border-white/5 rounded-2xl mb-4 shrink-0">
                <h4 className="text-xs font-bold text-slate-500 mb-2">建立全新標籤</h4>
                <div className="flex items-center gap-2">
                  <input
                    required
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="標籤名稱..."
                    className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border border-black/15 shrink-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full overflow-hidden"
                    title="挑選顏色"
                  />
                  <button
                    type="button"
                    onClick={handleAddTagTemplate}
                    className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 active-glow-effect hover-spring-effect shrink-0 cursor-pointer"
                  >
                    新增
                  </button>
                </div>
              </div>

              {/* Tag Template Roster List */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-500 mb-1">現有標籤</h4>
                {tagsList.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-950/20 border border-black/5 dark:border-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: tag.color }}
                      ></span>
                      <span className="text-xs font-semibold">{tag.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteTagTemplate(tag.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4 pt-3 border-t border-black/5 dark:border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTagConfigModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </>

      {/* Tag Value Dialog */}
      {pendingTagDrop && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPendingTagDrop(null)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-black/10 dark:border-white/10">
            <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                請輸入人數
              </h3>
              <button
                onClick={() => setPendingTagDrop(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={confirmPendingTagDrop} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {pendingTagDrop.tagName} 人數
                </label>
                <input
                  ref={tagValueRef}
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="例如: 1"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingTagDrop(null)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 cursor-pointer"
                >
                  確定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 快捷排班視窗 */}
      <QuickShiftModal
        isOpen={!!activeShiftModalSlot}
        onClose={() => setActiveShiftModalSlot(null)}
        slot={activeShiftModalSlot}
        dateStr={activeShiftModalDate}
        staffList={staffList}
        assignments={assignments}
        onSaveAssignment={handleSaveShiftAssignment}
        onDeleteAssignment={handleDeleteShiftAssignment}
      />

      {/* 免排班日設定視窗 */}
      <ExcludedDatesModal
        isOpen={showExcludedDatesModal}
        onClose={() => setShowExcludedDatesModal(false)}
        excludedDates={project.excludedDates || []}
        onSaveExcludedDates={handleSaveExcludedDates}
      />

      {/* 手機/觸控格子快捷安排選單 */}
      <CellActionModal
        isOpen={!!selectedCellModal}
        onClose={() => setSelectedCellModal(null)}
        staffId={selectedCellModal?.staffId || ""}
        staffName={selectedCellModal?.staffName || ""}
        dateStr={selectedCellModal?.dateStr || ""}
        tagsList={tagsList}
        assignments={assignments}
        onSaveTag={async (staffId, dateStr, tagId, value) => {
          await saveTagAssignment(staffId, dateStr, tagId, value);
        }}
        onRemoveAssignment={handleRemoveAssignment}
        onToggleShift={handleToggleShiftFromCell}
        onOpenAddActivity={handleOpenAddActivityFromCell}
        readOnly={readOnly}
      />

    </div>
  );
}
