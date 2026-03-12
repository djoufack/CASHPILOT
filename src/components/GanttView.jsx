import React, { useEffect, useRef, useState } from 'react';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * Gantt chart component using frappe-gantt (lazy loaded).
 *
 * @param {Array} tasks - frappe-gantt task objects:
 *   [{ id, name, start, end, progress, dependencies }]
 * @param {'Day'|'Week'|'Month'} viewMode
 * @param {function} onDateChange - (task, start, end) => void
 * @param {function} onProgressChange - (task, progress) => void
 * @param {function} onTaskClick - (task) => void
 */
export default function GanttView({ tasks = [], viewMode = 'Week', onDateChange, onProgressChange, onTaskClick }) {
  const containerRef = useRef(null);
  const ganttRef = useRef(null);
  const [GanttClass, setGanttClass] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('frappe-gantt').then((mod) => {
      if (!cancelled) setGanttClass(() => mod.default);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !tasks.length || !GanttClass) return;

    // Clear previous instance
    containerRef.current.innerHTML = '';

    ganttRef.current = new GanttClass(containerRef.current, tasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      on_date_change: onDateChange || (() => {}),
      on_progress_change: onProgressChange || (() => {}),
      on_click: onTaskClick || (() => {}),
      custom_popup_html: (task) => `
        <div style="padding:8px; background:#0f1528; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; font-size:12px; min-width:140px;">
          <strong>${escapeHtml(task.name)}</strong><br/>
          <span style="color:#9ca3af">${task.start} → ${task.end}</span><br/>
          <span style="color:#6366f1">Avancement: ${task.progress}%</span><br/>
          <span style="color:#a7f3d0">Dépendances: ${Number(task.dependencies_count || 0)}</span><br/>
          <span style="color:#c4b5fd">Sous-tâches: ${Number(task.subtasks_count || 0)}</span><br/>
          ${
            Array.isArray(task.dependency_titles) && task.dependency_titles.length > 0
              ? `<span style="color:#cbd5e1">Prérequis: ${escapeHtml(task.dependency_titles.join(', '))}</span><br/>`
              : ''
          }
          <span style="color:#f59e0b">Cliquer pour ouvrir la tâche</span>
        </div>
      `,
    });

    return () => {
      ganttRef.current = null;
    };
  }, [tasks, viewMode, GanttClass, onDateChange, onProgressChange, onTaskClick]);

  if (!tasks.length) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Aucune tâche avec des dates définies.</p>
        <p className="text-sm mt-1">Ajoutez des dates de début et de fin aux tâches pour afficher le Gantt.</p>
      </div>
    );
  }

  if (!GanttClass) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Chargement du diagramme de Gantt…</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gantt-container overflow-x-auto"
      style={{ minHeight: '300px' }}
    />
  );
}
