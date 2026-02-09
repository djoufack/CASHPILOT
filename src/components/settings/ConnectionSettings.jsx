import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
function McpConfigSection({ apiKeys }) {
  const [activeClient, setActiveClient] = useState('claude-code');

  const activeKey = apiKeys?.find(k => k.is_active);
  const keyPlaceholder = activeKey ? `${activeKey.key_prefix}...` : 'cpk_votre_cle_ici';

  const mcpConfig = JSON.stringify({
    mcpServers: {
      cashpilot: {
        url: MCP_SERVER_URL,
        headers: {
          'X-API-Key': keyPlaceholder
        }
      }
    }
  }, null, 2);

  const clients = [
    {
      id: 'claude-code',
      name: 'Claude Code',
      icon: <Terminal className="w-4 h-4" />,
      file: '~/.claude/settings.local.json'
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      icon: <MessageSquare className="w-4 h-4" />,
      file: /Win/.test(navigator.userAgent)
        ? '%APPDATA%\\Claude\\claude_desktop_config.json'
        : '~/Library/Application Support/Claude/claude_desktop_config.json'
    },
    {
      id: 'vscode',
      name: 'VS Code (Cline)',
      icon: <Code2 className="w-4 h-4" />,
      file: 'Parametres Cline > MCP Servers'
    }
  ];

  const active = clients.find(c => c.id === activeClient);

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
              Pilotez CashPilot en langage naturel depuis votre assistant IA.
              Aucune installation locale requise — connexion distante via votre cle API.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* How it works */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-300 font-medium mb-2">Comment ca marche :</p>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Generez une <strong className="text-white">cle API</strong> dans la section <em>"REST API"</em> ci-dessus</li>
            <li>Copiez la configuration ci-dessous dans votre client MCP</li>
            <li>Remplacez <code className="text-blue-400 bg-gray-800 px-1 rounded">{keyPlaceholder}</code> par votre vraie cle API</li>
            <li>Relancez votre client — les 29 outils CashPilot sont disponibles</li>
          </ol>
        </div>

        {/* No key warning */}
        {!activeKey && (
          <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-300">
              Vous n'avez pas encore de cle API. Creez-en une dans la section <strong>"REST API"</strong> ci-dessus pour commencer.
            </p>
          </div>
        )}

        {/* Client selector */}
        <div className="flex gap-2 flex-wrap">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveClient(c.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeClient === c.id
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {c.icon}
              {c.name}
            </button>
          ))}
        </div>

        {/* Config file location */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Fichier :</span>
          <code className="bg-gray-800 px-2 py-0.5 rounded text-blue-300 text-xs">{active?.file}</code>
          <CopyButton text={active?.file || ''} label="le chemin" />
        </div>

        {/* Config JSON */}
        <CodeBlock code={mcpConfig} language="json" />

        {/* Key info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">URL du serveur</Label>
              <CopyButton text={MCP_SERVER_URL} />
            </div>
            <code className="text-sm text-blue-300 font-mono">{MCP_SERVER_URL}</code>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Authentification</Label>
            <p className="text-sm text-gray-300">Cle API personnelle (header <code className="text-blue-400">X-API-Key</code>)</p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Chaque utilisateur utilise sa propre cle API. Les permissions (lecture, ecriture, suppression) sont definies lors de la creation de la cle.
          Transport : Streamable HTTP + SSE.
        </p>
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

  const generateKey = async () => {
    if (!name.trim()) {
      toast({ title: 'Nom requis', description: 'Donnez un nom a votre cle (ex: ChatGPT, Zapier, Script)', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      // Generate random key: cpk_ + 32 random hex chars
      const randomBytes = new Uint8Array(24);
      crypto.getRandomValues(randomBytes);
      const rawKey = 'cpk_' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Hash with SHA-256 (same as Edge Function api-v1)
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
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
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // If key just created, show it
  if (newKey) {
    return (
      <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <p className="text-sm font-semibold text-yellow-300">Copiez cette cle maintenant — elle ne sera plus jamais affichee</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-950 rounded-lg p-3 border border-gray-700">
          <code className="text-green-400 font-mono text-sm flex-1 break-all select-all">{newKey}</code>
          <CopyButton text={newKey} label="la cle" />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">Utilisez cette cle dans le header <code className="text-orange-400">X-API-Key</code></p>
          <Button variant="ghost" size="sm" onClick={() => setNewKey(null)} className="text-gray-400 hover:text-white">
            J'ai copie, fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
      <div className="space-y-2">
        <Label className="text-sm text-gray-300">Nom de la cle</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: ChatGPT, Zapier, Script Python, n8n..."
          className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-gray-300">Permissions</Label>
        <div className="flex flex-wrap gap-4">
          {[
            { key: 'read', label: 'Lecture', desc: 'GET — consulter factures, clients, KPIs...', color: 'blue' },
            { key: 'write', label: 'Ecriture', desc: 'POST/PUT — creer factures, clients, paiements...', color: 'orange' },
            { key: 'delete', label: 'Suppression', desc: 'DELETE — supprimer des enregistrements', color: 'red' },
          ].map(scope => (
            <label
              key={scope.key}
              className={`flex items-center gap-3 bg-gray-800 rounded-lg p-3 cursor-pointer border transition-colors ${
                scopes[scope.key] ? `border-${scope.color}-500/40` : 'border-gray-700'
              }`}
            >
              <Switch
                checked={scopes[scope.key]}
                onCheckedChange={v => setScopes(s => ({ ...s, [scope.key]: v }))}
                disabled={scope.key === 'read'}
              />
              <div>
                <p className="text-sm text-white font-medium">{scope.label}</p>
                <p className="text-xs text-gray-500">{scope.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Button
        onClick={generateKey}
        disabled={creating || !name.trim()}
        className="bg-orange-500 hover:bg-orange-600 text-white"
      >
        {creating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Generer la cle API
      </Button>
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
function RestApiSection({ keys, onKeysChanged }) {
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
          <ApiKeysList keys={keys} loading={!keys} onRevoke={handleRevoke} />
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

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setApiKeys(data || []);
  }, [user]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  return (
    <div className="space-y-6">
      <RestApiSection keys={apiKeys} onKeysChanged={fetchKeys} />
      <McpConfigSection apiKeys={apiKeys} />
      <McpConnectorSection />
    </div>
  );
};

export default ConnectionSettings;
