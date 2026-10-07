/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ErrorBoundary from "../../../../src/components/ErrorBoundary";
import { Project, Task, Collaborator, ActivityLog, StickyNote, NoteConnection, Team, TimelineEvent, BoardShape } from "../../../../src/types";
import ShumeiScheduler from "../components/ShumeiScheduler";
import TeamManager from "../../../../src/components/TeamManager";
import OnlineMembers from "../../../../src/components/OnlineMembers";
import AppNavigator from "../../../../src/components/AppNavigator";

import ProjectSettings from "../../../../src/components/ProjectSettings";
import KanbanBoard from "../../../../src/components/KanbanBoard";
import ShumeiStatusBoard from "../components/ShumeiStatusBoard";
import IdeationBoard from "../../../../src/components/IdeationBoard";
import { JoinProjectModal } from "../../../../src/components/JoinProjectModal";
import { CreateProjectModal } from "../../../../src/components/CreateProjectModal";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDocs } from "firebase/firestore";
import { signInAnonymously, signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider, ganttDb, ganttAuth } from "../../../../src/firebase-config";
import {
  CalendarRange,
  Network,
  Share2,
  GitFork,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  User,
  Plus,
  Loader2,
  Info,
  Lightbulb,
  Users,
  Settings2,
  X,
  Activity,
  Clock,
  Trash2,
  Key,
  Moon,
  Sun,
  HelpCircle,
  MessageSquare,
} from "lucide-react";

// Custom hook to detect mobile viewports
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export default function ShumeiApp() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<string[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const [shapes, setShapes] = useState<BoardShape[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>("proj_health_app");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // User auth details
  const [googleUser, setGoogleUser] = useState<{
    id: string;
    name: string;
    email: string;
    avatar: string;
    color: string;
    picture?: string;
  } | null>(null);

  const [showGoogleDetails, setShowGoogleDetails] = useState<boolean>(false);

  // Tab View Modes ("simplified" is mapped to the new Shumei drag-and-drop scheduler)
  const [activeTab, setActiveTab] = useState<"workspace" | "team">("workspace");
  const [viewMode, setViewMode] = useState<"simplified" | "kanban" | "ideation">("simplified");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  // Modals & Settings
  const [showTeamSettings, setShowTeamSettings] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("ganttcraft_theme") as "light" | "dark") || 
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );

  useEffect(() => {
    localStorage.setItem("ganttcraft_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Login Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Sync state reference to avoid stale closures in callbacks
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Handle local storage restore and collaborator session
  useEffect(() => {
    let activeId = "";
    let activeName = "排程協作者";
    let activeAvatar = "👨‍💻";
    let activeColor = "bg-indigo-500";

    const savedGoogleStr = localStorage.getItem("gantt_google_user");
    const savedGuestStr = localStorage.getItem("gantt_guest_user");

    if (savedGoogleStr) {
      try {
        const u = JSON.parse(savedGoogleStr);
        setGoogleUser(u);
        activeId = u.id;
        activeName = u.name;
        activeAvatar = u.picture || u.avatar || "👤";
        activeColor = u.color || "bg-emerald-500";
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse saved google user:", e);
      }
    } else if (savedGuestStr) {
      try {
        const guest = JSON.parse(savedGuestStr);
        activeId = guest.id;
        activeName = guest.name;
        activeAvatar = guest.avatar;
        activeColor = guest.color;
        setCurrentUserId(activeId);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse guest user:", e);
      }
    }

    let heartbeatInterval: NodeJS.Timeout | null = null;
    let handleBeforeUnload: (() => void) | null = null;

    if (activeId) {
      setCurrentUserId(activeId);
      const registerMyself = async () => {
        try {
          try {
            await signInAnonymously(auth);
          } catch (authErr) {
            console.warn("Firebase Anonymous Auth not enabled or failed:", authErr);
          }
          await setDoc(doc(ganttDb, "ganttcraft_collaborators", activeId), {
            id: activeId,
            name: activeName,
            avatar: activeAvatar,
            color: activeColor,
            status: "viewing",
            lastActive: Date.now()
          }, { merge: true });
        } catch (e) {
          console.error("Failed to register self collaborator:", e);
        }
      };
      registerMyself();

      heartbeatInterval = setInterval(registerMyself, 30000);

      handleBeforeUnload = () => {
        deleteDoc(doc(ganttDb, "ganttcraft_collaborators", activeId)).catch(console.error);
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // Subscribe to Firestore collections
        const unsubscribeProjects = onSnapshot(collection(ganttDb, "ganttcraft_projects"), (snapshot) => {
      const projs: Project[] = [];
      snapshot.forEach((doc) => {
        projs.push(doc.data() as Project);
      });
      setProjects(projs);
      
      if (projs.length > 0 && !projs.some(p => p.id === currentProjectId)) {
        setCurrentProjectId(projs.find(p => p.id === 'shumei')?.id || projs[0].id);
      } else if (projs.length === 0) {
        // Auto-create 'shumei' project if the database is completely empty
        const newProj = {
          id: 'shumei',
          name: 'Shumei 排班系統',
          ownerId: currentUserId || 'guest',
          createdAt: Date.now(),
          tasks: [],
          teams: [],
          events: [],
          members: [] // GanttCraft legacy members field
        };
        setDoc(doc(ganttDb, "ganttcraft_projects", "shumei"), newProj).catch(e => console.error("Failed to auto-create project", e));
      }
      setIsConnecting(false);
    }, (error) => {
      console.warn("Firestore projects listen error", error);
      setIsConnecting(false);
    });

    const unsubscribeMembers = onSnapshot(collection(db, "member"), (snapshot) => {
      const mems: any[] = [];
      snapshot.forEach((doc) => {
        mems.push({ id: doc.id, ...doc.data() });
      });
      setMembers(mems);
    });

    const unsubscribeLeaders = onSnapshot(doc(db, "info", "youth"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("info/youth data:", data);
        if (data.leader) {
          const ldrArray = Array.isArray(data.leader) ? data.leader : [data.leader];
          setLeaders(ldrArray);
          setSelectedLeader(prev => prev || ldrArray[0]);
        } else {
          setLeaders(["[錯誤] 沒有 leader 欄位"]);
        }
      } else {
        setLeaders(["[錯誤] 找不到 youth 文件"]);
      }
    }, (error) => {
      console.error("Firebase info/youth Error:", error);
      setLeaders(["[權限錯誤] " + error.message]);
    });

    const unsubscribeActivities = onSnapshot(collection(ganttDb, "ganttcraft_activities"), (snapshot) => {
      const acts: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        acts.push(doc.data() as ActivityLog);
      });
      acts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(acts);
    });

    const unsubscribeCollaborators = onSnapshot(collection(ganttDb, "ganttcraft_collaborators"), (snapshot) => {
      const collabs: Collaborator[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data() as Collaborator;
        if (data.lastActive && (now - data.lastActive < 60000)) {
          collabs.push(data);
        }
      });
      setCollaborators(collabs);
    });

    // Notes & Board elements for Whiteboard tab
    const unsubscribeNotes = onSnapshot(collection(ganttDb, "ganttcraft_notes"), (snapshot) => {
      const notesArr: StickyNote[] = [];
      snapshot.forEach((doc) => {
        notesArr.push(doc.data() as StickyNote);
      });
      setNotes(notesArr);
    });

    const unsubscribeConnections = onSnapshot(collection(ganttDb, "ganttcraft_connections"), (snapshot) => {
      const connArr: NoteConnection[] = [];
      snapshot.forEach((doc) => {
        connArr.push(doc.data() as NoteConnection);
      });
      setConnections(connArr);
    });

    const unsubscribeShapes = onSnapshot(collection(ganttDb, "ganttcraft_shapes"), (snapshot) => {
      const shapeArr: BoardShape[] = [];
      snapshot.forEach((doc) => {
        shapeArr.push(doc.data() as BoardShape);
      });
      setShapes(shapeArr);
    });

    return () => {
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeActivities) unsubscribeActivities();
      if (unsubscribeCollaborators) unsubscribeCollaborators();
      if (unsubscribeNotes) unsubscribeNotes();
      if (unsubscribeConnections) unsubscribeConnections();
      if (unsubscribeShapes) unsubscribeShapes();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (handleBeforeUnload) window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentProjectId]);

  // Extract Active Project details
    const activeProject = useMemo(() => {
    const p = projects.find((p) => p.id === currentProjectId) || projects[0] || null;
    if (p) {
      const filteredStaffs = members.filter(m => m.leader === selectedLeader);
      return { ...p, shumeiStaff: filteredStaffs };
    }
    return null;
  }, [projects, currentProjectId, members, selectedLeader]);

  const activeProjectTasks = useMemo(() => {
    return activeProject?.tasks || [];
  }, [activeProject]);

  const displayTasks = useMemo(() => {
    if (activeTab === "team" && selectedTeamId !== "all") {
      return activeProjectTasks.filter((t) => t.teamId === selectedTeamId);
    }
    return activeProjectTasks;
  }, [activeProjectTasks, activeTab, selectedTeamId]);

  const isLeader = useMemo(() => {
    if (!activeProject || !currentUserId) return false;
    return activeProject.ownerId === currentUserId;
  }, [activeProject, currentUserId]);

  const isGuest = useMemo(() => {
    const myself = collaborators.find(c => c.id === currentUserId);
    return myself?.role === "guest" || currentUserId.startsWith("guest_");
  }, [collaborators, currentUserId]);

  // Log action to activity list
  const logUserActivity = async (action: string) => {
    if (!activeProject) return;
    const myself = collaborators.find(c => c.id === currentUserId);
    const userName = myself ? myself.name : "協同經理";

    await addDoc(collection(ganttDb, "ganttcraft_activities"), {
      id: `act_${Date.now()}`,
      user: userName,
      action,
      timestamp: new Date().toISOString(),
      projectId: activeProject.id,
      platform: "web"
    }).catch(console.error);
  };

  // --- Workspace Modification Handlers ---
  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!activeProject) return;
    try {
      await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), updates);
    } catch (err) {
      console.error("Firebase update failed:", err);
    }
  };

  // Update collaborator profile info
  const handleChangeUser = async (userId: string, name: string, avatar: string, color: string) => {
    if (googleUser && googleUser.id === userId) {
      const u = { ...googleUser, name, avatar, color };
      setGoogleUser(u);
      localStorage.setItem("gantt_google_user", JSON.stringify(u));
    } else {
      const guestStr = localStorage.getItem("gantt_guest_user");
      if (guestStr) {
        try {
          const u = JSON.parse(guestStr);
          if (u.id === userId) {
             const newU = { ...u, name, avatar, color };
             localStorage.setItem("gantt_guest_user", JSON.stringify(newU));
          }
        } catch(e) {}
      }
    }

    try {
      await setDoc(doc(ganttDb, "ganttcraft_collaborators", userId), {
        id: userId,
        name,
        avatar,
        color,
        status: "viewing"
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinProjectWithCode = async (trimmedCode: string): Promise<{ success: boolean; message: string }> => {
    if (!/^\d{4}$/.test(trimmedCode)) {
      return { success: false, message: "代碼格式不正確，必須是 4 位數字。" };
    }

    try {
      const q = query(
        collection(ganttDb, "ganttcraft_projects"),
        where("joinCode", "==", trimmedCode),
        where("isOpenToJoin", "==", true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return { success: false, message: "找不到此代碼對應的專案，或是該專案目前未開放加入！" };
      }

      const projDoc = querySnapshot.docs[0];
      const projData = projDoc.data() as Project;

      if (projData.ownerId === currentUserId || (projData.members && projData.members.includes(currentUserId))) {
        setCurrentProjectId(projData.id);
        return { success: true, message: `您已經是專案「${projData.name}」的成員！` };
      }

      const updatedMembers = [...(projData.members || []), currentUserId];
      await updateDoc(doc(ganttDb, "ganttcraft_projects", projDoc.id), {
        members: updatedMembers
      });

      setCurrentProjectId(projDoc.id);
      logUserActivity(`透過加入代碼加入了專案「${projData.name}」`);
      return { success: true, message: `成功加入專案「${projData.name}」！` };
    } catch (e) {
      console.error(e);
      return { success: false, message: "加入專案失敗，請檢測連線狀態。" };
    }
  };

  const handleCreateProject = async (name: string, description: string) => {
    try {
      const newId = `proj_${Date.now()}`;
      const newProject: Project = {
        id: newId,
        name,
        description: description || "",
        tasks: [],
        workingDays: [1, 2, 3, 4, 5],
        holidays: [],
        ownerId: currentUserId
      };
      await setDoc(doc(ganttDb, "ganttcraft_projects", newId), newProject);
      setCurrentProjectId(newId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (
    workingDays: number[], 
    holidays: string[], 
    name?: string, 
    description?: string,
    isOpenToJoin?: boolean,
    joinCode?: string,
    members?: string[]
  ) => {
    const latestActiveProject = projectsRef.current.find(p => p.id === currentProjectId) || projectsRef.current[0];
    if (!latestActiveProject) return;
    try {
      const updateData: any = { workingDays, holidays };
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isOpenToJoin !== undefined) updateData.isOpenToJoin = isOpenToJoin;
      if (joinCode !== undefined) updateData.joinCode = joinCode;
      if (members !== undefined) updateData.members = members;

      await updateDoc(doc(ganttDb, "ganttcraft_projects", latestActiveProject.id), updateData);
    } catch (e) {
      console.error(e);
      alert("更新設定失敗，請檢測連線狀態");
    }
  };

  const handleDeleteProject = async () => {
    const latestActiveProject = projectsRef.current.find(p => p.id === currentProjectId) || projectsRef.current[0];
    if (!latestActiveProject) return;
    try {
      await deleteDoc(doc(ganttDb, "ganttcraft_projects", latestActiveProject.id));
      const remainingProjects = projects.filter(p => p.id !== currentProjectId);
      if (remainingProjects.length > 0) {
        setCurrentProjectId(remainingProjects[0].id);
      } else {
        setCurrentProjectId("project-1");
      }
      setShowProjectSettings(false);
      setSelectedTask(null);
    } catch (e) {
      console.error(e);
      alert("刪除專案失敗，請檢測連線狀態");
    }
  };

  const handlePlanGenerated = async (tasks: Task[]) => {
    setSelectedTask(null);
  };

  const handleAddTask = async (title: string, parentId: string | null, status?: "pending" | "in_progress" | "completed") => {
    const latestActiveProject = projectsRef.current.find(p => p.id === currentProjectId) || projectsRef.current[0];
    if (!latestActiveProject) return;
    const myself = collaborators.find(c => c.id === currentUserId);
    const userName = myself ? myself.name : "協同經理";

    const startDate = "2026-06-05";
    const endDate = "2026-06-12";
    const initialProgress = status === "completed" ? 100 : status === "in_progress" ? 50 : 0;
    
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      startDate,
      endDate,
      progress: initialProgress,
      dependencies: [],
      parentId: parentId || null,
      assignee: userName,
      status: status || "pending"
    };

    try {
      const existingTasks = Array.isArray(latestActiveProject.tasks) ? latestActiveProject.tasks : [];
      const updatedTasks = [...existingTasks, newTask];
      await updateDoc(doc(ganttDb, "ganttcraft_projects", latestActiveProject.id), {
        tasks: updatedTasks
      });
      logUserActivity(`手動建立了新任務「${title}」`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTask = async (taskId: string, partial: Partial<Task>) => {
    if (!activeProject) return;
    const updatedTasks = activeProject.tasks.map((t) => (t.id === taskId ? { ...t, ...partial } : t));
    await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), {
      tasks: updatedTasks
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject) return;
    const t = activeProject.tasks.find((x) => x.id === taskId);
    const updatedTasks = activeProject.tasks.filter((t) => t.id !== taskId);
    await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), {
      tasks: updatedTasks
    });
    if (t) logUserActivity(`刪除了任務「${t.title}」`);
  };

  const handleReorderTasks = async (reordered: Task[]) => {
    if (!activeProject) return;
    await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), {
      tasks: reordered
    });
  };

  const handleAddEvent = async (event: TimelineEvent) => {
    if (!activeProject) return;
    const events = activeProject.events || [];
    await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), {
      events: [...events, event]
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!activeProject) return;
    const events = activeProject.events || [];
    await updateDoc(doc(ganttDb, "ganttcraft_projects", activeProject.id), {
      events: events.filter((e) => e.id !== eventId)
    });
  };

  // Guest login setup
  const [guestName, setGuestName] = useState("");
  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      await signInAnonymously(auth);
    } catch (authErr) {
      console.warn("Firebase Anonymous Auth not enabled or failed:", authErr);
    }

    const guestId = `guest_${Date.now()}`;
    const guestUser = {
      id: guestId,
      name: guestName.trim(),
      avatar: "👤",
      color: "bg-slate-500",
      role: "guest"
    };

    localStorage.setItem("gantt_guest_user", JSON.stringify(guestUser));
    setCurrentUserId(guestId);
    setIsAuthenticated(true);
    
    // Register to active collaborators
    await setDoc(doc(ganttDb, "ganttcraft_collaborators", guestId), {
      ...guestUser,
      status: "viewing",
      role: "guest",
      lastActive: Date.now()
    });
  };

  // Real Google Login
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const u = {
        id: user.uid,
        name: user.displayName || "Google 用戶",
        email: user.email || "",
        avatar: user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c",
        color: "bg-teal-500",
        picture: user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c"
      };
      
      localStorage.setItem("gantt_google_user", JSON.stringify(u));
      setGoogleUser(u);
      setCurrentUserId(user.uid);
      setIsAuthenticated(true);

      await setDoc(doc(ganttDb, "ganttcraft_collaborators", user.uid), {
        id: user.uid,
        name: u.name,
        avatar: u.picture,
        color: u.color,
        status: "viewing",
        lastActive: Date.now()
      });
    } catch (err) {
      console.error("Google login failed:", err);
      alert("Google 登入失敗：" + (err as Error).message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("gantt_google_user");
    localStorage.removeItem("gantt_guest_user");
    setGoogleUser(null);
    setCurrentUserId("");
    setIsAuthenticated(false);
  };

  // Spring transition presets for global interactivity rules
  const springTransition = { type: "spring" as const, stiffness: 150, damping: 12 };

  // Loading animation overlay
  if (isConnecting) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-slate-950">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-indigo-500/10 animate-pulse"></div>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-400 skeleton-shimmer bg-clip-text text-transparent">
          正在連接 Shumei 雲端即時伺服器...
        </p>
      </div>
    );
  }

  // Login dialog if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-stone-50 dark:bg-slate-950 p-4 noise-overlay">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springTransition}
          className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 border border-black/10 dark:border-white/10 p-6 rounded-2xl shadow-2xl backdrop-blur-2xl glass-panel relative z-10"
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CalendarRange className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold font-display tracking-wide bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Shumei Drag Scheduling
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              即時協同拖曳排程管理系統
            </p>
          </div>

          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                以訪客身分登入名稱
              </label>
              <input
                required
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="例如：王小明..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/10 hover:bg-indigo-500 active-glow-effect hover-spring-effect cursor-pointer"
            >
              進入訪客專案
            </button>
          </form>

          <div className="relative my-6 text-center shrink-0">
            <span className="relative z-10 px-3 bg-white dark:bg-slate-900 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              或
            </span>
            <div className="absolute top-1/2 left-0 w-full border-t border-black/10 dark:border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-2 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 active-glow-effect hover-spring-effect cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            使用 Google 帳號登入
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-[#020617] font-sans">
      
      {/* 1. Header Navigation bar */}
      <header className="h-16 px-4 bg-white/60 dark:bg-slate-900/60 border-b border-black/5 dark:border-white/5 flex items-center justify-between shrink-0 relative z-40 overflow-x-auto no-scrollbar gap-4">
        
        {/* Left Brand & Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <AppNavigator />
          <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 hidden sm:block"></div>

          {/* Leader Picker dropdown */}
          <div className="flex items-center gap-1.5" data-tour="project-picker">
            <select
              value={selectedLeader}
              onChange={(e) => setSelectedLeader(e.target.value)}
              className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[120px] sm:max-w-[150px] truncate shrink-0 cursor-pointer"
            >
              {leaders.map((ldr) => (
                <option key={ldr} value={ldr} className="bg-white dark:bg-slate-900">
                  {ldr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Middle Mode Toggles */}
        <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-0.5 lg:p-1 rounded-xl shrink-0" data-tour="view-modes">
          <button
            onClick={() => { setViewMode("simplified"); setSelectedTask(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              viewMode === "simplified" ? "bg-purple-500 text-white shadow shadow-purple-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> 排程
          </button>
          <button
            onClick={() => { setViewMode("kanban"); setSelectedTask(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              viewMode === "kanban" ? "bg-indigo-500 text-white shadow shadow-indigo-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> 狀態概況
          </button>
          <button
            onClick={() => { setViewMode("ideation"); setSelectedTask(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              viewMode === "ideation" ? "bg-fuchsia-600 text-white shadow shadow-fuchsia-600/20" : "text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> 留言板
          </button>
        </div>

        {/* Right Profiles & Theme Toggle */}
        <div className="flex items-center gap-2 relative z-10 shrink-0">
          
          {/* Profile Panel */}
          <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm border border-black/5 dark:border-white/5 pl-1.5 pr-2 py-1 rounded-lg shadow-inner relative">
            <button 
              onClick={() => setShowGoogleDetails(!showGoogleDetails)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              {(() => {
                const myself = collaborators.find(c => c.id === currentUserId);
                const displayAvatar = myself?.avatar || googleUser?.avatar || "👤";
                const displayColor = myself?.color || "bg-emerald-500";
                
                if (displayAvatar.startsWith("http")) {
                  return (
                    <div className="relative">
                      <img 
                        src={displayAvatar} 
                        alt={myself?.name || googleUser?.name || "User"} 
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-black/20 dark:border-white/20" 
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${displayColor} border-2 border-white dark:border-slate-900 rounded-full`}></span>
                    </div>
                  );
                }
                return (
                  <div className="relative">
                    <span className={`w-8 h-8 rounded-full ${displayColor} text-white font-bold flex items-center justify-center text-sm shadow-sm`}>
                      {displayAvatar}
                    </span>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${displayColor} border-2 border-white dark:border-slate-900 rounded-full brightness-110`}></span>
                  </div>
                );
              })()}
            </button>

            {/* Collapsible expanded Profile & Online Members card */}
            {showGoogleDetails && (
              <div className="absolute right-0 top-12 w-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-2xl z-[100] backdrop-blur-md flex flex-col gap-4">
                <OnlineMembers 
                  collaborators={collaborators}
                  currentUserId={currentUserId}
                  onChangeUser={handleChangeUser}
                  googlePicture={googleUser?.picture}
                />
              </div>
            )}
          </div>

          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer active-glow-effect hover:scale-105 transition-transform text-slate-500 dark:text-slate-400"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>



          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer active-glow-effect hover:scale-105 transition-transform text-slate-500 dark:text-slate-400"
            title="登出"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Workspace screen layout */}
      <main className="flex-1 flex min-h-0 relative z-10 p-4 gap-4">
        
        {/* Core content switchboard */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          
          <AnimatePresence mode="wait">
            {activeProject ? (
              <motion.div
                key={`${currentProjectId}_${viewMode}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {viewMode === "simplified" ? (
                  // Custom Shumei Scheduler Mode
                  <div className="flex-1 flex flex-col min-h-0 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-stone-50 dark:bg-[#0a0c14]">
                    <ErrorBoundary>
                      <ShumeiScheduler
                        project={activeProject}
                        onUpdateProject={handleUpdateProject}
                        currentUserId={currentUserId}
                        readOnly={isGuest}
                      />
                    </ErrorBoundary>
                  </div>
                ) : viewMode === "kanban" ? (
                  // Shumei Status Board View
                  <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl bg-stone-50 dark:bg-[#0a0c14]">
                    <ErrorBoundary>
                      <ShumeiStatusBoard project={activeProject} />
                    </ErrorBoundary>
                  </div>
                ) : (
                  // Ideation Board (representing the "留言板" comment wall)
                  <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl bg-stone-50 dark:bg-[#0a0c14]">
                    <ErrorBoundary>
                      <IdeationBoard
                        projectId={currentProjectId}
                        notes={notes}
                        connections={connections}
                        shapes={shapes}
                        currentUserId={currentUserId}
                        collaborators={collaborators}
                        teamId={activeTab === "team" ? selectedTeamId : "leader"}
                        teams={activeProject?.teams || []}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                正在尋找專案...
              </div>
            )}
          </AnimatePresence>

          {/* Sync Connection Toast status bar */}
          <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-md rounded-2xl p-4 gap-3 text-xs mt-4 select-none">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                Shumei 雲端即時同步中 • 共有 <b className="text-slate-900 dark:text-white font-bold">{collaborators.length}</b> 位排程員同時在線
              </span>
            </div>
            {activities.length > 0 && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[11px] max-w-sm truncate">
                <span className="bg-slate-100 dark:bg-slate-800 border border-black/5 dark:border-white/5 px-2 py-0.5 rounded text-[8.5px] uppercase font-mono tracking-wider text-slate-600 dark:text-slate-400">
                  {activities[0].platform}
                </span>
                <span><b>@{activities[0].user}</b> {activities[0].action}</span>
              </div>
            )}
          </div>
        </div>


      </main>

      {/* --- EXTRA DIALOG MODALS --- */}
      {showProjectSettings && activeProject && !isGuest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md" onClick={() => setShowProjectSettings(false)}></div>
          <div className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900">
            <ProjectSettings
              project={activeProject}
              collaborators={collaborators}
              onSaveSettings={handleSaveSettings}
              onDeleteProject={handleDeleteProject}
              onClose={() => setShowProjectSettings(false)}
              onPlanGenerated={handlePlanGenerated}
              userName={collaborators.find(c => c.id === currentUserId)?.name || "主管"}
              isLeader={isLeader}
            />
          </div>
        </div>
      )}

      <JoinProjectModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinProjectWithCode}
      />

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onCreate={(name, desc) => handleCreateProject(name, desc)}
      />
    </div>
  );
}
