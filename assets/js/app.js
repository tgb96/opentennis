(() => {
  'use strict';

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  document.documentElement.classList.toggle('is-standalone', isStandalone());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=31', { updateViaCache: 'none' })
        .then(registration => registration.update())
        .catch(() => {});
    });
  }

  const connectivityNotice = (() => {
    let notice = null;
    return visible => {
      if (!notice) {
        notice = document.createElement('div');
        notice.className = 'app-connectivity-notice';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.textContent = 'Sin conexión: mostrando los últimos datos guardados.';
        document.body.appendChild(notice);
      }
      notice.classList.toggle('is-visible', Boolean(visible));
    };
  })();

  window.addEventListener('offline', () => connectivityNotice(true));
  window.addEventListener('online', () => connectivityNotice(false));
  let dataReloadTimer = null;
  const handleDataStatus = detail => {
    connectivityNotice(detail && detail.available === false);

    // La vista se dibuja inmediatamente con la copia local para sentirse rápida.
    // Si en segundo plano llegó una versión distinta, se redibuja una sola vez
    // con todos los datos recién guardados.
    if (!detail || !detail.changed || !detail.hadCompleteCache || dataReloadTimer) return;

    const lastReload = Number(sessionStorage.getItem('openTennisDataReloadAt') || 0);
    if (Date.now() - lastReload < 5000) return;

    dataReloadTimer = window.setTimeout(() => {
      sessionStorage.setItem('openTennisDataReloadAt', String(Date.now()));
      window.location.reload();
    }, 300);
  };

  window.addEventListener('open-tennis:data-status', event => {
    handleDataStatus(event.detail);
  });

  if (window.OPEN_TENNIS_CACHE && typeof window.OPEN_TENNIS_CACHE.getStatus === 'function') {
    handleDataStatus(window.OPEN_TENNIS_CACHE.getStatus());
  }
  if (navigator.onLine === false) connectivityNotice(true);

  const setupGlobalRefresh = () => {
    const DATA_CACHE_PREFIX = 'openTennisDataCacheV2:';
    const ACTIVE_CACHE_NAME = 'open-tennis-v71-compact-home-matches';
    const button = document.createElement('button');
    const status = document.createElement('div');
    let refreshing = false;

    button.id = 'appGlobalRefresh';
    button.className = 'app-global-refresh';
    button.type = 'button';
    button.setAttribute('aria-label', 'Actualizar toda la aplicación');
    button.setAttribute('title', 'Actualizar toda la aplicación');
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 1 0-2.3 5.7M20 5v6h-6"/></svg><span>Actualizar</span>';

    status.id = 'appRefreshStatus';
    status.className = 'app-refresh-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const styles = document.createElement('style');
    styles.textContent = `
      .app-global-refresh{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:max(10px,env(safe-area-inset-right,0px));z-index:1200;display:flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 13px;border:1px solid rgba(255,255,255,.34);border-radius:999px;color:#fff;background:rgba(7,61,46,.94);box-shadow:0 6px 18px rgba(5,43,33,.24);font:800 11px/1 Inter,Arial,sans-serif;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:transform .18s ease,background .18s ease,opacity .18s ease}
      .app-global-refresh:hover,.app-global-refresh:focus-visible{background:#b94a25;transform:translateY(-1px);outline:3px solid rgba(242,140,0,.25);outline-offset:2px}
      .app-global-refresh:disabled{cursor:wait;opacity:.82;transform:none}
      .app-global-refresh svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .app-global-refresh.is-updating svg{animation:app-refresh-spin .75s linear infinite}
      .app-refresh-status{position:fixed;top:calc(60px + env(safe-area-inset-top,0px));right:max(10px,env(safe-area-inset-right,0px));z-index:1200;max-width:min(290px,calc(100vw - 20px));padding:9px 12px;border-radius:12px;color:#fff;background:rgba(7,48,37,.94);box-shadow:0 8px 22px rgba(0,0,0,.2);font:700 12px/1.35 Inter,Arial,sans-serif;opacity:0;pointer-events:none;transform:translateY(-5px);transition:opacity .18s ease,transform .18s ease}
      .app-refresh-status.is-visible{opacity:1;transform:translateY(0)}
      .app-refresh-status.is-error{background:#a83e2d}
      @keyframes app-refresh-spin{to{transform:rotate(360deg)}}
      @media(max-width:640px){.app-global-refresh{width:42px;padding:0}.app-global-refresh span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
      @media(min-width:900px){.app-global-refresh{top:88px;right:12px;width:42px;padding:0}.app-global-refresh span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.app-refresh-status{top:138px;right:12px}}
      @media(prefers-reduced-motion:reduce){.app-global-refresh,.app-refresh-status{transition:none}.app-global-refresh.is-updating svg{animation:none}}
    `;

    const showStatus = (message, isError) => {
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
      status.classList.add('is-visible');
    };

    const clearStoredDataCopies = () => {
      try {
        for (let index = localStorage.length - 1; index >= 0; index--) {
          const key = localStorage.key(index);
          if (key && key.startsWith(DATA_CACHE_PREFIX)) localStorage.removeItem(key);
        }
        sessionStorage.removeItem('openTennisDataReloadAt');
      } catch (error) {
        // La recarga y la limpieza del service worker siguen siendo suficientes.
      }
    };

    const clearOutdatedAppCaches = async () => {
      if (!('caches' in window)) return;
      const keys = await window.caches.keys();
      await Promise.all(keys
        .filter(key => key.startsWith('open-tennis-') && key !== ACTIVE_CACHE_NAME)
        .map(key => window.caches.delete(key)));
    };

    const updateServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.update().catch(() => null)));
    };

    button.addEventListener('click', async () => {
      if (refreshing) return;
      if (navigator.onLine === false) {
        showStatus('Sin conexión. Conservamos la información disponible.', true);
        window.setTimeout(() => status.classList.remove('is-visible'), 3200);
        return;
      }

      refreshing = true;
      button.disabled = true;
      button.classList.add('is-updating');
      showStatus('Actualizando toda la aplicación…', false);

      try {
        const checkUrl = new URL(window.location.href);
        checkUrl.searchParams.set('_comprobar', String(Date.now()));
        const response = await window.fetch(checkUrl.href, { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo confirmar la conexión');

        clearStoredDataCopies();
        await updateServiceWorker();
        await clearOutdatedAppCaches();

        showStatus('Información actualizada. Recargando…', false);
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('_comprobar');
        nextUrl.searchParams.set('actualizado', String(Date.now()));
        window.setTimeout(() => window.location.replace(nextUrl.href), 220);
      } catch (error) {
        refreshing = false;
        button.disabled = false;
        button.classList.remove('is-updating');
        showStatus('No se pudo actualizar. Mantuvimos la información actual.', true);
        window.setTimeout(() => status.classList.remove('is-visible'), 3800);
      }
    });

    document.head.appendChild(styles);
    document.body.append(button, status);
  };

  setupGlobalRefresh();

  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const navigationCurrent = current === 'torneo.html'
    ? 'eventos.html'
    : (current === 'competencia.html' ? 'partidos.html' : current);

  document.querySelectorAll('#appBottomNav a, .app-bottom-nav a, .app-nav a, .nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase() || 'index.html';

    if (href === navigationCurrent) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });

  /**
   * Control del gesto/botón "atrás" en celular/PWA.
   *
   * Objetivo:
   * - Primer gesto atrás: no retrocede de página, muestra aviso.
   * - Segundo gesto atrás dentro de unos segundos: intenta salir/cerrar la app.
   *
   * La navegación interna reemplaza la página actual para que cada pestaña no
   * agregue niveles artificiales al historial de la PWA.
   */
  const setupDoubleBackToExit = () => {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const shouldEnableBackControl = isStandalone() && isAndroid;

    if (!shouldEnableBackControl || !window.history || !window.history.pushState) {
      return;
    }

    const EXIT_DELAY = 2200;
    let lastBackPress = 0;
    let resetTimer = null;
    let isExiting = false;
    let pendingNavigation = '';
    let navigationFallbackTimer = null;

    const showExitToast = () => {
      let toast = document.getElementById('appExitToast');

      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appExitToast';
        toast.textContent = 'Desliza atrás otra vez para salir';

        Object.assign(toast.style, {
          position: 'fixed',
          left: '50%',
          bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))',
          transform: 'translateX(-50%)',
          zIndex: '99999',
          padding: '10px 14px',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.92)',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '600',
          lineHeight: '1.2',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
          opacity: '0',
          pointerEvents: 'none',
          transition: 'opacity 180ms ease, transform 180ms ease',
          whiteSpace: 'nowrap'
        });

        document.body.appendChild(toast);
      }

      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-4px)';
      });
    };

    const hideExitToast = () => {
      const toast = document.getElementById('appExitToast');

      if (!toast) {
        return;
      }

      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    };

    const resetBackPress = () => {
      lastBackPress = 0;
      hideExitToast();

      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const exitApp = () => {
      isExiting = true;
      resetBackPress();

      window.removeEventListener('popstate', handleBackGesture);

      // El segundo gesto ya retiró la guarda. Un único back adicional entrega
      // el control a Android para cerrar la tarea, sin recorrer páginas previas.
      setTimeout(() => window.history.back(), 0);
    };

    const completePendingNavigation = () => {
      if (!pendingNavigation) return false;

      const destination = pendingNavigation;
      pendingNavigation = '';

      if (navigationFallbackTimer) {
        clearTimeout(navigationFallbackTimer);
        navigationFallbackTimer = null;
      }

      window.location.replace(destination);
      return true;
    };

    function handleBackGesture(event) {
      if (completePendingNavigation()) {
        return;
      }

      if (isExiting) {
        return;
      }

      const now = Date.now();
      const isSecondBack = now - lastBackPress <= EXIT_DELAY;

      if (isSecondBack) {
        exitApp();
        return;
      }

      lastBackPress = now;
      showExitToast();

      window.history.pushState(
        {
          openTennisBackGuard: true
        },
        '',
        window.location.href
      );

      if (resetTimer) {
        clearTimeout(resetTimer);
      }

      resetTimer = setTimeout(resetBackPress, EXIT_DELAY);
    }

    window.history.replaceState(
      {
        openTennisPage: true
      },
      '',
      window.location.href
    );

    window.history.pushState(
      {
        openTennisBackGuard: true
      },
      '',
      window.location.href
    );

    window.addEventListener('popstate', handleBackGesture);

    document.addEventListener('click', event => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('a[href]')
        : null;
      if (!link || link.hasAttribute('download')) return;
      if (link.target && link.target.toLowerCase() !== '_self') return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname.startsWith('/admin/')) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      resetBackPress();
      pendingNavigation = destination.href;

      // Primero vuelve desde la guarda a la entrada base; el popstate completa
      // la navegación reemplazando esa entrada, por lo que el historial no crece.
      window.history.back();

      navigationFallbackTimer = setTimeout(() => {
        completePendingNavigation();
      }, 250);
    }, true);
  };

  setupDoubleBackToExit();
})();
