'use client';

import { useEffect, useRef } from 'react';

// Barra de desplazamiento lateral fija al pie de la pantalla para las tablas anchas.
// Mientras una tabla con scroll horizontal está a la vista pero su barra propia queda abajo
// (fuera de la pantalla), esta barra aparece pegada al pie y mueve la tabla. Además, los
// encabezados de la tabla siguen visibles arriba mientras se baja por ella.
// Funciona sola con cualquier contenedor `.overflow-x-auto`; para excluir uno se le pone
// `data-no-float-scroll`.

const BAR_HEIGHT = 16;
// Separación del borde inferior de la pantalla (~1 mm)
const BAR_GAP = 6;

type Box = { top: number; bottom: number; left: number; right: number };

function isScrollY(el: Element): boolean {
  const oy = getComputedStyle(el).overflowY;
  return oy === 'auto' || oy === 'scroll' || oy === 'hidden';
}

// Parte visible del elemento: recortada por la ventana y por contenedores con scroll (modales)
function visibleBox(el: HTMLElement, topLimit: number, bottomLimit: number): Box {
  const r = el.getBoundingClientRect();
  const box: Box = {
    top: Math.max(r.top, topLimit),
    bottom: Math.min(r.bottom, bottomLimit),
    left: Math.max(r.left, 0),
    right: Math.min(r.right, window.innerWidth),
  };
  let p = el.parentElement;
  while (p && p !== document.body) {
    if (isScrollY(p)) {
      const pr = p.getBoundingClientRect();
      box.top = Math.max(box.top, pr.top);
      box.bottom = Math.min(box.bottom, pr.bottom);
      box.left = Math.max(box.left, pr.left);
      box.right = Math.min(box.right, pr.right);
    }
    p = p.parentElement;
  }
  return box;
}

function headerBottom(): number {
  const h = document.querySelector('header');
  if (!h) return 0;
  const pos = getComputedStyle(h).position;
  return pos === 'sticky' || pos === 'fixed' ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
}

// Barra de menú inferior en celular (fija abajo)
function bottomNavHeight(): number {
  const navs = document.querySelectorAll('nav');
  for (const n of Array.from(navs)) {
    const cs = getComputedStyle(n);
    if (cs.position === 'fixed' && cs.display !== 'none' && n.getBoundingClientRect().bottom >= window.innerHeight - 1) {
      return n.getBoundingClientRect().height;
    }
  }
  return 0;
}

function resetHead(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>('thead th[data-float-head]').forEach((th) => {
    th.style.transform = '';
    th.style.position = '';
    th.style.zIndex = '';
    th.style.backgroundColor = '';
    th.removeAttribute('data-float-head');
  });
}

function headBackground(thead: HTMLElement): string {
  let el: HTMLElement | null = thead;
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    el = el.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor || '#fff';
}

export function FloatingScrollbar() {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!bar || !thumb) return;

    let target: HTMLElement | null = null;
    let frame = 0;
    let drag: { startX: number; startScroll: number } | null = null;

    // La barra se dibuja a mano (no la del navegador) para que se vea igual en todos los equipos
    const paintThumb = () => {
      if (!target) return;
      const trackW = bar.clientWidth;
      const max = target.scrollWidth - target.clientWidth;
      const thumbW = Math.max(40, (target.clientWidth / target.scrollWidth) * trackW);
      const left = max > 0 ? (target.scrollLeft / max) * (trackW - thumbW) : 0;
      thumb.style.width = thumbW + 'px';
      thumb.style.transform = `translateX(${left}px)`;
    };

    const scrollFromPointer = (dx: number) => {
      if (!target || !drag) return;
      const trackW = bar.clientWidth;
      const thumbW = thumb.getBoundingClientRect().width;
      const max = target.scrollWidth - target.clientWidth;
      const ratio = trackW - thumbW > 0 ? max / (trackW - thumbW) : 0;
      target.scrollLeft = drag.startScroll + dx * ratio;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!target) return;
      e.preventDefault();
      const thumbRect = thumb.getBoundingClientRect();
      // Clic fuera del agarrador: salta hasta ahí y sigue arrastrando
      if (e.clientX < thumbRect.left || e.clientX > thumbRect.right) {
        const barRect = bar.getBoundingClientRect();
        const trackW = bar.clientWidth;
        const thumbW = thumbRect.width;
        const max = target.scrollWidth - target.clientWidth;
        const pos = Math.min(Math.max(0, e.clientX - barRect.left - thumbW / 2), trackW - thumbW);
        target.scrollLeft = trackW - thumbW > 0 ? (pos / (trackW - thumbW)) * max : 0;
      }
      drag = { startX: e.clientX, startScroll: target.scrollLeft };
      bar.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag) scrollFromPointer(e.clientX - drag.startX);
    };
    const onPointerUp = (e: PointerEvent) => {
      drag = null;
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    };

    const onTargetScroll = () => paintThumb();

    const setTarget = (next: HTMLElement | null) => {
      if (next === target) return;
      if (target) target.removeEventListener('scroll', onTargetScroll);
      target = next;
      if (target) target.addEventListener('scroll', onTargetScroll, { passive: true });
    };

    const update = () => {
      frame = 0;
      const top = headerBottom();
      const navH = bottomNavHeight();
      const viewBottom = window.innerHeight - navH;
      let best: HTMLElement | null = null;
      let bestArea = 0;

      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.overflow-x-auto'))
        .filter((el) => !el.hasAttribute('data-no-float-scroll') && el.tagName !== 'NAV');

      candidates.forEach((el) => {
        const wide = el.scrollWidth > el.clientWidth + 1;
        const vis = visibleBox(el, top, viewBottom);
        const visibleH = vis.bottom - vis.top;
        const r = el.getBoundingClientRect();

        // Encabezados que siguen visibles al bajar por la tabla
        const thead = el.querySelector('thead');
        if (thead && visibleH > 0) {
          const headH = thead.getBoundingClientRect().height;
          const shift = Math.min(Math.max(0, vis.top - r.top), Math.max(0, r.height - headH * 2));
          if (shift > 0) {
            const bg = headBackground(thead as HTMLElement);
            thead.querySelectorAll<HTMLElement>('th').forEach((th) => {
              th.setAttribute('data-float-head', '');
              th.style.transform = `translateY(${shift}px)`;
              th.style.position = 'relative';
              th.style.zIndex = '5';
              th.style.backgroundColor = bg;
            });
          } else {
            resetHead(el);
          }
        } else {
          resetHead(el);
        }

        if (!wide || visibleH < 60) return;
        // Solo hace falta si la barra propia de la tabla quedó fuera de la vista
        if (r.bottom <= vis.bottom + 2) return;
        const area = visibleH * (vis.right - vis.left);
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      });

      setTarget(best);
      if (!best) {
        bar.style.display = 'none';
        return;
      }
      const el = best as HTMLElement;
      const r = el.getBoundingClientRect();
      bar.style.display = 'block';
      bar.style.left = r.left + 'px';
      bar.style.width = el.clientWidth + 'px';
      bar.style.bottom = navH + BAR_GAP + 'px';
      paintThumb();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    bar.addEventListener('pointerdown', onPointerDown);
    bar.addEventListener('pointermove', onPointerMove);
    bar.addEventListener('pointerup', onPointerUp);
    bar.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    // Las tablas cambian al cargar datos o filtrar: revisar de vez en cuando
    const interval = window.setInterval(schedule, 800);
    schedule();

    return () => {
      bar.removeEventListener('pointerdown', onPointerDown);
      bar.removeEventListener('pointermove', onPointerMove);
      bar.removeEventListener('pointerup', onPointerUp);
      bar.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      window.clearInterval(interval);
      if (frame) cancelAnimationFrame(frame);
      setTarget(null);
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        display: 'none',
        height: BAR_HEIGHT,
        zIndex: 70,
        touchAction: 'none',
      }}
      className="float-hscroll"
    >
      <div ref={thumbRef} className="float-hscroll-thumb" />
    </div>
  );
}
