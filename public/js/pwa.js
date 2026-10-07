/**
 * pwa.js - 全站統一 PWA (Progressive Web App) 註冊與增強支援
 * 功能：自動註冊 Service Worker、管理安裝提示事件、支援全域狀態判定
 */

(function () {
  'use strict';

  // 1. 註冊 Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker 註冊成功，範圍為:', registration.scope);

          // 監聽快取版本更新
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[PWA] 檢測到新版本內容，將在背景預備完成。');
                  } else {
                    console.log('[PWA] 離線快取內容已首次就緒。');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker 註冊失敗:', error);
        });
    });
  }

  // 2. 捕捉 Chrome / Android 的「加到主畫面 / 安裝」事件
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPWAInstallPrompt = e;
    console.log('[PWA] 捕獲 beforeinstallprompt 事件');
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] 應用程式已成功安裝至主畫面！');
    deferredPrompt = null;
    window.deferredPWAInstallPrompt = null;
  });

  // 3. 提供主動觸發安裝彈窗之輔助函式
  window.promptPWAInstall = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] 使用者已同意安裝');
        } else {
          console.log('[PWA] 使用者取消安裝');
        }
        deferredPrompt = null;
        window.deferredPWAInstallPrompt = null;
      });
      return true;
    }
    return false;
  };

  // 4. 檢測是否處於全螢幕 App 獨立模式 (Standalone)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  window.isPWARunningStandalone = isStandalone;
  if (isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
    console.log('[PWA] 目前正處於獨立 Web App 全螢幕模式中運行');
  }
})();
