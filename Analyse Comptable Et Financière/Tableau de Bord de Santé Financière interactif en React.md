import React, { useState } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Cell, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, ShieldCheck, Activity, Wallet, 
  AlertCircle, CheckCircle2, Info, ArrowRightLeft,
  Sparkles, BrainCircuit, Loader2, Search, FileText, Globe, Scale, Coins
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('structure');
  const [sector, setSector] = useState('Logiciels & SaaS');
  const [region, setRegion] = useState('France');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Données de base
  const profitabilityData = [
    { year: '2020', chiffreAffaire: 800, ebitda: 180, resultatBrut: 60 },
    { year: '2021', chiffreAffaire: 950, ebitda: 220, resultatBrut: 85 },
    { year: '2022', chiffreAffaire: 1100, ebitda: 280, resultatBrut: 120 },
    { year: '2023', chiffreAffaire: 1250, ebitda: 320, resultatBrut: 160 },
  ];

  const getTaxRate = () => {
    if (region === 'France') return 0.25;
    if (region === 'Belgique') return 0.25;
    if (region === 'Zone OHADA') return 0.28;
    return 0.25;
  };

  const getValuationMultiple = () => {
    let base = 7;
    if (sector === 'Logiciels & SaaS') base = 10;
    if (sector === 'Industrie') base = 6;
    if (sector === 'Construction') base = 5;
    
    if (region === 'Zone OHADA') base -= 2;
    return base;
  };

  const currentEbitda = 320;
  const estimatedValue = currentEbitda * getValuationMultiple();

  const processedData = profitabilityData.map(d => ({
    ...d,
    is: d.resultatBrut * getTaxRate(),
    resultatNet: d.resultatBrut * (1 - getTaxRate())
  }));

  const structureData = [
    { name: 'Capitaux Propres', value: 450, color: '#0ea5e9' },
    { name: 'Dettes Financières', value: 300, color: '#6366f1' },
    { name: 'Dettes Exploitation', value: 250, color: '#94a3b8' },
  ];

  const liquidityData = [
    { category: 'Générale', value: 1.8, target: 1.5 },
    { category: 'Réduite', value: 1.1, target: 1.0 },
    { category: 'Immédiate', value: 0.4, target: 0.2 },
  ];

  const generateAiAudit = async () => {
    setIsLoading(true);
    setAiAnalysis(null);
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const systemPrompt = `Expert financier zones France, Belgique, OHADA. Analysez la valeur d'entreprise.`;
    const userQuery = `Entreprise ${region}, ${sector}. EBITDA: 320k€. Analysez la valorisation (Multiples vs DCF) avec les primes de risque locales.`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      tools: [{ "google_search": {} }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      setAiAnalysis(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (error) {
      setAiAnalysis("Erreur d'analyse.");
    } finally {
      setIsLoading(false);
    }
  };

  const Card = ({ title, children, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            Finance & Valorisation Augmentée
            <Coins className="w-6 h-6 text-amber-500" />
          </h1>
          <p className="text-slate-500">Pilotage stratégique et estimation de valeur ({region}).</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400 ml-2" />
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none pr-8 cursor-pointer">
              <option>France</option>
              <option>Belgique</option>
              <option>Zone OHADA</option>
            </select>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400 ml-2" />
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none pr-8 cursor-pointer">
              <option>Logiciels & SaaS</option>
              <option>Industrie</option>
              <option>Commerce / Retail</option>
              <option>Construction</option>
            </select>
          </div>
        </div>
      </header>

      <nav className="max-w-7xl mx-auto mb-8 flex flex-wrap gap-2">
        {['structure', 'performance', 'valuation', 'ai'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-full font-medium transition-all capitalize ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-100'}`}>
            {tab === 'ai' ? 'Audit IA ✨' : tab === 'valuation' ? 'Valorisation' : tab}
          </button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto">
        {activeTab === 'valuation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card title="Estimation de Valeur" icon={Coins} color="bg-amber-500">
              <div className="text-center py-6">
                <p className="text-sm text-slate-400 uppercase font-bold tracking-wider">Valeur d'Entreprise Estimée</p>
                <h2 className="text-5xl font-black text-slate-900 my-2">{estimatedValue} k€</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold mt-2">
                  Basé sur un multiple de {getValuationMultiple()}x EBITDA
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">EBITDA (N)</span>
                  <span className="font-bold">320 k€</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Multiple Sectoriel</span>
                  <span className="font-bold">{getValuationMultiple()}x</span>
                </div>
              </div>
            </Card>

            <Card title="Sensibilité WACC" icon={Activity} color="bg-blue-600">
               <p className="text-xs text-slate-500 mb-4">Impact du taux d'actualisation sur la valeur (Modèle DCF)</p>
               <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>WACC {region === 'Zone OHADA' ? '20%' : '10%'}</span>
                      <span>Valeur Actuelle</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full w-full"></div>
                    </div>
                  </div>
                  <p className="text-xs italic text-slate-400 leading-relaxed">
                    {region === 'Zone OHADA' 
                      ? "Le WACC élevé en zone OHADA (risque pays) réduit mécaniquement la valeur des flux futurs par rapport à l'Europe." 
                      : "La stabilité des taux en Europe favorise des valorisations DCF plus élevées."}
                  </p>
               </div>
            </Card>

            <Card title="Audit de Valeur IA" icon={BrainCircuit} color="bg-indigo-600">
               <p className="text-sm text-slate-600 mb-4">L'IA analyse la pertinence de ce multiple par rapport au marché local.</p>
               <button onClick={() => setActiveTab('ai')} className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                 Lancer l'audit stratégique <Sparkles className="w-4 h-4" />
               </button>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
             <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Diagnostic de Valeur & Stratégie</h2>
                  <p className="text-indigo-100">Analyse croisée EBITDA, Risque Pays et Fiscalité.</p>
                </div>
                <button onClick={generateAiAudit} disabled={isLoading} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                  {isLoading ? "Analyse..." : "Auditer la valeur"}
                </button>
             </div>
             <div className="p-8">
                {aiAnalysis ? (
                  <div className="whitespace-pre-wrap text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-100 font-medium leading-relaxed">
                    {aiAnalysis}
                  </div>
                ) : <div className="text-center py-10 text-slate-300">Prêt pour l'analyse de {region}.</div>}
             </div>
          </div>
        )}

        {(activeTab === 'performance' || activeTab === 'structure') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card title="Structure du Passif" icon={ShieldCheck} color="bg-blue-500">
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={structureData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {structureData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                   </ResponsiveContainer>
                </div>
             </Card>
             <Card title="Rentabilité (Nette d'IS)" icon={TrendingUp} color="bg-emerald-600">
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="resultatNet" stroke="#059669" fill="#10b981" fillOpacity={0.1} name="Net après impôt" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;