(() => {
  'use strict';

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  document.documentElement.classList.toggle('is-standalone', isStandalone());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=13').catch(() => {});
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
  window.addEventListener('open-tennis:data-status', event => {
    connectivityNotice(event.detail && event.detail.available === false);
  });
  if (navigator.onLine === false) connectivityNotice(true);

  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  document.querySelectorAll('#appBottomNav a, .app-bottom-nav a, .app-nav a, .nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase() || 'index.html';

    if (href === current) {
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
