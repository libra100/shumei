import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { shumeiDb as db, ganttDb } from "../services/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, Tag, CheckCircle2, ArrowLeft } from "lucide-react";
import { ShumeiTag, ShumeiAssignment, ShumeiProjectData as Project } from "../types/shumei";
import { DEFAULT_TAGS } from "../components/ShumeiScheduler";

// Helper for formatting date
const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function ShumeiFront({ renderNav, skipAuth }: { renderNav?: () => React.ReactNode; skipAuth?: boolean } = {}) {
  const [leaders, setLeaders] = useState<string[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [tags, setTags] = useState<ShumeiTag[]>([]);
  const [assignments, setAssignments] = useState<ShumeiAssignment[]>([]);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (skipAuth === true) return true;
    try {
      return sessionStorage.getItem("shumei_front_auth") === "true";
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState<string>("");
  const CORRECT_PASSWORD = "1223"; // 您可以隨時在此更改櫃檯密碼

  const [step, setStep] = useState<"group" | "name" | "tag" | "success">("group");
  
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data
  useEffect(() => {
    // 1. Fetch Leaders
    const unsubscribeLeaders = onSnapshot(doc(db, "info", "youth"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.leader) {
          setLeaders(Array.isArray(data.leader) ? data.leader : [data.leader]);
        }
      }
    });

    // 2. Fetch Members
    const unsubscribeMembers = onSnapshot(collection(db, "member"), (snapshot) => {
      const mems: any[] = [];
      snapshot.forEach((doc) => {
        mems.push({ id: doc.id, ...doc.data() });
      });
      setMembers(mems);
    });

    // 3. Fetch Tags & Assignments from GanttCraft project
    const unsubscribeProject = onSnapshot(doc(ganttDb, "ganttcraft_projects", "shumei"), (docSnap) => {
      if (docSnap.exists()) {
        const projData = docSnap.data() as Project;
        const fetchedTags = projData.shumeiTags || [];
        setTags(fetchedTags.length > 0 ? fetchedTags : DEFAULT_TAGS);
        setAssignments(projData.shumeiAssignments || []);
      } else {
        setTags(DEFAULT_TAGS);
        setAssignments([]);
      }
    });

    return () => {
      unsubscribeLeaders();
      unsubscribeMembers();
      unsubscribeProject();
    };
  }, []);

  const handleSelectLeader = (leader: string) => {
    setSelectedLeader(leader);
    setStep("name");
  };

  const handleSelectMember = (member: any) => {
    setSelectedMember(member);
    setStep("tag");
  };

  const handleToggleTag = async (tag: ShumeiTag) => {
    if (!selectedMember || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const todayStr = formatDateStr(new Date());
      
      // Check if tag is already assigned
      const isAssigned = assignments.some(
        (a) => a.staffId === selectedMember.id && a.date === todayStr && a.tagId === tag.id
      );
      
      let newAssignments = [...assignments];
      
      if (isAssigned) {
        // Remove tag
        newAssignments = assignments.filter(
          (a) => !(a.staffId === selectedMember.id && a.date === todayStr && a.tagId === tag.id)
        );
      } else {
        // Add tag
        let value: number | undefined = undefined;
        if (tag.name.includes("做淨靈") || tag.name.includes("未信徒淨靈") || tag.name.includes("淨靈")) {
          const numStr = window.prompt(`請輸入【${tag.name}】的人數：`, "1");
          if (numStr === null) {
            setIsSubmitting(false);
            return; // Cancelled
          }
          const parsed = parseInt(numStr, 10);
          if (!isNaN(parsed) && parsed > 0) {
            value = parsed;
          } else {
            alert("請輸入有效的數字");
            setIsSubmitting(false);
            return;
          }
        }
        
        const newAssign: ShumeiAssignment = {
          id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          staffId: selectedMember.id,
          tagId: tag.id,
          date: todayStr,
          ...(value !== undefined ? { value } : {})
        };
        newAssignments.push(newAssign);
      }
      
      await setDoc(doc(ganttDb, "ganttcraft_projects", "shumei"), {
        shumeiAssignments: newAssignments
      }, { merge: true });
      
    } catch (error) {
      console.error("Submit error:", error);
      alert("儲存失敗，請檢查網路連線");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearTags = async () => {
    if (!selectedMember || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const todayStr = formatDateStr(new Date());
      
      // Filter out all assignments for this member today
      const filtered = assignments.filter(
        (a) => !(a.staffId === selectedMember.id && a.date === todayStr)
      );
      
      await updateDoc(doc(ganttDb, "ganttcraft_projects", "shumei"), {
        shumeiAssignments: filtered
      });
      
      
    } catch (error) {
      console.error("Clear error:", error);
      alert("清空失敗，請檢查網路連線");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setStep("success");
    setTimeout(() => {
      resetFlow();
    }, 3000);
  };

  const resetFlow = () => {
    setSelectedLeader("");
    setSelectedMember(null);
    setStep("group");
  };

  // Filter members by selected leader
  const filteredMembers = members.filter(m => m.leader === selectedLeader);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passwordInput.trim().replace(/[／\-\s]/g, "");
    if (clean === CORRECT_PASSWORD) {
      try {
        sessionStorage.setItem("shumei_front_auth", "true");
      } catch {}
      setIsAuthenticated(true);
    } else {
      alert("密碼錯誤，請輸入 1223");
      setPasswordInput("");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-black/10 dark:border-white/10 text-center">
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-6">櫃檯報到系統</h2>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="mb-4 text-center">
              <span className="text-sm text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                提示：明主樣生日
              </span>
            </div>
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="請輸入櫃檯解鎖密碼"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-lg shadow-md hover:bg-indigo-500 transition-colors active:scale-95"
            >
              進入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden select-none">
      {/* Header */}
      <header className="h-20 bg-indigo-600 text-white flex items-center justify-between px-6 shadow-md shrink-0 z-10">
        <div className="flex items-center gap-4">
          {(step === "name" || step === "tag") && (
            <button 
              onClick={() => {
                if (step === "name") setStep("group");
                if (step === "tag") setStep("name");
              }}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-wider font-display">自助報到系統</h1>
            <p className="text-indigo-100 text-sm">
              {step === "group" && "第一步：選擇您所屬的小組"}
              {step === "name" && `第二步：選擇您的名字 (${selectedLeader} 的小組)`}
              {step === "tag" && `第三步：為「${selectedMember?.name}」選擇報到標籤`}
            </p>
          </div>
        </div>
        {renderNav && (
          <div className="flex items-center gap-3">
            {renderNav()}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-6 flex flex-col relative">
        <AnimatePresence mode="wait">
          
          {step === "group" && (
            <motion.div
              key="group"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-max"
            >
              {leaders.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-400 text-xl font-bold animate-pulse">
                  載入小組資料中...
                </div>
              )}
              {leaders.map(leader => (
                <button
                  key={leader}
                  onClick={() => handleSelectLeader(leader)}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer hover-spring-effect active-glow-effect group"
                >
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Users className="w-8 h-8" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{leader}</span>
                </button>
              ))}
            </motion.div>
          )}

          {step === "name" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-max"
            >
              {filteredMembers.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-400 text-xl font-bold">
                  此小組目前沒有成員
                </div>
              )}
              {filteredMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => handleSelectMember(member)}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer hover-spring-effect active-glow-effect group"
                >
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <User className="w-8 h-8" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{member.name}</span>
                </button>
              ))}
            </motion.div>
          )}

          {step === "tag" && (
            <motion.div
              key="tag"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-max"
            >
              {tags.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-400 text-xl font-bold">
                  目前沒有可用的標籤
                </div>
              )}
              {tags.map(tag => {
                const isAssigned = assignments.some(a => a.staffId === selectedMember?.id && a.date === formatDateStr(new Date()) && a.tagId === tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag)}
                    disabled={isSubmitting}
                    style={{ borderColor: tag.color }}
                    className={`bg-white dark:bg-slate-900 border-4 p-4 md:p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 md:gap-4 cursor-pointer active-glow-effect hover-spring-effect group relative overflow-hidden glass-panel ${
                      isAssigned ? 'ring-4 ring-offset-2 ring-indigo-500' : ''
                    }`}
                  >
                    <div 
                      className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                      style={{ backgroundColor: tag.color }}
                    ></div>
                    {isAssigned && (
                      <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-md scale-75 md:scale-100">
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    )}
                    <div 
                      className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform relative z-10"
                      style={{ backgroundColor: tag.color }}
                    >
                      <Tag className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <span className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100 relative z-10 leading-tight">
                      {tag.name}
                    </span>
                  </button>
                );
              })}
              
              {/* Action Buttons */}
              <div className="col-span-full grid grid-cols-2 gap-4 mt-4 md:mt-8 pt-4 md:pt-8 border-t-2 border-slate-200 dark:border-slate-700/50">
                {/* Finish Button */}
                <button
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="bg-indigo-600 border-4 border-indigo-500 p-4 md:p-6 rounded-3xl shadow-sm hover:shadow-xl hover:bg-indigo-500 transition-all flex flex-col items-center justify-center gap-1 md:gap-2 cursor-pointer group"
                >
                  <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-white group-hover:scale-110 transition-transform" />
                  <span className="text-lg md:text-xl font-bold text-white relative z-10">
                    完成報到
                  </span>
                </button>
                
                {/* Clear Button */}
                <button
                  onClick={handleClearTags}
                  disabled={isSubmitting}
                  className="bg-white dark:bg-slate-900 border-4 border-red-200 dark:border-red-900/50 p-4 md:p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-red-500 transition-all flex flex-col items-center justify-center gap-1 md:gap-2 cursor-pointer active-glow-effect hover-spring-effect group relative overflow-hidden glass-panel"
                >
                  <div className="absolute inset-0 bg-red-500 opacity-5 group-hover:opacity-10 transition-opacity"></div>
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform relative z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-5 md:h-5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </div>
                  <span className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400 relative z-10">
                    清空紀錄
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-500/40">
                <CheckCircle2 className="w-24 h-24 text-white" />
              </div>
              <h2 className="text-5xl font-black text-slate-800 dark:text-white mb-4 tracking-wider">
                報到成功！
              </h2>
              <p className="text-2xl text-slate-500 dark:text-slate-400">
                {selectedMember?.name} 已成功登記
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
