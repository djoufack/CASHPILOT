import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Copy, Check, Plus, Trash2, Key, Terminal, Globe,
  AlertTriangle, RefreshCw, Code2, MessageSquare, Zap, Cloud, Cpu
} from 'lucide-react';

const API_BASE_URL = 'https://cashpilot.tech/api/v1';
const MCP_SERVER_URL = 'https://cashpilot.tech/mcp';

// ---------------------------------------------------------------------------
// Clipboard helper
// ---------------------------------------------------------------------------
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="text-gray-400 hover:text-orange-400 h-7 px-2"
      title={`Copier ${label || ''}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Code block with copy
// ---------------------------------------------------------------------------
function CodeBlock({ code, language }) {
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} label="le code" />
      </div>
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP Config Section (URL-based, uses API key)
// ---------------------------------------------------------------------------
function McpConfigSection() {
  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Terminal className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Connexion MCP (Claude, VS Code, Cursor...)</CardTitle>
            <CardDescription className="text-gray-400">
              Pilotez CashPilot en langage naturel depuis votre assistant IA. 26 outils disponibles.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-300 font-medium mb-2">Comment connecter :</p>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Generez une <strong className="text-white">cle API</strong> dans la section ci-dessus</li>
            <li>L'<strong className="text-white">URL complete</strong> et la <strong className="text-white">configuration JSON</strong> s'affichent automatiquement</li>
            <li>Copiez selon votre client et collez — c'est pret</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white font-medium mb-1"><MessageSquare className="w-4 h-4" />Claude Desktop / Cursor</div>
            <p className="text-xs text-gray-500">Copiez l'<strong className="text-gray-400">URL</strong> et collez-la dans "Add MCP Server"</p>
          </div>
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white font-medium mb-1"><Terminal className="w-4 h-4" />Claude Code</div>
            <p className="text-xs text-gray-500">Copiez le <strong className="text-gray-400">JSON</strong> dans <code className="text-blue-400">~/.claude/settings.local.json</code></p>
          </div>
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white font-medium mb-1"><Code2 className="w-4 h-4" />VS Code (Cline)</div>
            <p className="text-xs text-gray-500">Copiez le <strong className="text-gray-400">JSON</strong> dans les parametres MCP de Cline</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MCP Connector Section (Anthropic API / Remote HTTP)
// ---------------------------------------------------------------------------
function McpConnectorSection() {
  const [activeTab, setActiveTab] = useState('messages-api');

  const mcpServerUrl = 'https://cashpilot.tech/mcp';

  const messagesApiExample = `import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    mcp_servers=[
        {
            "type": "url",
            "url": "${mcpServerUrl}",
            "name": "cashpilot",
            "authorization_token": "VOTRE_CLE_API"
        }
    ],
    messages=[
        {"role": "user", "content": "Liste mes 5 dernières factures"}
    ],
    tools=[{"type": "mcp_toolset", "server_label": "cashpilot"}],
    betas=["mcp-client-2025-11-20"]
)

print(response.content)`;

  const curlExample = `curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "content-type: application/json" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "anthropic-beta: mcp-client-2025-11-20" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "mcp_servers": [{
      "type": "url",
      "url": "${mcpServerUrl}",
      "name": "cashpilot",
      "authorization_token": "VOTRE_CLE_API"
    }],
    "tools": [{"type": "mcp_toolset", "server_label": "cashpilot"}],
    "messages": [{"role": "user", "content": "Liste mes factures"}]
  }'`;

  const tabs = [
    { id: 'messages-api', label: 'Python SDK', icon: <Code2 className="w-4 h-4" /> },
    { id: 'curl', label: 'cURL', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Cloud className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">MCP Connector — API Anthropic (distant)</CardTitle>
            <CardDescription className="text-gray-400">
              Connectez-vous a CashPilot depuis l'API Anthropic Messages, sans installation locale.
              Ideal pour les applications et agents IA en production.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* How it works */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
          <p className="text-sm text-purple-300 font-medium mb-2">Comment ca marche :</p>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Generez une <strong className="text-white">cle API CashPilot</strong> dans la section REST API ci-dessous</li>
            <li>Ajoutez le serveur MCP dans votre appel a l'API Anthropic avec <code className="text-purple-400 bg-gray-800 px-1 rounded">mcp_servers</code></li>
            <li>Utilisez <code className="text-purple-400 bg-gray-800 px-1 rounded">mcp_toolset</code> pour que Claude accede automatiquement aux 29 outils CashPilot</li>
            <li>Claude peut alors gerer vos factures, clients, paiements en langage naturel</li>
          </ol>
        </div>

        {/* Key variables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">URL du serveur MCP</Label>
              <CopyButton text={mcpServerUrl} />
            </div>
            <code className="text-sm text-purple-300 font-mono">{mcpServerUrl}</code>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Beta header requis</Label>
              <CopyButton text="mcp-client-2025-11-20" />
            </div>
            <code className="text-sm text-purple-300 font-mono">mcp-client-2025-11-20</code>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === t.id
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Code examples */}
        {activeTab === 'messages-api' && <CodeBlock code={messagesApiExample} language="python" />}
        {activeTab === 'curl' && <CodeBlock code={curlExample} language="bash" />}

        {/* Use cases */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Cpu className="w-4 h-4" />, label: 'Agents IA', desc: 'Integrez CashPilot dans vos agents autonomes (LangChain, CrewAI...)' },
            { icon: <Code2 className="w-4 h-4" />, label: 'App SaaS', desc: 'Ajoutez la comptabilite IA dans votre propre application' },
            { icon: <Cloud className="w-4 h-4" />, label: 'Workflows', desc: 'Automatisation cloud sans code local a installer' },
          ].map(ex => (
            <div key={ex.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white text-sm font-medium mb-1">{ex.icon}{ex.label}</div>
              <p className="text-xs text-gray-500">{ex.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          Le MCP Connector est en beta chez Anthropic. Header requis : <code className="text-purple-400">anthropic-beta: mcp-client-2025-11-20</code>.
          Le serveur CashPilot supporte SSE et Streamable HTTP.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// API Key Creation Form
// ---------------------------------------------------------------------------
function CreateApiKeyForm({ onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState({ read: true, write: false, delete: false });
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [formError, setFormError] = useState(null);

  const generateKey = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Donnez un nom a votre cle (ex: ChatGPT, Zapier, Script)');
      return;
    }

    if (!user?.id) {
      setFormError('Vous devez etre connecte pour generer une cle API. Rechargez la page.');
      return;
    }

    if (!supabase) {
      setFormError('Client Supabase non initialise. Verifiez la configuration.');
      return;
    }

    setCreating(true);
    try {
      // Generate random key: cpk_ + 48 random hex chars
      const randomBytes = new Uint8Array(24);
      crypto.getRandomValues(randomBytes);
      const rawKey = 'cpk_' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Hash with SHA-256 (same as Edge Function api-v1)
      const encoder = new TextEncoder();
      const encoded = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const selectedScopes = Object.entries(scopes).filter(([, v]) => v).map(([k]) => k);

      const { error } = await supabase.from('api_keys').insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: rawKey.slice(0, 12),
        scopes: selectedScopes,
        is_active: true
      });

      if (error) throw error;

      setNewKey(rawKey);
      setName('');
      setScopes({ read: true, write: false, delete: false });
      onCreated();

      toast({ title: 'Cle API creee', description: 'Copiez-la maintenant — elle ne sera plus affichee.' });
    } catch (err) {
      console.error('[CashPilot] API key generation error:', err);
      const msg = err?.message || String(err);
      setFormError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // If key just created — show ready-to-use URLs
  if (newKey) {
    const mcpUrl = `${MCP_SERVER_URL}?api_key=${newKey}`;
    const jsonConfig = JSON.stringify({
      mcpServers: {
        cashpilot: {
          url: mcpUrl
        }
      }
    }, null, 2);

    return (
      <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <p className="text-sm font-semibold text-green-300">Cle generee ! Vos configurations sont pretes.</p>
        </div>

        {/* MCP URL — for Claude Desktop */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 uppercase tracking-wider">URL MCP — collez dans Claude Desktop / Cursor / Windsurf</Label>
          <div className="flex items-center gap-2 bg-gray-950 rounded-lg p-3 border border-blue-500/30">
            <code className="text-blue-300 font-mono text-sm flex-1 break-all select-all">{mcpUrl}</code>
            <CopyButton text={mcpUrl} label="l'URL MCP" />
          </div>
        </div>

        {/* JSON config — for Claude Code / VS Code */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 uppercase tracking-wider">JSON — pour Claude Code / VS Code (Cline, Continue, Copilot)</Label>
          <CodeBlock code={jsonConfig} language="json" />
        </div>

        {/* Raw API key — for REST API / scripts */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 uppercase tracking-wider">Cle API brute — pour scripts, ChatGPT, Zapier</Label>
          <div className="flex items-center gap-2 bg-gray-950 rounded-lg p-3 border border-gray-700">
            <code className="text-green-400 font-mono text-sm flex-1 break-all select-all">{newKey}</code>
            <CopyButton text={newKey} label="la cle" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-yellow-300">Ces informations ne seront plus jamais affichees.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setNewKey(null)} className="text-gray-400 hover:text-white">
            J'ai copie, fermer
          </Button>
        </div>
      </div>
    );
  }

  const scopeBorderColor = { read: 'border-blue-500/40', write: 'border-orange-500/40', delete: 'border-red-500/40' };

  return (
    <div className="space-y-4 bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
      <div className="space-y-2">
        <Label className="text-sm text-gray-300">Nom de la cle <span className="text-red-400">*</span></Label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: ChatGPT, Zapier, Script Python, n8n..."
          className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-gray-300">Permissions</Label>
        <div className="flex flex-wrap gap-4">
          {/* Read — always on, not toggleable */}
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-blue-500/40 opacity-80">
            <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">Lecture <span className="text-xs text-gray-500 font-normal ml-1">(toujours active)</span></p>
              <p className="text-xs text-gray-500">GET — consulter factures, clients, KPIs...</p>
            </div>
          </div>
          {/* Write & Delete — toggleable */}
          {[
            { key: 'write', label: 'Ecriture', desc: 'POST/PUT — creer factures, clients, paiements...' },
            { key: 'delete', label: 'Suppression', desc: 'DELETE — supprimer des enregistrements' },
          ].map(scope => (
            <div
              key={scope.key}
              onClick={() => setScopes(s => ({ ...s, [scope.key]: !s[scope.key] }))}
              className={`flex items-center gap-3 bg-gray-800 rounded-lg p-3 cursor-pointer border transition-colors ${
                scopes[scope.key] ? scopeBorderColor[scope.key] : 'border-gray-700'
              }`}
            >
              <Switch
                checked={scopes[scope.key]}
                onCheckedChange={v => setScopes(s => ({ ...s, [scope.key]: v }))}
              />
              <div>
                <p className="text-sm text-white font-medium">{scope.label}</p>
                <p className="text-xs text-gray-500">{scope.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={generateKey}
        disabled={creating}
        className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
      >
        {creating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Generer la cle API
      </Button>

      {formError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{formError}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys List
// ---------------------------------------------------------------------------
function ApiKeysList({ keys, loading, onRevoke }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin w-6 h-6 text-gray-400" />
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Aucune cle API. Creez-en une pour connecter ChatGPT, Zapier, ou vos scripts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {keys.map(k => (
        <div
          key={k.id}
          className={`flex items-center justify-between bg-gray-800/50 border rounded-lg p-3 ${
            k.is_active ? 'border-gray-700' : 'border-red-900/30 opacity-50'
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Key className={`w-4 h-4 flex-shrink-0 ${k.is_active ? 'text-orange-400' : 'text-gray-600'}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-white truncate">{k.name}</span>
                <code className="text-xs text-gray-500 font-mono">{k.key_prefix}...</code>
                {!k.is_active && <Badge variant="destructive" className="text-xs">Revoquee</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span>
                  {k.scopes?.map(s => (
                    <Badge key={s} variant="outline" className="text-[10px] mr-1 border-gray-600 text-gray-400">{s}</Badge>
                  ))}
                </span>
                <span>Creee {new Date(k.created_at).toLocaleDateString('fr-FR')}</span>
                {k.last_used_at && (
                  <span>Utilisee {new Date(k.last_used_at).toLocaleDateString('fr-FR')}</span>
                )}
              </div>
            </div>
          </div>

          {k.is_active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRevoke(k.id, k.name)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// REST API Section
// ---------------------------------------------------------------------------
function RestApiSection({ keys, keysLoading, onKeysChanged }) {
  const { toast } = useToast();

  const handleRevoke = async (id, name) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cle revoquee', description: `"${name}" ne peut plus acceder a l'API.` });
      onKeysChanged();
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Globe className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Connexion REST API (ChatGPT, Zapier, scripts...)</CardTitle>
            <CardDescription className="text-gray-400">
              Generez des cles API pour connecter des logiciels externes a CashPilot.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* How it works */}
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
          <p className="text-sm text-orange-300 font-medium mb-2">Comment ca marche :</p>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Generez une cle API ci-dessous</li>
            <li>Copiez-la (elle ne sera affichee qu'une seule fois)</li>
            <li>Configurez-la dans votre outil avec le header <code className="text-orange-400 bg-gray-800 px-1 rounded">X-API-Key</code></li>
            <li>Envoyez vos requetes vers <code className="text-orange-400 bg-gray-800 px-1 rounded">{API_BASE_URL}</code></li>
          </ol>
        </div>

        {/* API Base URL */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">URL de base de l'API</Label>
            <CopyButton text={API_BASE_URL} />
          </div>
          <code className="text-sm text-orange-300 font-mono">{API_BASE_URL}</code>
        </div>

        {/* Quick examples */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <MessageSquare className="w-4 h-4" />, label: 'ChatGPT', desc: 'Custom GPT > Actions > collez openapi.yaml + cle API' },
            { icon: <Zap className="w-4 h-4" />, label: 'Zapier / Make', desc: 'Module HTTP > header X-API-Key + URL de base' },
            { icon: <Code2 className="w-4 h-4" />, label: 'Python / Node.js', desc: 'Header X-API-Key dans vos requetes HTTP' },
          ].map(ex => (
            <div key={ex.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white text-sm font-medium mb-1">{ex.icon}{ex.label}</div>
              <p className="text-xs text-gray-500">{ex.desc}</p>
            </div>
          ))}
        </div>

        {/* Create key form */}
        <CreateApiKeyForm onCreated={onKeysChanged} />

        {/* Existing keys */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm text-gray-300">Vos cles API</Label>
            <Button variant="ghost" size="sm" onClick={onKeysChanged} className="text-gray-400 hover:text-white h-7">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <ApiKeysList keys={keys} loading={keysLoading} onRevoke={handleRevoke} />
        </div>

        {/* cURL example */}
        <div>
          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Exemple rapide (cURL)</Label>
          <CodeBlock code={`curl -H "X-API-Key: cpk_votre_cle_ici" \\\n  "${API_BASE_URL}/analytics/kpis"`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const ConnectionSettings = () => {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const fetchKeys = useCallback(async () => {
    if (!user) { setKeysLoading(false); return; }
    setKeysLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) console.error('[CashPilot] fetchKeys error:', error);
      setApiKeys(data || []);
    } catch (err) {
      console.error('[CashPilot] fetchKeys exception:', err);
    } finally {
      setKeysLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  return (
    <div className="space-y-6">
      <RestApiSection keys={apiKeys} keysLoading={keysLoading} onKeysChanged={fetchKeys} />
      <McpConfigSection />
      <McpConnectorSection />
    </div>
  );
};

export default ConnectionSettings;
