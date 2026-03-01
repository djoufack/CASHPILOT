import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Cell, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, ShieldCheck, Activity, Wallet, 
  AlertCircle, CheckCircle2, Info, ArrowRightLeft,
  Sparkles, BrainCircuit, Loader2, Search, FileText, Globe, Scale, Coins, Receipt
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sector, setSector] = useState('Logiciels & SaaS');
  const [region, setRegion] = useState('France');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- LOGIQUE DE CALCUL FINANCIER ---
  const ca = 1250000;
  const purchases = 300000;
  const personnel = 450000;
  const otherCharges = 150000;
  const depreciation = 50000;
  const rdExpenses = 100000;
  const interest = 20000;

  const ebitda = ca - purchases - personnel - otherCharges;
  const ebit = ebitda - depreciation;
  const rcai = ebit - interest;

  // Calcul IS dynamique
  const getTaxCalculations = () => {
    let taxAmount = 0;
    let taxCredits = 0;
    let imf = 0;

    if (region === 'France') {
      const reducedTax = Math.min(rcai, 42500) * 0.15;
      const normalTax = Math.max(0, rcai - 42500) * 0.25;
      taxAmount = reducedTax + normalTax;
      taxCredits = rdExpenses * 0.30; // CIR
    } else if (region === 'Belgique') {
      const reducedTax = Math.min(rcai, 100000) * 0.20;
      const normalTax = Math.max(0, rcai - 100000) * 0.25;
      taxAmount = reducedTax + normalTax;
      taxCredits = rdExpenses * 0.15; // Credit d'impôt R&D
    } else { // OHADA
      taxAmount = rcai * 0.28;
      imf = ca * 0.005; // Impôt Minimum Forfaitaire
      taxAmount = Math.max(taxAmount, imf);
      taxCredits = 0; // Exonérations hors P&L (Code Invest)
    }

    return { taxAmount, taxCredits, netResult: rcai - taxAmount + taxCredits };
  };

  const { taxAmount, taxCredits, netResult } = getTaxCalculations();

  // Valorisation
  const getMultiple = () => {
    let m = 7;
    if (sector === 'Logiciels & SaaS') m = 12;
    if (sector === 'Industrie') m = 6;
    if (region === 'Zone OHADA') m -= 2.5;
    return m;
  };
  const valo = ebitda * getMultiple();

  // Données graphiques
  const historyData = [
    { name: 'N-2', ca: 900, result: 60, cash: 40 },
    { name: 'N-1', ca: 1050, result: 85, cash: 55 },
    { name: 'N (Actuel)', ca: ca/1000, result: netResult/1000, cash: (netResult + depreciation)/1000 },
  ];

  const generateAiAudit = async () => {
    setIsLoading(true);
    setAiAnalysis(null);
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const context = `Secteur: ${sector}, Pays: ${region}, CA: ${ca}, EBITDA: ${ebitda}, Résultat Net: ${netResult}, Valo: ${valo}.`;
    const userQuery = `Audit complet pour cette entreprise. Analysez : 1. La structure de coût. 2. L'efficience fiscale (IS vs Crédits d'impôt). 3. Le réalisme de la valorisation de ${valo}€ par rapport au risque pays et secteur. Proposez 3 axes d'amélioration du cash-flow.`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          tools: [{ "google_search": {} }],
          systemInstruction: { parts: [{ text: "Expert en audit financier international. Réponse structurée, technique et chiffrée." }] }
        })
      });
      const result = await response.json();
      setAiAnalysis(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (e) {
      setAiAnalysis("Erreur lors de l'audit IA.");
    } finally {
      setIsLoading(false);
    }
  };

  const Card = ({ title, children, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-xl ${color} text-white shadow-lg`}>
          <Icon size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-900">
      {/* Header Statique */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              Pilotage Élite
              <div className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-md uppercase tracking-widest font-bold">Pro</div>
            </h1>
            <p className="text-slate-500 font-medium">Analyse Financière & Fiscale : France • Belgique • OHADA</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
              <Globe className="text-indigo-500" size={18} />
              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none cursor-pointer"
              >
                <option>France</option>
                <option>Belgique</option>
                <option>Zone OHADA</option>
              </select>
            </div>
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
              <Activity className="text-indigo-500" size={18} />
              <select 
                value={sector} 
                onChange={(e) => setSector(e.target.value)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none cursor-pointer"
              >
                <option>Logiciels & SaaS</option>
                <option>Industrie</option>
                <option>Retail</option>
                <option>Construction</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Onglets */}
      <nav className="max-w-7xl mx-auto mb-8 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200 inline-flex gap-1 overflow-x-auto w-full md:w-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'tax', label: 'Fiscalité', icon: Scale },
          { id: 'val', label: 'Valorisation', icon: Coins },
          { id: 'ai', label: 'Audit IA', icon: BrainCircuit },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto space-y-8">
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Chiffre d\'Affaires', val: `${(ca/1000).toFixed(0)} k€`, sub: '+12% vs N-1', icon: Receipt, color: 'text-blue-600' },
                { label: 'EBITDA (EBE)', val: `${(ebitda/1000).toFixed(0)} k€`, sub: '28% de marge', icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'Résultat Net', val: `${(netResult/1000).toFixed(0)} k€`, sub: 'Après impôt', icon: ShieldCheck, color: 'text-indigo-600' },
                { label: 'Valorisation', val: `${(valo/1000).toFixed(0)} k€`, sub: `Mult. ${getMultiple()}x`, icon: Coins, color: 'text-amber-600' },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-slate-50 rounded-lg"><s.icon size={20} className={s.color} /></div>
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                  <h4 className="text-2xl font-black text-slate-900 my-1">{s.val}</h4>
                  <p className={`text-xs font-bold ${s.sub.includes('+') ? 'text-emerald-500' : 'text-slate-500'}`}>{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card title="Performance & Croissance" icon={TrendingUp} color="bg-emerald-500">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis hide />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Legend />
                      <Area type="monotone" dataKey="ca" fill="#10b981" fillOpacity={0.05} stroke="#10b981" strokeWidth={3} name="CA (k€)" />
                      <Bar dataKey="result" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} name="Résultat Net (k€)" />
                      <Line type="monotone" dataKey="cash" stroke="#f59e0b" strokeWidth={2} dot={{r: 4}} name="Cash-Flow (k€)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Ratios de Structure" icon={ShieldCheck} color="bg-indigo-500">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Indépendance Fin.', val: '45%', status: 'good', target: '> 25%' },
                    { label: 'Liquidité Gén.', val: '1.8x', status: 'good', target: '> 1.2x' },
                    { label: 'DSO (Clients)', val: '45j', status: 'good', target: '< 60j' },
                    { label: 'Gearing', val: '0.6', status: 'good', target: '< 1.0' },
                  ].map((r, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 mb-1">{r.label}</p>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-black text-slate-800">{r.val}</span>
                        <CheckCircle2 size={16} className="text-emerald-500 mb-1" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Cible : {r.target}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-sm text-indigo-700 font-medium flex gap-3">
                  <Info size={20} className="shrink-0" />
                  La structure financière est optimale pour une levée de dette ou un investissement Capex.
                </div>
              </Card>
            </div>
          </>
        )}

        {activeTab === 'tax' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card title={`Synthèse Fiscale (${region})`} icon={Scale} color="bg-slate-800">
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b pb-4">
                  <div>
                    <p className="text-sm text-slate-400 font-bold">RÉSULTAT AVANT IMPÔT</p>
                    <h3 className="text-2xl font-black">{(rcai/1000).toFixed(1)} k€</h3>
                  </div>
                  <ArrowRightLeft className="text-slate-300 mb-2" />
                  <div className="text-right">
                    <p className="text-sm text-slate-400 font-bold">IMPÔT DÛ (IS)</p>
                    <h3 className="text-2xl font-black text-red-500">{(taxAmount/1000).toFixed(1)} k€</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-600 mb-1">INCITATIONS / CRÉDITS</p>
                    <h4 className="text-xl font-black text-emerald-700">+{(taxCredits/1000).toFixed(1)} k€</h4>
                    <p className="text-[10px] text-emerald-500 mt-1">{region === 'France' ? 'CIR/CII' : region === 'Belgique' ? 'Crédit R&D' : 'Exonération Code Inv.'}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 mb-1">TAUX EFFECTIF</p>
                    <h4 className="text-xl font-black text-white">{(((taxAmount - taxCredits) / rcai) * 100).toFixed(1)} %</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Vs {region === 'Zone OHADA' ? '28%' : '25%'} théorique</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-2 mb-2">
                    <AlertCircle size={14} /> Vigilance Particulière
                  </p>
                  <p className="text-sm text-amber-800">
                    {region === 'Zone OHADA' 
                      ? "Attention à l'Impôt Minimum Forfaitaire (IMF) de 0.5% du CA qui pèse lourd si vos marges diminuent." 
                      : "L'optimisation via la R&D est ici le levier principal de création de valeur nette."}
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Traitement Comptable & Cash" icon={Receipt} color="bg-slate-500">
              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                  <h5 className="font-bold text-sm mb-2">Écriture au Journal (Calculée)</h5>
                  <div className="font-mono text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                    {region === 'France' && "4487 État - Produits à recevoir : 30 000€ (D)\n699 Produits - Crédits d'impôt : 30 000€ (C)"}
                    {region === 'Belgique' && "453 Précompte retenu : 15 000€ (D)\n62 Charges sociales : 15 000€ (C)"}
                    {region === 'Zone OHADA' && "691 Impôt sur bénéfices : IMF (D)\n441 État - Impôt IS : IMF (C)"}
                  </div>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                  <h5 className="font-bold text-sm mb-2">Impact Cash-Flow</h5>
                  <p className="text-sm text-slate-600 italic">
                    {region === 'France' ? "Le cash du CIR sera encaissé en N+1 (PME). Décalage de trésorerie à prévoir." : "Gain de cash immédiat sur les décaissements mensuels."}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'val' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card title="Valeur Vénale Estimée" icon={Coins} color="bg-amber-500">
              <div className="text-center py-10">
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-2">Enterprise Value (VE)</p>
                <h2 className="text-6xl font-black text-slate-900">{(valo/1000).toFixed(0)} <span className="text-3xl text-slate-400">k€</span></h2>
                <div className="mt-8 flex justify-center gap-4">
                   <div className="text-center">
                     <p className="text-[10px] font-bold text-slate-400">EBITDA</p>
                     <p className="font-black">{(ebitda/1000).toFixed(0)}k</p>
                   </div>
                   <div className="h-8 w-[1px] bg-slate-200" />
                   <div className="text-center">
                     <p className="text-[10px] font-bold text-slate-400">MULTIPLE</p>
                     <p className="font-black text-amber-600">{getMultiple()}x</p>
                   </div>
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2">
              <Card title="Analyse de Risque Pays & Capital" icon={Activity} color="bg-red-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                  <div>
                    <h5 className="font-bold text-sm mb-4">Coût du Capital (WACC)</h5>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-4xl font-black text-red-600">{region === 'Zone OHADA' ? '18.5%' : '9.2%'}</div>
                      <p className="text-xs text-slate-500 leading-snug">
                        {region === 'Zone OHADA' 
                          ? "Inclus une prime de risque pays de +10% liée à l'instabilité monétaire et au coût de l'emprunt local." 
                          : "Taux stable lié à la zone Euro. Favorise les investissements long-terme."}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs"><span>Taux sans risque</span><span className="font-bold">{region === 'Zone OHADA' ? '7.5%' : '3.5%'}</span></div>
                      <div className="flex justify-between text-xs"><span>Prime de risque</span><span className="font-bold">{region === 'Zone OHADA' ? '11%' : '5.7%'}</span></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h5 className="font-bold text-sm mb-2">Note Stratégique</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      La valorisation de {sector} en {region} est impactée par la {region === 'Zone OHADA' ? 'liquidité limitée du marché secondaire' : 'forte intensité concurrentielle sur les multiples M&A'}.
                      Une sortie industrielle pourrait justifier une prime de +20%.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-12 text-white relative">
              <div className="relative z-10 max-w-3xl">
                <h2 className="text-4xl font-black mb-4 flex items-center gap-4">
                  Audit Stratégique IA
                  <Sparkles className="text-amber-400" size={32} />
                </h2>
                <p className="text-indigo-100 text-lg font-medium opacity-90 mb-8">
                  Analyse multicritères de votre structure financière incluant le benchmarking sectoriel en {region} et la simulation fiscale prédictive.
                </p>
                <button 
                  onClick={generateAiAudit} 
                  disabled={isLoading}
                  className="bg-white text-indigo-900 px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                  {isLoading ? "Consultation en cours..." : "Générer l'Audit Complet"}
                </button>
              </div>
              <div className="absolute top-0 right-0 p-12 opacity-10 hidden lg:block">
                <BrainCircuit size={300} strokeWidth={1} />
              </div>
            </div>

            <div className="p-12 flex-1">
              {aiAnalysis ? (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="prose prose-slate max-w-none">
                    <div className="bg-[#fcfdfe] p-10 rounded-[32px] border border-slate-100 shadow-inner text-slate-700 leading-relaxed text-lg whitespace-pre-wrap font-medium">
                      {aiAnalysis}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                    <Search size={40} className="opacity-20" />
                  </div>
                  <p className="text-xl font-bold opacity-40 italic">En attente de vos données pour audit...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm">
        <p>© 2024 Pilotage Élite - Solution d'Intelligence Financière Multi-Zones</p>
        <div className="flex gap-6 font-bold">
          <span>France (PCG/CGI)</span>
          <span>Belgique (CSA/PCN)</span>
          <span>OHADA (SYSCOHADA)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;