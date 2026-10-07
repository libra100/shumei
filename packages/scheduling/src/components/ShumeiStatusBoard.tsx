import React, { useState, useMemo } from "react";
import { UserCheck, Tag as TagIcon, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ShumeiProjectData as Project, ShumeiStaff, ShumeiTag, ShumeiAssignment } from "../types/shumei";
import { DEFAULT_TAGS } from "./ShumeiScheduler";

interface ShumeiStatusBoardProps {
  project: Project;
}

export default function ShumeiStatusBoard({ project }: ShumeiStatusBoardProps) {
  const staffList: ShumeiStaff[] = project.shumeiStaff || [];
  const tagsList: ShumeiTag[] = project.shumeiTags && project.shumeiTags.length > 0 ? project.shumeiTags : DEFAULT_TAGS;
  const assignments: ShumeiAssignment[] = project.shumeiAssignments || [];

  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");

  // Monthly navigation state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleThisMonth = () => {
    setCurrentDate(new Date());
  };

  // Filter assignments strictly for the selected month (YYYY-MM)
  const monthAssignments = useMemo(() => {
    return assignments.filter((a) => a.date && a.date.startsWith(monthPrefix));
  }, [assignments, monthPrefix]);

  // Calculate tag distribution for each staff member for the selected month
  const staffStats = useMemo(() => {
    return staffList.map((staff) => {
      // Find assignments for this staff in the selected month
      const staffAssignments = monthAssignments.filter((a) => a.staffId === staff.id);
      
      // Calculate count for each tag
      const tagCounts = tagsList.map((tag) => {
        const tagAssignments = staffAssignments.filter((a) => a.tagId === tag.id);
        const count = tagAssignments.reduce((acc, a) => acc + (a.value || 1), 0);
        return { tag, count };
      });

      const totalAssignments = staffAssignments.length;
      
      return {
        staff,
        tagCounts,
        totalAssignments,
        isAssigned: totalAssignments > 0,
      };
    });
  }, [staffList, tagsList, monthAssignments]);

  // Filter based on user selection
  const filteredStaffStats = useMemo(() => {
    return staffStats.filter((stat) => {
      if (statusFilter === "assigned") return stat.isAssigned;
      if (statusFilter === "unassigned") return !stat.isAssigned;
      return true;
    });
  }, [staffStats, statusFilter]);

  const assignedCount = staffStats.filter((s) => s.isAssigned).length;
  const unassignedCount = staffStats.filter((s) => !s.isAssigned).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-t-2xl z-10 shrink-0">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">人員標籤安排概況</h2>
          </div>

          {/* Month Switcher */}
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="上一月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[85px] text-center flex items-center justify-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {year} 年 {month + 1} 月
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="下一月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleThisMonth}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-black/5 dark:border-white/10 hover:bg-slate-50 transition-all cursor-pointer ml-1"
            >
              本月
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            全部 ({staffStats.length})
          </button>
          <button
            onClick={() => setStatusFilter("assigned")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "assigned"
                ? "bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            已安排 ({assignedCount})
          </button>
          <button
            onClick={() => setStatusFilter("unassigned")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "unassigned"
                ? "bg-white dark:bg-slate-800 shadow-sm text-rose-600 dark:text-rose-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            未安排 ({unassignedCount})
          </button>
        </div>
      </div>

      {/* 2. Staff Cards List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredStaffStats.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <UserCheck className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-semibold">沒有符合條件的人員</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredStaffStats.map((stat) => (
              <div
                key={stat.staff.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 transition-all hover-spring-effect ${
                  stat.isAssigned
                    ? "bg-white dark:bg-slate-800 border-black/10 dark:border-white/10 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-900/50 border-rose-500/20"
                }`}
              >
                {/* Left: Staff Profile */}
                <div className="flex items-center gap-3 w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-black/10 dark:border-white/10 pb-4 sm:pb-0 sm:pr-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-2xl border border-black/10 dark:border-white/10 shrink-0">
                    {stat.staff.name ? stat.staff.name.charAt(0).toUpperCase() : "👤"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {stat.staff.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {stat.staff.role || "未指派職位"}
                    </p>
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                      {month + 1}月累計: {stat.totalAssignments} 項
                    </p>
                  </div>
                </div>

                {/* Right: Tag Statuses */}
                <div className="flex-1 flex flex-wrap content-start gap-2">
                  {tagsList.length === 0 ? (
                    <span className="text-xs text-slate-400 italic flex items-center gap-1">
                      <TagIcon className="w-3 h-3" /> 目前系統中沒有標籤
                    </span>
                  ) : (
                    stat.tagCounts.map(({ tag, count }) => {
                      const isActive = count > 0;
                      return (
                        <div
                          key={tag.id}
                          style={isActive ? { backgroundColor: tag.color } : {}}
                          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all select-none ${
                            isActive
                              ? "text-white border-transparent shadow-md shadow-black/10 hover:brightness-110"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60 grayscale"
                          }`}
                        >
                          <span className="truncate max-w-[80px]">{tag.name}</span>
                          
                          {/* Count Badge */}
                          {isActive && count > 1 && (
                            <span className="ml-1 bg-white/30 text-white px-1.5 py-0.5 rounded text-[10px] leading-none font-bold backdrop-blur-sm">
                              x{count}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
