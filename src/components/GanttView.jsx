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
    const handlePopupClick = (event) => {
      const actionTrigger = event.target?.closest?.('[data-open-task-id]');
      if (!actionTrigger) return;

      event.preventDefault();
      event.stopPropagation();

      const targetId = actionTrigger.getAttribute('data-open-task-id');
      if (!targetId || !onTaskClick) return;

      const targetTask = tasks.find((item) => String(item.id) === String(targetId));
      if (targetTask) {
        onTaskClick(targetTask);
      } else {
        onTaskClick({ id: targetId });
      }
    };
    containerRef.current.addEventListener('click', handlePopupClick);

    ganttRef.current = new GanttClass(containerRef.current, tasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      on_date_change: onDateChange || (() => {}),
      on_progress_change: onProgressChange || (() => {}),
      on_click: onTaskClick || (() => {}),
      custom_popup_html: (task) => {
        const dependencyTasks = Array.isArray(task.dependency_tasks)
          ? task.dependency_tasks
          : [];
        const dependencyButtonsHtml = dependencyTasks.length
          ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
              ${dependencyTasks
                .slice(0, 4)
                .map(
                  (dependencyTask) =>
                    `<button type="button" data-open-task-id="${escapeHtml(dependencyTask.id)}" style="background:#1e2a4a; border:1px solid #334155; color:#c7d2fe; border-radius:9999px; font-size:11px; padding:2px 8px; cursor:pointer;">
                      ${escapeHtml(dependencyTask.title || dependencyTask.id)}
                    </button>`
                )
                .join('')}
              ${
                dependencyTasks.length > 4
                  ? `<span style="color:#94a3b8; font-size:11px;">+${dependencyTasks.length - 4}</span>`
                  : ''
              }
            </div>`
          : `<span style="color:#64748b">Prérequis: aucun</span><br/>`;

        return `
        <div style="padding:8px; background:#0f1528; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; font-size:12px; min-width:160px;">
          <strong>${escapeHtml(task.name)}</strong><br/>
          <span style="color:#9ca3af">${task.start} → ${task.end}</span><br/>
          <span style="color:#6366f1">Avancement: ${task.progress}%</span><br/>
          <span style="color:#a7f3d0">Dépendances: ${Number(task.dependencies_count || 0)}</span><br/>
          <button type="button" data-open-task-id="${escapeHtml(task.id)}" style="background:#1f2937; border:1px solid #374151; color:#c4b5fd; border-radius:6px; font-size:11px; padding:2px 8px; margin-top:4px; cursor:pointer;">
            Sous-tâches: ${Number(task.subtasks_count || 0)}
          </button><br/>
          ${dependencyButtonsHtml}
          <span style="color:#f59e0b">Cliquer pour ouvrir la tâche</span>
        </div>
      `;
      },
    });

    return () => {
      containerRef.current?.removeEventListener('click', handlePopupClick);
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
