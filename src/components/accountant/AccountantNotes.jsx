import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquarePlus,
  StickyNote,
  Trash2,
  Loader2,
  FileText,
  Receipt,
  BookOpen,
  BarChart3,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const entityIcons = {
  invoice: FileText,
  expense: Receipt,
  accounting_entry: BookOpen,
  report: BarChart3,
  general: StickyNote,
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AccountantNotes({
  notes = [],
  onAddNote,
  onDeleteNote,
  loading,
  entityType = 'general',
  entityId = null,
}) {
  const { t } = useTranslation();
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter notes relevant to this entity context
  const filteredNotes =
    entityType === 'general'
      ? notes
      : notes.filter((n) => n.entity_type === entityType && (!entityId || n.entity_id === entityId));

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      await onAddNote(entityType, entityId, newNote.trim());
      setNewNote('');
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <StickyNote className="h-5 w-5 text-indigo-400" />
        <h3 className="font-semibold text-white">{t('accountant.notes')}</h3>
        <Badge variant="outline" className="ml-auto border-white/10 text-slate-400 text-xs">
          {filteredNotes.length}
        </Badge>
      </div>

      {/* Note input */}
      <div className="border-b border-white/10 p-4">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={t('accountant.notePlaceholder')}
          rows={3}
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 resize-none"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !newNote.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <MessageSquarePlus className="mr-2 h-3 w-3" />
            )}
            {t('accountant.addNote')}
          </Button>
        </div>
      </div>

      {/* Notes timeline */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <StickyNote className="h-8 w-8 text-slate-500 mb-2" />
            <p className="text-sm text-slate-500">{t('accountant.noNotes')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotes.map((note) => {
              const Icon = entityIcons[note.entity_type] || StickyNote;

              return (
                <div key={note.id} className="group relative px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">
                          {t(`accountant.entity_${note.entity_type}`, note.entity_type)}
                        </Badge>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.note}</p>
                    </div>
                    {onDeleteNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={loading}
                        onClick={() => onDeleteNote(note.id)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-opacity"
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
