/**
 * unified-nav.js - 秀明青年全站統一導覽與權限角色分流組件
 * 
 * 核心功能：
 * 1. 嚴格角色區隔：
 *    - 一般信徒 (member)：僅可瀏覽個人專區、淨靈打卡、活動與自然農法；嚴格隔離幹部管理介面。
 *    - 幹部小組長 (leader)：統一擁有「總覽、名單、分組、座談會、研修、更多」核心操作列。
 * 2. 路由守衛 (Route Guard)：防止一般信徒誤入「研修排班大表」或「成員名單/座談會管理」。
 * 3. 跨頁面 100% 統一：手機底部導覽列與桌面上方導覽列在全站各頁面保持一致。
 */

(function () {
  'use strict';

  window.__SHUMEI_UNIFIED_NAV_LOADED__ = true;

  // 幹部專屬管理頁面路徑 (一般信徒不可存取)
  const CADRE_EXCLUSIVE_PATHS = [
    '/youth/dashboard.html',
    '/youth/admin.html',
    '/youth/list.html',
    '/youth/group.html',
    '/youth/seminar.html',
    '/youth/lineage.html',
    '/youth/cadres.html',
    '/activities/training.html',
    '/scheduling/front.html',
    '/scheduling/'
  ];

  // 1. 角色判斷
  function isLeaderUser() {
    const isAuth = sessionStorage.getItem('SHUMEI_LEADER_AUTH') === 'true';
    const role = localStorage.getItem('SHUMEI_USER_ROLE');
    return isAuth || role === 'leader';
  }

  // 2. 權限守衛攔截 (防止一般信徒看到研修大表、名單等幹部畫面)
  function enforceRouteGuard() {
    const currentPath = window.location.pathname.toLowerCase();

    // 登入頁、公開展示頁免攔截
    if (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/index.html') && !currentPath.includes('/member/') && !currentPath.includes('/scheduling/')) {
      return;
    }

    const isCadrePage = CADRE_EXCLUSIVE_PATHS.some(p => currentPath.includes(p.toLowerCase()));

    if (isCadrePage && !isLeaderUser()) {
      const userRole = localStorage.getItem('SHUMEI_USER_ROLE');
      console.warn('[UnifiedNav] 偵測到一般信徒或未授權訪客存取幹部管理頁面:', currentPath);
      if (userRole === 'member') {
        window.location.replace('/member/index.html');
      } else {
        window.location.replace('/index.html');
      }
      return;
    }
  }

  // 執行即時守衛
  enforceRouteGuard();

  // 3. 通用全域登出函式
  window.globalSignOut = function () {
    if (confirm("確定要登出系統嗎？")) {
      sessionStorage.removeItem('SHUMEI_LEADER_AUTH');
      localStorage.removeItem('SHUMEI_USER_ROLE');
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().signOut().finally(() => {
            window.location.href = '/index.html';
          });
          return;
        }
      } catch (e) {
        console.warn("[UnifiedNav] Firebase Auth 登出異常:", e);
      }
      window.location.href = '/index.html';
    }
  };
  window.signOut = window.globalSignOut;
  window.handleSignOut = window.globalSignOut;

  // 4. SVG 圖示庫
  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
    adminList: '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
    group: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    seminar: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>',
    training: '<svg viewBox="0 0 24 24"><path d="M19.36 10.04l-7.36-7.36-7.36 7.36 1.41 1.41L11 6.41V20h2V6.41l5.05 5.04z"/></svg>',
    jyorei: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>',
    events: '<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>',
    farm: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    lineage: '<svg viewBox="0 0 24 24"><path d="M16 11c1.5 0 2.79-1.02 3-2.39L22.5 12 19 15.39c-.21-1.37-1.5-2.39-3-2.39-1.66 0-3 1.34-3 3s1.34 3 3 3c1.37 0 2.53-.93 2.87-2.18L24 12l-5.13-4.82C18.53 5.93 17.37 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z"/></svg>',
    cadres: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>'
  };

  // 5. 渲染統一導覽列
  function renderUnifiedNavigation() {
    const currentPath = window.location.pathname.toLowerCase();

    // 登入頁不需要導覽列
    if (currentPath === '/' || currentPath === '/index.html' || (currentPath.endsWith('/index.html') && !currentPath.includes('/member/') && !currentPath.includes('/scheduling/'))) {
      return;
    }

    const isLeader = isLeaderUser();

    // 移除舊的現存 bottom-nav 以防衝突
    document.querySelectorAll('.bottom-nav').forEach(el => el.remove());

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav unified-bottom-nav';
    nav.id = 'unified-bottom-nav';

    if (isLeader) {
      // ==========================================
      // 【幹部小組長模式】統一 6 核心標籤
      // ==========================================
      const isDashboard = currentPath.includes('/youth/dashboard.html');
      const isAdmin = currentPath.includes('/youth/admin.html') || currentPath.includes('/youth/list.html');
      const isGroup = currentPath.includes('/youth/group.html');
      const isSeminar = currentPath.includes('/youth/seminar.html');
      const isTraining = currentPath.includes('/activities/training.html');
      const isMoreActive = currentPath.includes('/youth/cadres.html') || currentPath.includes('/youth/lineage.html') || currentPath.includes('/scheduling/front.html');

      nav.innerHTML = `
        <a href="/youth/dashboard.html" class="bottom-nav-item ${isDashboard ? 'active' : ''}">
          ${ICONS.dashboard}
          <span>總覽</span>
        </a>
        <a href="/youth/admin.html" class="bottom-nav-item ${isAdmin ? 'active' : ''}">
          ${ICONS.adminList}
          <span>名單</span>
        </a>
        <a href="/youth/group.html" class="bottom-nav-item ${isGroup ? 'active' : ''}">
          ${ICONS.group}
          <span>分組</span>
        </a>
        <a href="/youth/seminar.html" class="bottom-nav-item ${isSeminar ? 'active' : ''}">
          ${ICONS.seminar}
          <span>座談會</span>
        </a>
        <a href="/activities/training.html" class="bottom-nav-item ${isTraining ? 'active' : ''}">
          ${ICONS.training}
          <span>研修</span>
        </a>
        <button type="button" class="bottom-nav-item ${isMoreActive ? 'active' : ''}" onclick="openCadreMoreModal()">
          ${ICONS.more}
          <span>更多</span>
        </button>
      `;

      // 注入幹部「更多服務」彈窗
      injectCadreMoreModal();

      // 更新桌面上方 Header 選單（若存在）
      updateDesktopHeaderNav(true, currentPath);

    } else {
      // ==========================================
      // 【一般信徒模式】統一 5 項生活與信仰標籤
      // ==========================================
      const isMemberHome = currentPath.includes('/member/index.html') || currentPath.includes('/member/');
      const isJyorei = currentPath.includes('/activities/jyorei.html');
      const isEvents = currentPath.includes('/activities/events.html');
      const isFarm = currentPath.includes('/farm/natural-farm.html') || currentPath.includes('/natural-farm.html');

      nav.innerHTML = `
        <a href="/member/index.html" class="bottom-nav-item ${isMemberHome ? 'active' : ''}">
          ${ICONS.home}
          <span>專區</span>
        </a>
        <a href="/activities/jyorei.html" class="bottom-nav-item ${isJyorei ? 'active' : ''}">
          ${ICONS.jyorei}
          <span>淨靈</span>
        </a>
        <a href="/activities/events.html" class="bottom-nav-item ${isEvents ? 'active' : ''}">
          ${ICONS.events}
          <span>活動</span>
        </a>
        <a href="/farm/natural-farm.html" class="bottom-nav-item ${isFarm ? 'active' : ''}" style="color: ${isFarm ? '#52b788' : ''};">
          ${ICONS.farm}
          <span>農法</span>
        </a>
        <button type="button" class="bottom-nav-item" onclick="globalSignOut()">
          ${ICONS.logout}
          <span>登出</span>
        </button>
      `;

      // 更新桌面上方 Header 選單
      updateDesktopHeaderNav(false, currentPath);
    }

    document.body.appendChild(nav);
    attachInstantAppNavigation(nav);
  }

  // 6. 更新桌面上方 Header 導覽列
  function updateDesktopHeaderNav(isLeader, currentPath) {
    const desktopNav = document.querySelector('.app-header-nav.desktop-only');
    if (!desktopNav) return;

    if (isLeader) {
      desktopNav.innerHTML = `
        <a href="/youth/dashboard.html" class="bottom-nav-item ${currentPath.includes('dashboard') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">總覽</a>
        <a href="/youth/admin.html" class="bottom-nav-item ${currentPath.includes('admin') || currentPath.includes('list.html') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">名單</a>
        <a href="/youth/cadres.html" class="bottom-nav-item ${currentPath.includes('cadres') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">幹部綁定</a>
        <a href="/youth/group.html" class="bottom-nav-item ${currentPath.includes('group') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">分組</a>
        <a href="/youth/seminar.html" class="bottom-nav-item ${currentPath.includes('seminar') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">座談會</a>
        <a href="/youth/lineage.html" class="bottom-nav-item ${currentPath.includes('lineage') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">靈線</a>
        <a href="/activities/training.html" class="bottom-nav-item ${currentPath.includes('training') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">研修排班</a>
        <a href="/activities/events.html" class="bottom-nav-item ${currentPath.includes('events') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">活動發布</a>
        <a href="/farm/natural-farm.html" class="bottom-nav-item ${currentPath.includes('natural-farm') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px; color: #52b788; font-weight: 600;">🌾 自然農法</a>
        <button onclick="globalSignOut()" class="bottom-nav-item" style="flex: none; flex-direction: row; gap: 4px; background: none; border: none;">登出</button>
      `;
    } else {
      desktopNav.innerHTML = `
        <a href="/member/index.html" class="bottom-nav-item ${currentPath.includes('/member/') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">個人專區</a>
        <a href="/activities/jyorei.html" class="bottom-nav-item ${currentPath.includes('jyorei') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">淨靈打卡</a>
        <a href="/activities/events.html" class="bottom-nav-item ${currentPath.includes('events') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px;">活動集會</a>
        <a href="/farm/natural-farm.html" class="bottom-nav-item ${currentPath.includes('natural-farm') ? 'active' : ''}" style="flex: none; flex-direction: row; gap: 4px; color: #52b788; font-weight: 600;">🌾 自然農法</a>
        <button onclick="globalSignOut()" class="bottom-nav-item" style="flex: none; flex-direction: row; gap: 4px; background: none; border: none;">登出</button>
      `;
    }
    attachInstantAppNavigation(desktopNav);
  }

  // 7. 注入幹部專用「更多功能」抽屜/彈窗
  function injectCadreMoreModal() {
    if (document.getElementById('cadreMoreModal')) return;

    const modalHtml = `
      <div id="cadreMoreModal" class="cadre-more-overlay" style="display: none;" onclick="closeCadreMoreModal(event)">
        <div class="cadre-more-sheet glass-card" onclick="event.stopPropagation()">
          <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
            <h5 class="fs-6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
              <span style="color: #00F3FF;">⚡</span> 幹部進階管理與服務
            </h5>
            <button type="button" class="btn-close btn-close-white btn-sm" onclick="closeCadreMoreModal()"></button>
          </div>
          
          <div class="cadre-more-grid">
            <a href="/youth/cadres.html" class="cadre-more-item">
              <span class="icon">🏷️</span>
              <span class="title">幹部綁定</span>
              <span class="desc">LINE 帳號與角色</span>
            </a>
            <a href="/youth/lineage.html" class="cadre-more-item">
              <span class="icon">🌿</span>
              <span class="title">靈線關係圖</span>
              <span class="desc">引導人樹狀脈絡</span>
            </a>
            <a href="/activities/events.html" class="cadre-more-item">
              <span class="icon">📋</span>
              <span class="title">青年活動發布</span>
              <span class="desc">集會與通告發送</span>
            </a>
            <a href="/scheduling/front.html" class="cadre-more-item">
              <span class="icon">🛎️</span>
              <span class="title">現場自助櫃檯</span>
              <span class="desc">青年快速報到台</span>
            </a>
            <a href="/activities/jyorei.html" class="cadre-more-item">
              <span class="icon">☀️</span>
              <span class="title">淨靈打卡</span>
              <span class="desc">御光守護實踐紀錄</span>
            </a>
            <a href="/farm/natural-farm.html" class="cadre-more-item">
              <span class="icon">🌾</span>
              <span class="title">自然農法專區</span>
              <span class="desc">市集與農法日誌</span>
            </a>
            <a href="/member/index.html" class="cadre-more-item" style="border-color: rgba(16, 185, 129, 0.4);">
              <span class="icon">👤</span>
              <span class="title" style="color: #34d399;">個人專區視角</span>
              <span class="desc">切換一般信徒頁面</span>
            </a>
            <button type="button" class="cadre-more-item" onclick="globalSignOut()" style="border-color: rgba(239, 68, 68, 0.4); text-align: left;">
              <span class="icon">🚪</span>
              <span class="title" style="color: #f87171;">登出系統</span>
              <span class="desc">安全退出管理工作</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('cadreMoreModal');
    if (modalEl) attachInstantAppNavigation(modalEl);
  }

  // 8. 彈窗開啟/關閉控制
  window.openCadreMoreModal = function () {
    const el = document.getElementById('cadreMoreModal');
    if (el) {
      el.style.display = 'flex';
      setTimeout(() => el.classList.add('show'), 10);
    }
  };

  window.closeCadreMoreModal = function (e) {
    if (e && e.target && e.target.id !== 'cadreMoreModal' && !e.target.classList.contains('btn-close')) {
      return;
    }
    const el = document.getElementById('cadreMoreModal');
    if (el) {
      el.classList.remove('show');
      setTimeout(() => { el.style.display = 'none'; }, 200);
    }
  };

  // 9. 注入必要樣式 (Apple 最新 VisionOS / iOS 18 懸浮膠囊島磨砂玻璃 Liquid Glass 規範)
  function injectNavStyles() {
    if (document.getElementById('unified-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'unified-nav-style';
    style.innerHTML = `
      /* 蘋果最新懸浮膠囊島導覽列 (Apple Floating Glass Dock) */
      .unified-bottom-nav {
        position: fixed !important;
        bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
        left: 14px !important;
        right: 14px !important;
        width: calc(100% - 28px) !important;
        max-width: 480px !important;
        margin: 0 auto !important;
        height: 64px !important;
        border-radius: 32px !important;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.18) 0%,
          rgba(255, 255, 255, 0.06) 35%,
          rgba(10, 16, 32, 0.76) 100%
        ) !important;
        backdrop-filter: blur(28px) saturate(210%) contrast(108%) brightness(1.08) !important;
        -webkit-backdrop-filter: blur(28px) saturate(210%) contrast(108%) brightness(1.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.58) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
        display: flex !important;
        justify-content: space-around !important;
        align-items: center !important;
        padding: 6px 8px !important;
        z-index: 1050 !important;
        box-shadow:
          0 20px 48px -10px rgba(0, 0, 0, 0.72),
          0 8px 18px -4px rgba(0, 0, 0, 0.45),
          inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.7),
          inset 0 -1px 2px 0 rgba(0, 0, 0, 0.45),
          0 0 24px rgba(0, 243, 255, 0.16) !important;
        overflow: hidden !important;
      }

      /* 2% 噪點質感知覺紋理疊加 (Apple Sandblasted Optical Texture) */
      .unified-bottom-nav::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.035"/></svg>');
        border-radius: inherit;
        pointer-events: none;
        z-index: 0;
        mix-blend-mode: overlay;
      }

      .unified-bottom-nav .bottom-nav-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        color: rgba(255, 255, 255, 0.62) !important;
        text-decoration: none !important;
        font-size: clamp(10px, 2.7vw, 11px) !important;
        font-weight: 500 !important;
        letter-spacing: -0.2px !important;
        flex: 1 !important;
        height: 52px !important;
        padding: 3px 2px !important;
        margin: 0 1.5px !important;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        cursor: pointer !important;
        border-radius: 20px !important;
        position: relative !important;
        z-index: 1 !important;
        animation: navItemFadeIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
      }

      .unified-bottom-nav .bottom-nav-item:nth-child(1) { animation-delay: 40ms; }
      .unified-bottom-nav .bottom-nav-item:nth-child(2) { animation-delay: 80ms; }
      .unified-bottom-nav .bottom-nav-item:nth-child(3) { animation-delay: 120ms; }
      .unified-bottom-nav .bottom-nav-item:nth-child(4) { animation-delay: 160ms; }
      .unified-bottom-nav .bottom-nav-item:nth-child(5) { animation-delay: 200ms; }
      .unified-bottom-nav .bottom-nav-item:nth-child(6) { animation-delay: 240ms; }

      @keyframes navItemFadeIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.92);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .unified-bottom-nav .bottom-nav-item svg {
        width: 22px !important;
        height: 22px !important;
        margin-bottom: 2px !important;
        fill: currentColor !important;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s ease !important;
      }

      /* Hover Effect: Scale 1.02, Shadow spread +8px (soft), Physics-Spring(150, 12) */
      .unified-bottom-nav .bottom-nav-item:hover {
        transform: translateY(-2px) scale(1.02) !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.16) !important;
        box-shadow: 0 4px 16px rgba(0, 243, 255, 0.18) !important;
        color: #ffffff !important;
      }

      /* Active State: Scale 0.98, Brightness +10%, Border #00F3FF, Glow-radius 10px */
      .unified-bottom-nav .bottom-nav-item:active {
        transform: scale(0.95) !important;
        filter: brightness(1.15) !important;
        border-color: #00F3FF !important;
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.7) !important;
      }

      /* Apple Active Micro-Capsule Indicator (蘋果微膠囊背光指示器) */
      .unified-bottom-nav .bottom-nav-item.active {
        color: #00F3FF !important;
        font-weight: 700 !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border: 1px solid rgba(0, 243, 255, 0.4) !important;
        border-radius: 20px !important;
        box-shadow:
          0 2px 10px rgba(0, 243, 255, 0.28),
          inset 0 1px 1px rgba(255, 255, 255, 0.5),
          inset 0 -1px 1px rgba(0, 0, 0, 0.25) !important;
      }

      .unified-bottom-nav .bottom-nav-item.active svg {
        filter: drop-shadow(0 0 8px #00F3FF) !important;
        transform: translateY(-1px) scale(1.08) !important;
      }

      /* 桌面端 Header 磨砂玻璃選單升級 */
      .app-header-nav.desktop-only {
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.12) 0%,
          rgba(255, 255, 255, 0.03) 40%,
          rgba(10, 15, 30, 0.6) 100%
        ) !important;
        backdrop-filter: blur(24px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.45) !important;
        border-radius: 24px !important;
        padding: 4px 6px !important;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        gap: 3px !important;
      }

      .app-header-nav.desktop-only .bottom-nav-item {
        border-radius: 16px !important;
        padding: 5px 12px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        color: rgba(255, 255, 255, 0.7) !important;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
      }

      .app-header-nav.desktop-only .bottom-nav-item:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: #ffffff !important;
        transform: translateY(-1px) scale(1.02) !important;
      }

      .app-header-nav.desktop-only .bottom-nav-item.active {
        background: rgba(0, 243, 255, 0.15) !important;
        color: #00F3FF !important;
        font-weight: 700 !important;
        border: 1px solid rgba(0, 243, 255, 0.35) !important;
        box-shadow: 0 2px 8px rgba(0, 243, 255, 0.25), inset 0 1px 0.5px rgba(255, 255, 255, 0.4) !important;
      }

      /* 幹部更多抽屜樣式 - Apple VisionOS 磨砂玻璃抽屜 */
      .cadre-more-overlay {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        z-index: 1100;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .cadre-more-overlay.show {
        opacity: 1;
      }

      .cadre-more-sheet {
        width: 100%;
        max-width: 520px;
        background: linear-gradient(
          145deg,
          rgba(255, 255, 255, 0.16) 0%,
          rgba(255, 255, 255, 0.05) 30%,
          rgba(13, 20, 36, 0.94) 100%
        ) !important;
        backdrop-filter: blur(32px) saturate(210%) contrast(108%) brightness(1.05) !important;
        -webkit-backdrop-filter: blur(32px) saturate(210%) contrast(108%) brightness(1.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.24) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.6) !important;
        border-bottom: none !important;
        border-radius: 32px 32px 0 0 !important;
        padding: 24px 22px calc(38px + env(safe-area-inset-bottom, 0px)) 22px !important;
        box-shadow:
          0 -16px 50px rgba(0, 0, 0, 0.85),
          0 0 30px rgba(0, 243, 255, 0.15),
          inset 0 1px 1.5px rgba(255, 255, 255, 0.7) !important;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2);
        position: relative;
        overflow: hidden;
      }
      .cadre-more-sheet::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.03"/></svg>');
        pointer-events: none;
        z-index: 0;
        mix-blend-mode: overlay;
      }
      .cadre-more-overlay.show .cadre-more-sheet {
        transform: translateY(0);
      }

      .cadre-more-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .cadre-more-item {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 18px !important;
        padding: 14px 15px !important;
        display: flex !important;
        flex-direction: column !important;
        text-decoration: none !important;
        color: #fff !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25), inset 0 1px 0.5px rgba(255, 255, 255, 0.25) !important;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease, border-color 0.2s ease, background 0.2s ease !important;
      }
      /* Hover Effect: Scale 1.02, Shadow spread +8px (soft) */
      .cadre-more-item:hover {
        background: linear-gradient(135deg, rgba(0, 243, 255, 0.15) 0%, rgba(0, 243, 255, 0.04) 100%) !important;
        border-color: rgba(0, 243, 255, 0.5) !important;
        transform: scale(1.02) !important;
        box-shadow: 0 8px 24px rgba(0, 243, 255, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.4) !important;
      }
      /* Active State: Scale 0.98, Brightness +10%, Border #00F3FF, Glow-radius 10px */
      .cadre-more-item:active {
        transform: scale(0.97) !important;
        filter: brightness(1.15) !important;
        border-color: #00F3FF !important;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.6) !important;
      }
      .cadre-more-item .icon {
        font-size: 22px;
        margin-bottom: 6px;
      }
      .cadre-more-item .title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }
      .cadre-more-item .desc {
        font-size: 11.5px;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 3px;
      }

      /* 避免頁面內容被懸浮底部欄遮擋 */
      body {
        padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
        animation: appBodyEnter 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1) both;
      }
      @media (min-width: 769px) {
        .unified-bottom-nav {
          display: none !important;
        }
        body {
          padding-bottom: 30px !important;
        }
      }

      /* ============================================================
       * HTML5 原生 Cross-Document View Transitions (iOS 18+ & Chrome)
       * 實現如同原生 APP 之 60fps 無縫切換，底欄固定不閃爍
       * ============================================================ */
      @view-transition {
        navigation: auto;
      }

      /* 保持底部 Apple 懸浮玻璃島在跨頁時完全定格不動、不重新渲染 */
      ::view-transition-group(unified-bottom-nav) {
        animation-duration: 0s !important;
      }

      ::view-transition-old(root) {
        animation: appViewTransitionOut 0.2s cubic-bezier(0.4, 0, 1, 1) both;
      }
      ::view-transition-new(root) {
        animation: appViewTransitionIn 0.26s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
      }

      @keyframes appViewTransitionOut {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-8px) scale(0.985);
        }
      }

      @keyframes appViewTransitionIn {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes appBodyEnter {
        from {
          opacity: 0.2;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* 頂部極細 Apple 科技微光進度條 (提供即時觸覺反饋) */
      .app-page-progress-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 2.5px !important;
        width: 0%;
        background: linear-gradient(90deg, #00F3FF, #52b788, #00F3FF) !important;
        background-size: 200% 100% !important;
        box-shadow: 0 0 10px #00F3FF, 0 0 4px #52b788 !important;
        z-index: 999999 !important;
        transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease !important;
        pointer-events: none !important;
      }

      /* 非 ViewTransition 瀏覽器之平滑過渡保護罩 (無白屏閃爍) */
      body.app-page-transitioning {
        opacity: 0.85;
        transform: scale(0.995);
        filter: blur(0.6px);
        transition: opacity 0.16s ease, transform 0.16s ease, filter 0.16s ease;
      }
    `;
    document.head.appendChild(style);

    // 注入 View Transition 標籤以啟動原生跨頁無縫過渡
    if (!document.querySelector('meta[name="view-transition"]')) {
      const meta = document.createElement('meta');
      meta.name = 'view-transition';
      meta.content = 'same-origin';
      document.head.appendChild(meta);
    }
  }

  // 10. APP 級別即時觸覺與平滑換頁引擎 (Native-like Smooth Transition Engine)
  const prefetchedUrls = new Set();
  function prefetchPage(url) {
    if (!url || url.startsWith('#') || url.startsWith('javascript:') || prefetchedUrls.has(url)) return;
    prefetchedUrls.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
    if ('fetch' in window) {
      fetch(url, { priority: 'low' }).catch(() => {});
    }
  }

  function showProgressBar() {
    let bar = document.getElementById('app-page-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'app-page-progress';
      bar.className = 'app-page-progress-bar';
      document.body.appendChild(bar);
    }
    bar.style.width = '0%';
    bar.style.opacity = '1';
    requestAnimationFrame(() => {
      bar.style.width = '70%';
    });
  }

  function completeProgressBar() {
    const bar = document.getElementById('app-page-progress');
    if (bar) {
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => { bar.style.width = '0%'; }, 200);
      }, 150);
    }
  }

  function attachInstantAppNavigation(container) {
    if (!container) return;
    container.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.includes('://') || a.target === '_blank') return;

      // 手指接觸瞬間 / 滑鼠游標移入瞬間，立即預載頁面
      a.addEventListener('touchstart', () => prefetchPage(href), { passive: true });
      a.addEventListener('mouseenter', () => prefetchPage(href), { passive: true });

      // 點擊事件：立即切換 active 膠囊指示器，零等待觸覺反饋
      a.addEventListener('click', (e) => {
        const currentNorm = window.location.pathname.replace(/\/$/, '');
        const targetNorm = href.replace(/\/$/, '');
        if (currentNorm === targetNorm || (targetNorm.endsWith('/index.html') && currentNorm === targetNorm.replace('/index.html', ''))) {
          e.preventDefault();
          return;
        }

        // 若為底部導覽列，立即切換選取狀態，產生如 Native App 的即時彈動反饋
        if (a.classList.contains('bottom-nav-item')) {
          container.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
          a.classList.add('active');
        }

        showProgressBar();

        // 觸發頁面容器平滑過渡淡出，消除白屏與生硬切換感
        document.body.classList.add('app-page-transitioning');
      });
    });
  }

  // 頁面顯示時重設過渡狀態
  window.addEventListener('pageshow', () => {
    completeProgressBar();
    document.body.classList.remove('app-page-transitioning');
  });

  // 初始化 DOM 監聽
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectNavStyles();
      renderUnifiedNavigation();
    });
  } else {
    injectNavStyles();
    renderUnifiedNavigation();
  }

})();
