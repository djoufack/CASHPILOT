import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Wallet, ArrowRight, Globe, Clock, Zap, ChevronDown,
  Send, Search, Download, CheckCircle2, Lightbulb, AlertTriangle,
  Mail, ExternalLink, BookOpen, ListChecks
} from 'lucide-react';
import '../styles/peppol-guide.css';

/* ── Data ─────────────────────────────────────── */

const TOC_ITEMS = [
  { id: 'peppol-intro', label: "Qu'est-ce que Peppol ?" },
  { id: 'architecture', label: 'Qui fait quoi ?' },
  { id: 'step-1', label: '1. Compte Scrada' },
  { id: 'step-2', label: '2. Identifiants API' },
  { id: 'step-3', label: '3. Configurer CashPilot' },
  { id: 'usage-send', label: 'Envoyer une facture' },
  { id: 'usage-check', label: 'Vérifier un client' },
  { id: 'usage-receive', label: 'Recevoir des factures' },
  { id: 'faq', label: 'FAQ' },
  { id: 'support', label: 'Support' },
];

const FAQ_ITEMS = [
  {
    q: 'Combien coûte Peppol ?',
    a: "Le coût dépend de votre abonnement Scrada (2-11 €/mois). CashPilot ne facture rien de supplémentaire pour la fonctionnalité Peppol.",
  },
  {
    q: 'Mes identifiants Scrada sont-ils sécurisés ?',
    a: "Oui. Les identifiants sont stockés de manière chiffrée dans la base de données Supabase de CashPilot, et ne sont jamais exposés côté client. Les appels à l'API Scrada transitent par des Edge Functions côté serveur.",
  },
  {
    q: "Que se passe-t-il si l'envoi échoue ?",
    a: 'Le statut passe à "Erreur" avec un message explicatif. Vous pouvez corriger la facture et la renvoyer. Les erreurs courantes sont : identifiant Peppol du destinataire invalide, facture non conforme EN16931, ou problème temporaire du réseau Peppol.',
  },
  {
    q: "Puis-je utiliser un autre Access Point que Scrada ?",
    a: "L'architecture de CashPilot est conçue avec un système d'adaptateurs. Actuellement, seul Scrada est supporté. D'autres Access Points pourront être ajoutés dans le futur.",
  },
  {
    q: "Mon client n'est pas sur Peppol, que faire ?",
    a: "Vous pouvez toujours lui envoyer la facture par email en PDF classique. La facturation Peppol est un canal supplémentaire, pas un remplacement.",
  },
];

const ARCHITECTURE_ROWS = [
  { step: 'Créer un compte Scrada', who: 'vous', detail: '1 fois, 5 minutes' },
  { step: 'Choisir un abonnement Scrada', who: 'vous', detail: 'À partir de 2 €/mois' },
  { step: 'Générer une clé API Scrada', who: 'vous', detail: '1 fois, dans le portail Scrada' },
  { step: 'Coller les identifiants dans CashPilot', who: 'vous', detail: '1 fois, dans Paramètres > Peppol' },
  { step: 'Tester la connexion', who: 'vous', detail: '1 clic dans CashPilot' },
  { step: 'Générer le XML UBL conforme', who: 'cashpilot', detail: 'Automatique à chaque envoi' },
  { step: 'Envoyer la facture via Peppol', who: 'cashpilot', detail: '1 clic sur "Envoyer via Peppol"' },
  { step: 'Suivre le statut de livraison', who: 'cashpilot', detail: 'Polling automatique (2 min)' },
  { step: 'Vérifier si un client est sur Peppol', who: 'cashpilot', detail: '1 clic dans la fiche client' },
  { step: 'Recevoir des factures entrantes', who: 'cashpilot', detail: 'Synchronisation manuelle' },
];

const SCRADA_PLANS = [
  { name: 'Peppol Inbox', price: '2 €/mois', volume: 'Réception uniquement', ideal: 'Recevoir des factures', recommended: false },
  { name: 'Basic Peppol Box', price: '6 €/mois', volume: '600 factures/an', ideal: 'Freelances, petites PME', recommended: true },
  { name: 'Professional', price: '11 €/mois', volume: '1 200 factures/an', ideal: 'PME actives', recommended: false },
  { name: 'Premium', price: 'Sur mesure', volume: 'Illimité', ideal: 'Grandes entreprises', recommended: false },
];

/* ── Component ────────────────────────────────── */

const PeppolGuidePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('peppol-intro');
  const [openFaq, setOpenFaq] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef(null);

  // IntersectionObserver for TOC active tracking
  useEffect(() => {
    const sections = TOC_ITEMS.map(item => document.getElementById(item.id)).filter(Boolean);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(section => observerRef.current.observe(section));

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTocOpen(false);
    }
  }, []);

  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="peppol-guide">
      {/* ── Navbar ── */}
      <nav className="pg-navbar" role="navigation" aria-label="Navigation Peppol">
        <div className="pg-navbar-inner">
          <a href="/" className="pg-logo" onClick={(e) => { e.preventDefault(); handleNavigate('/'); }}>
            <Wallet size={22} />
            <span>CashPilot</span>
          </a>
          <div className="pg-nav-actions">
            {user ? (
              <button className="pg-btn-primary" onClick={() => handleNavigate('/app')}>
                Tableau de bord <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button className="pg-btn-ghost" onClick={() => handleNavigate('/login')}>Connexion</button>
                <button className="pg-btn-primary" onClick={() => handleNavigate('/signup')}>
                  Démarrer <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pg-hero">
        <div className="pg-hero-inner">
          <div className="pg-badge"><Globe size={14} /> Guide Officiel</div>
          <h1>Connexion Peppol via Scrada</h1>
          <p className="pg-hero-subtitle">
            Guide complet pour envoyer et recevoir des factures via le réseau Peppol
            depuis CashPilot, en utilisant Scrada comme Access Point certifié belge.
          </p>
          <div className="pg-stats">
            <span className="pg-stat-pill"><Clock size={16} /> Configuration en 9 minutes</span>
            <span className="pg-stat-pill"><Zap size={16} /> À partir de 2 €/mois</span>
          </div>
          <div className="pg-hero-image">
            <img src="/images/peppol-scrada-guide.jpg" alt="Guide de connexion CashPilot & Peppol via Scrada" />
          </div>
        </div>
      </section>

      {/* ── Layout: TOC + Content ── */}
      <div className="pg-layout">
        {/* Mobile TOC toggle */}
        <button
          className={`pg-toc-mobile-btn ${tocOpen ? 'open' : ''}`}
          onClick={() => setTocOpen(!tocOpen)}
        >
          <ListChecks size={16} /> Sommaire <ChevronDown size={16} />
        </button>

        {/* TOC Sidebar */}
        <aside className={`pg-toc ${tocOpen ? 'mobile-open' : ''}`}>
          <div className="pg-toc-title">Sommaire</div>
          {TOC_ITEMS.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); scrollToSection(item.id); }}
            >
              {item.label}
            </a>
          ))}
        </aside>

        {/* Content */}
        <main className="pg-content">

          {/* ─── Intro ─── */}
          <section id="peppol-intro" className="pg-section">
            <h2><BookOpen /> Qu'est-ce que Peppol ?</h2>
            <p>
              <strong>Peppol</strong> (Pan-European Public Procurement OnLine) est le réseau européen
              d'échange de factures électroniques. En Belgique, il est <strong>obligatoire</strong> pour
              la facturation au secteur public (B2G) et de plus en plus utilisé en B2B.
            </p>
            <p>
              Avec CashPilot + Scrada, vos factures sont envoyées au format <strong>Peppol BIS Billing 3.0</strong> (UBL 2.1),
              conforme aux normes EN16931 et SYSCOHADA.
            </p>
          </section>

          {/* ─── Architecture ─── */}
          <section id="architecture" className="pg-section">
            <h2><ListChecks /> Architecture : qui fait quoi ?</h2>
            <div className="pg-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Étape</th>
                    <th>Responsable</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {ARCHITECTURE_ROWS.map((row, i) => (
                    <tr key={i}>
                      <td>{row.step}</td>
                      <td>
                        <span className={row.who === 'vous' ? 'badge-vous' : 'badge-cashpilot'}>
                          {row.who === 'vous' ? 'Vous' : 'CashPilot'}
                        </span>
                      </td>
                      <td>{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── Step 1 ─── */}
          <section id="step-1" className="pg-section">
            <div className="pg-step">
              <div className="pg-step-number">1</div>
              <div className="pg-step-content">
                <h3>
                  Créer un compte Scrada
                  <span className="pg-time-badge"><Clock size={12} /> 5 min</span>
                </h3>
                <ol className="pg-instructions">
                  <li>
                    Allez sur <a href="https://my.scrada.be" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>my.scrada.be</a>
                  </li>
                  <li>Cliquez sur <strong>&quot;Créer un compte&quot;</strong></li>
                  <li>Remplissez les informations de votre entreprise</li>
                  <li>Choisissez un abonnement :</li>
                </ol>

                <div className="pg-table-wrapper" style={{ marginTop: '12px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Prix</th>
                        <th>Volume</th>
                        <th>Idéal pour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCRADA_PLANS.map((plan, i) => (
                        <tr key={i} className={plan.recommended ? 'recommended' : ''}>
                          <td>
                            <strong>{plan.name}</strong>
                            {plan.recommended && <span className="badge-recommended">Recommandé</span>}
                          </td>
                          <td>{plan.price}</td>
                          <td>{plan.volume}</td>
                          <td>{plan.ideal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pg-tip">
                  <Lightbulb />
                  <p>
                    <strong>Recommandation :</strong> Pour un freelance ou une petite PME, le plan <strong>Basic Peppol Box</strong> à 6 €/mois
                    couvre largement les besoins (50 factures/mois).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Step 2 ─── */}
          <section id="step-2" className="pg-section">
            <div className="pg-step">
              <div className="pg-step-number">2</div>
              <div className="pg-step-content">
                <h3>
                  Générer les identifiants API
                  <span className="pg-time-badge"><Clock size={12} /> 2 min</span>
                </h3>
                <p>Dans le portail Scrada (<a href="https://my.scrada.be" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>my.scrada.be</a>) :</p>
                <ol className="pg-instructions">
                  <li>Allez dans <strong>Paramètres &gt; Clés API</strong></li>
                  <li>Cliquez sur <strong>&quot;Générer une nouvelle clé API&quot;</strong></li>
                  <li>Notez les <strong>3 informations</strong> suivantes :</li>
                </ol>

                <div className="pg-table-wrapper" style={{ marginTop: '12px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Champ</th>
                        <th>Où le trouver</th>
                        <th>Exemple</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Company ID</strong></td>
                        <td>Dashboard ou URL du portail</td>
                        <td><code>a1b2c3d4-e5f6-7890-...</code></td>
                      </tr>
                      <tr>
                        <td><strong>API Key</strong></td>
                        <td>Paramètres &gt; Clés API</td>
                        <td>(chaîne longue générée)</td>
                      </tr>
                      <tr>
                        <td><strong>Password</strong></td>
                        <td>Paramètres &gt; Clés API</td>
                        <td>(mot de passe associé)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pg-warning">
                  <AlertTriangle />
                  <p>
                    <strong>Important :</strong> Conservez ces identifiants en lieu sûr. Le mot de passe ne sera
                    pas re-démontrable après génération.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Step 3 ─── */}
          <section id="step-3" className="pg-section">
            <div className="pg-step">
              <div className="pg-step-number">3</div>
              <div className="pg-step-content">
                <h3>
                  Configurer CashPilot
                  <span className="pg-time-badge"><Clock size={12} /> 2 min</span>
                </h3>
                <ol className="pg-instructions">
                  <li>Dans CashPilot, allez dans <strong>Paramètres &gt; Peppol</strong></li>
                  <li>
                    Section <strong>&quot;Identifiant Peppol de l'entreprise&quot;</strong> :
                    <br /><span style={{ color: '#9ca3af' }}>N° entreprise BCE/KBO (10 chiffres) + Schéma <code>0208</code></span>
                  </li>
                  <li>
                    Section <strong>&quot;Scrada — Access Point Peppol&quot;</strong> :
                    <br /><span style={{ color: '#9ca3af' }}>Collez votre Company ID, API Key et Password</span>
                  </li>
                  <li>Cliquez sur <strong>&quot;Tester la connexion&quot;</strong></li>
                  <li>Cliquez sur <strong>&quot;Enregistrer&quot;</strong></li>
                </ol>

                <div className="pg-tip">
                  <Lightbulb />
                  <p>
                    Si le test affiche un indicateur vert <strong>&quot;Connexion Scrada réussie&quot;</strong>, vous êtes prêt
                    à envoyer votre première facture Peppol.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Usage: Send ─── */}
          <section id="usage-send" className="pg-section">
            <div className="pg-usage-header">
              <div className="pg-usage-icon blue"><Send /></div>
              <h2 style={{ border: 'none', padding: 0, margin: 0 }}>Envoyer une facture via Peppol</h2>
            </div>

            <h3>Prérequis</h3>
            <ul className="pg-check-list">
              <li><CheckCircle2 /> Votre entreprise doit avoir un identifiant Peppol configuré (étape 3)</li>
              <li><CheckCircle2 /> Le client doit avoir un identifiant Peppol dans sa fiche (N° BCE ou SIRET)</li>
              <li><CheckCircle2 /> La facture doit respecter les règles EN16931 (CashPilot les valide automatiquement)</li>
            </ul>

            <h3>Processus</h3>
            <ol className="pg-instructions">
              <li>Ouvrez la facture à envoyer</li>
              <li>Cliquez sur <strong>&quot;Envoyer via Peppol&quot;</strong> (icône globe)</li>
              <li>CashPilot valide la facture (13 règles EN16931), génère le XML UBL 2.1 et l'envoie à Scrada</li>
              <li>Le suivi automatique du statut se lance immédiatement</li>
            </ol>

            <h3>Évolution du statut</h3>
            <div className="pg-table-wrapper">
              <table>
                <thead>
                  <tr><th>Statut</th><th>Signification</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong className="status-pending">En attente</strong></td><td>Facture envoyée, en cours de traitement par Scrada</td></tr>
                  <tr><td><strong className="status-delivered">Livré</strong></td><td>Facture reçue par le destinataire</td></tr>
                  <tr><td><strong className="status-error">Erreur</strong></td><td>Problème de transmission (détails affichés)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="pg-tip">
              <Lightbulb />
              <p>
                CashPilot vérifie le statut toutes les 10 secondes pendant 2 minutes après l'envoi.
                Le badge de statut se met à jour automatiquement.
              </p>
            </div>
          </section>

          {/* ─── Usage: Check ─── */}
          <section id="usage-check" className="pg-section">
            <div className="pg-usage-header">
              <div className="pg-usage-icon emerald"><Search /></div>
              <h2 style={{ border: 'none', padding: 0, margin: 0 }}>Vérifier si un client est sur Peppol</h2>
            </div>
            <ol className="pg-instructions">
              <li>Ouvrez la fiche du client</li>
              <li>Dans la section <strong>&quot;Peppol / E-Invoicing&quot;</strong>, saisissez le numéro BCE/KBO</li>
              <li>Cliquez sur <strong>&quot;Vérifier&quot;</strong></li>
              <li>CashPilot interroge le registre Peppol via Scrada</li>
            </ol>
            <p>
              <span style={{ color: '#6ee7b7' }}><strong>Vert :</strong></span> &quot;Enregistré sur Peppol&quot; — vous pouvez lui envoyer des factures électroniques.
              <br />
              <span style={{ color: '#f87171' }}><strong>Rouge :</strong></span> &quot;Non enregistré sur Peppol&quot; — le client n'est pas encore sur le réseau.
            </p>
          </section>

          {/* ─── Usage: Receive ─── */}
          <section id="usage-receive" className="pg-section">
            <div className="pg-usage-header">
              <div className="pg-usage-icon purple"><Download /></div>
              <h2 style={{ border: 'none', padding: 0, margin: 0 }}>Recevoir des factures via Peppol</h2>
            </div>

            <div className="pg-tip">
              <Lightbulb />
              <p>Cette fonctionnalité nécessite que votre entreprise soit enregistrée sur le réseau Peppol via Scrada.</p>
            </div>

            <ol className="pg-instructions">
              <li>Allez dans la section <strong>&quot;Factures reçues via Peppol&quot;</strong></li>
              <li>Cliquez sur <strong>&quot;Synchroniser&quot;</strong></li>
              <li>CashPilot récupère les nouvelles factures depuis Scrada</li>
              <li>Pour chaque facture reçue, vous pouvez : voir les détails, télécharger le PDF, consulter le XML UBL source</li>
            </ol>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" className="pg-section">
            <h2><BookOpen /> Questions fréquentes</h2>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`pg-faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="pg-faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                  <ChevronDown />
                </button>
                <div className="pg-faq-answer">
                  <div className="pg-faq-answer-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </section>

          {/* ─── Support ─── */}
          <section id="support" className="pg-section">
            <h2><Mail /> Support</h2>
            <div className="pg-support-grid">
              <div className="pg-support-card">
                <h3>Problème CashPilot</h3>
                <p>Contactez le support CashPilot pour toute question relative à la configuration ou l'utilisation de la fonctionnalité Peppol.</p>
              </div>
              <div className="pg-support-card">
                <h3>Problème Scrada</h3>
                <p>
                  <a href="mailto:support@scrada.be">support@scrada.be</a>
                  <br />
                  <a href="https://my.scrada.be" target="_blank" rel="noopener noreferrer">
                    my.scrada.be <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>
                  <br />
                  <a href="https://scrada.be/api-documentation/" target="_blank" rel="noopener noreferrer">
                    Documentation API <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>
                </p>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="pg-footer">
        &copy; {new Date().getFullYear()} CashPilot. Tous droits réservés.
      </footer>
    </div>
  );
};

export default PeppolGuidePage;
