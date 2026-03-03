import React, { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';

/**
 * Gantt chart component using frappe-gantt.
 *
 * @param {Array} tasks - frappe-gantt task objects:
 *   [{ id, name, start, end, progress, dependencies }]
 * @param {'Day'|'Week'|'Month'} viewMode
 * @param {function} onDateChange - (task, start, end) => void
 * @param {function} onProgressChange - (task, progress) => void
 */
export default function GanttView({ tasks = [], viewMode = 'Week', onDateChange, onProgressChange }) {
  const containerRef = useRef(null);
  const ganttRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !tasks.length) return;

    // Clear previous instance
    containerRef.current.innerHTML = '';

    ganttRef.current = new Gantt(containerRef.current, tasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      on_date_change: onDateChange || (() => {}),
      on_progress_change: onProgressChange || (() => {}),
      custom_popup_html: (task) => `
        <div style="padding:8px; background:#0f1528; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; font-size:12px; min-width:140px;">
          <strong>${task.name}</strong><br/>
          <span style="color:#9ca3af">${task.start} → ${task.end}</span><br/>
          <span style="color:#6366f1">Avancement: ${task.progress}%</span>
        </div>
      `,
    });

    return () => {
      ganttRef.current = null;
    };
  }, [tasks, viewMode]);

  if (!tasks.length) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Aucune tâche avec des dates définies.</p>
        <p className="text-sm mt-1">Ajoutez des dates de début et de fin aux tâches pour afficher le Gantt.</p>
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
