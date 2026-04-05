import { useMemo, useState } from 'react';
import { Database, Plus, RefreshCw, Search, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAdminMcpTools } from '@/hooks/useAdminMcpTools';

const INITIAL_FORM = {
  tool_name: '',
  display_name: '',
  category: 'general',
  source_module: 'manual',
  description: '',
  tags: '',
  metadata_json: '{}',
  is_active: true,
  is_generated: false,
};

const normalizeTags = (value) => [
  ...new Set(
    String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  ),
];

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const toForm = (tool) => ({
  tool_name: tool.tool_name || '',
  display_name: tool.display_name || '',
  category: tool.category || 'general',
  source_module: tool.source_module || 'manual',
  description: tool.description || '',
  tags: Array.isArray(tool.tags) ? tool.tags.join(', ') : '',
  metadata_json: JSON.stringify(tool.metadata || {}, null, 2),
  is_active: Boolean(tool.is_active),
  is_generated: Boolean(tool.is_generated),
});

const fromForm = (form) => {
  let metadata = {};
  const raw = String(form.metadata_json || '').trim();
  if (raw) {
    metadata = JSON.parse(raw);
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      throw new Error('Le champ metadata doit etre un objet JSON.');
    }
  }

  return {
    tool_name: String(form.tool_name || '').trim(),
    display_name: String(form.display_name || '').trim(),
    category: String(form.category || '').trim() || 'general',
    source_module: String(form.source_module || '').trim() || 'manual',
    description: String(form.description || '').trim(),
    tags: normalizeTags(form.tags),
    metadata,
    is_active: Boolean(form.is_active),
    is_generated: Boolean(form.is_generated),
  };
};

const AdminMcpToolsManager = () => {
  const { toast } = useToast();
  const { tools, stats, loading, error, refresh, createTool, updateTool, deleteTool } = useAdminMcpTools();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const categories = useMemo(() => {
    const values = [...new Set(tools.map((entry) => entry.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return values;
  }, [tools]);

  const filteredTools = useMemo(() => {
    const normalized = String(query || '')
      .toLowerCase()
      .trim();

    return tools.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (!normalized) return true;

      const haystack = [
        entry.tool_name,
        entry.display_name,
        entry.category,
        entry.source_module,
        entry.description,
        ...(Array.isArray(entry.tags) ? entry.tags : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [categoryFilter, query, tools]);

  const openCreate = () => {
    setEditingTool(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (tool) => {
    setEditingTool(tool);
    setForm(toForm(tool));
    setDialogOpen(true);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = fromForm(form);

      if (!payload.tool_name) {
        throw new Error('Le nom technique du tool est requis.');
      }

      if (editingTool) {
        await updateTool(editingTool.id, payload);
        toast({ title: 'MCP tools', description: `Tool ${payload.tool_name} mis a jour.` });
      } else {
        await createTool(payload);
        toast({ title: 'MCP tools', description: `Tool ${payload.tool_name} cree.` });
      }

      setDialogOpen(false);
      setEditingTool(null);
      setForm(INITIAL_FORM);
    } catch (submitError) {
      toast({
        title: 'Erreur MCP tools',
        description: submitError?.message || 'Operation impossible.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (tool) => {
    const ok = window.confirm(`Supprimer definitivement le tool ${tool.tool_name} ?`);
    if (!ok) return;

    try {
      await deleteTool(tool.id);
      toast({ title: 'MCP tools', description: `Tool ${tool.tool_name} supprime.` });
    } catch (deleteError) {
      toast({
        title: 'Erreur suppression',
        description: deleteError?.message || 'Suppression impossible.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800" data-testid="admin-mcp-tools-manager">
      <CardHeader className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-300" />
              Registre MCP tools
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Gestion admin complete (create/read/update/delete) des enregistrements tools exposes au catalogue public.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading || submitting}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau tool
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingTool ? 'Modifier un tool MCP' : 'Creer un tool MCP'}</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Les champs alimentent automatiquement la page publique /mcp-tools.html.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tool_name">Nom technique *</Label>
                    <Input
                      id="tool_name"
                      value={form.tool_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, tool_name: event.target.value }))}
                      placeholder="get_dashboard_kpis"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Nom affiche</Label>
                    <Input
                      id="display_name"
                      value={form.display_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
                      placeholder="KPIs dashboard"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categorie</Label>
                    <Input
                      id="category"
                      value={form.category}
                      onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                      placeholder="analytics"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source_module">Module source</Label>
                    <Input
                      id="source_module"
                      value={form.source_module}
                      onChange={(event) => setForm((prev) => ({ ...prev, source_module: event.target.value }))}
                      placeholder="analytics.ts"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Description fonctionnelle du tool"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tags">Tags (separes par des virgules)</Label>
                    <Input
                      id="tags"
                      value={form.tags}
                      onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder="billing, invoices, accounting"
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="metadata_json">Metadata JSON</Label>
                    <Textarea
                      id="metadata_json"
                      value={form.metadata_json}
                      onChange={(event) => setForm((prev) => ({ ...prev, metadata_json: event.target.value }))}
                      className="bg-gray-900 border-gray-700 text-white font-mono min-h-[120px]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="is_active"
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))}
                    />
                    <Label htmlFor="is_active">Publie dans le catalogue</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="is_generated"
                      checked={form.is_generated}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_generated: Boolean(checked) }))}
                    />
                    <Label htmlFor="is_generated">Tool genere automatiquement</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    Annuler
                  </Button>
                  <Button onClick={onSubmit} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                    {submitting ? 'Enregistrement...' : editingTool ? 'Mettre a jour' : 'Creer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <McpKpi label="Total" value={stats.total} hint="enregistrements" />
          <McpKpi label="Actifs" value={stats.active} hint="publies" />
          <McpKpi label="Generes" value={stats.generated} hint="auto-gen" />
          <McpKpi label="Categories" value={stats.categories} hint="uniques" />
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher tool, module, categorie, tags..."
              className="pl-10 bg-gray-950 border-gray-800 text-white"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-sm text-gray-200"
          >
            <option value="all">Toutes categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Tool', 'Categorie', 'Source', 'Statut', 'Tags', 'MAJ', 'Actions'].map((header, index) => (
                  <th
                    key={header}
                    className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${index === 6 ? 'text-right' : 'text-left'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Aucun tool MCP pour les filtres actifs.
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-gray-800/40 align-top">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-100">{tool.tool_name}</p>
                      {tool.display_name ? <p className="text-xs text-gray-500 mt-1">{tool.display_name}</p> : null}
                      {tool.description ? <p className="text-xs text-gray-400 mt-2">{tool.description}</p> : null}
                    </td>
                    <td className="py-3 px-4 text-gray-300">{tool.category || '-'}</td>
                    <td className="py-3 px-4 text-gray-300">{tool.source_module || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            tool.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                          }
                        >
                          {tool.is_active ? 'actif' : 'inactif'}
                        </Badge>
                        {tool.is_generated ? (
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">genere</Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">manuel</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(tool.tags || []).length === 0 ? (
                          <span className="text-xs text-gray-500">-</span>
                        ) : (
                          tool.tags.map((tag) => (
                            <Badge key={`${tool.id}-${tag}`} className="bg-gray-800 text-gray-300 border-gray-700">
                              {tag}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {formatDateTime(tool.updated_at || tool.last_changed_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          onClick={() => openEdit(tool)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Editer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-300 hover:bg-red-950/30"
                          onClick={() => onDelete(tool)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const McpKpi = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xl font-semibold text-white mt-1">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{hint}</p>
  </div>
);

export default AdminMcpToolsManager;
