import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  BarChart3,
  Clock,
  FileText,
  TrendingUp,
  Shield,
  Zap,
  Building2,
  Briefcase,
  Store,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Calculator,
  Package,
  Receipt,
  PieChart,
  Globe,
  Smartphone,
  Star,
  Lightbulb,
  Target,
  DollarSign,
  TrendingDown,
  UserPlus,
  Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import '../styles/landing.css';

const LandingPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const targetAudience = [
    {
      icon: <UserCheck className="w-8 h-8" />,
      title: "Freelances",
      description: "Gestion complète de votre activité"
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "PME/TPE",
      description: "Suite de gestion d'entreprise"
    },
    {
      icon: <Briefcase className="w-8 h-8" />,
      title: "Agences",
      description: "Gestion projets et clients"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Consultants",
      description: "Suivi temps et facturation"
    },
    {
      icon: <Store className="w-8 h-8" />,
      title: "Commerçants",
      description: "Gestion stock et fournisseurs"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Services",
      description: "Facturation et projets"
    }
  ];

  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestion Clients",
      description: "CRM complet pour suivre vos relations commerciales",
      color: "from-blue-400 to-cyan-400"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Projets & Tâches",
      description: "Organisez et suivez vos projets avec Kanban",
      color: "from-purple-400 to-pink-400"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Suivi du Temps",
      description: "Feuilles de temps et chronomètre intégré",
      color: "from-green-400 to-emerald-400"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Facturation",
      description: "Factures et devis professionnels en PDF",
      color: "from-yellow-400 to-orange-400"
    },
    {
      icon: <Calculator className="w-6 h-6" />,
      title: "Comptabilité Multi-Pays",
      description: "France, Belgique, OHADA - Écritures automatiques en temps réel",
      color: "from-red-400 to-rose-400"
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Gestion Stock",
      description: "Inventaire avec scanner de codes-barres",
      color: "from-indigo-400 to-blue-400"
    },
    {
      icon: <Receipt className="w-6 h-6" />,
      title: "Dépenses",
      description: "Suivi et catégorisation des dépenses",
      color: "from-teal-400 to-cyan-400"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Fournisseurs",
      description: "Géolocalisation et analytics fournisseurs",
      color: "from-violet-400 to-purple-400"
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      title: "Rapports & Analytics",
      description: "Visualisations et exports PDF personnalisés",
      color: "from-lime-400 to-green-400"
    },
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: "Simulations Financières",
      description: "Scénarios what-if et projections pour anticiper l'avenir",
      color: "from-amber-400 to-yellow-400"
    }
  ];

  const simulationUseCases = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Simulation de Croissance",
      question: "Si j'augmente mes prix de 10%, quel sera l'impact sur ma trésorerie dans 6 mois ?",
      color: "from-green-400 to-emerald-500"
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Planification d'Embauche",
      question: "Si j'embauche 2 personnes à 3000€/mois, puis-je tenir financièrement ?",
      color: "from-blue-400 to-cyan-500"
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Investissement",
      question: "Si j'achète un équipement à 50 000€, comment évoluera mon BFR ?",
      color: "from-purple-400 to-pink-500"
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Optimisation Trésorerie",
      question: "Si je négocie 60 jours de délai fournisseur au lieu de 30, quel impact sur le BFR ?",
      color: "from-orange-400 to-red-500"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Budget Prévisionnel",
      question: "Créer un budget pour l'année prochaine et comparer avec le réel",
      color: "from-indigo-400 to-violet-500"
    }
  ];

  const stats = [
    { number: "< 1s", label: "Génération Écritures" },
    { number: "100%", label: "Auto-Comptabilité" },
    { number: "3 Pays", label: "FR • BE • OHADA" },
    { number: "0", label: "Saisie Manuelle" }
  ];

  const advantages = [
    { icon: <Sparkles className="w-5 h-5" />, text: "Vous introduisez les données, CashPilot fait tout le reste automatiquement" },
    { icon: <Globe className="w-5 h-5" />, text: "Multi-Pays : France (PCG), Belgique (PCMN), OHADA (17 pays)" },
    { icon: <Lightbulb className="w-5 h-5" />, text: "Simulations financières : Testez vos décisions avant de les prendre" },
    { icon: <Zap className="w-5 h-5" />, text: "Génération instantanée des écritures comptables (< 1 seconde)" },
    { icon: <Shield className="w-5 h-5" />, text: "Reverse accounting : Annulations et corrections automatiques" },
    { icon: <Star className="w-5 h-5" />, text: "Tout-en-un : Gestion, Facturation, Comptabilité, Simulations" }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#141b3d] to-[#1a1f4a]"></div>

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative container mx-auto px-6 py-24 lg:py-32">
          <motion.div
            initial="hidden"
            animate={isVisible ? "visible" : "hidden"}
            variants={staggerContainer}
            className="text-center max-w-5xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-block px-6 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full border border-blue-500/30 text-sm font-medium text-blue-300 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 inline mr-2" />
                Solution de Gestion d'Entreprise Complète
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="gradient-text text-5xl lg:text-7xl font-bold mb-6 leading-tight"
            >
              CashPilot
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="gradient-text text-2xl lg:text-4xl font-semibold mb-8"
            >
              La révolution de la comptabilité automatisée
            </motion.p>

            <motion.p
              variants={fadeInUp}
              className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
            >
              <span className="text-green-400 font-semibold">Vous introduisez les données, CashPilot fait le reste.</span>
              <br />
              Gestion financière et comptabilité 100% automatisée pour la France, la Belgique et l'Afrique (OHADA).
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap gap-3 justify-center mb-12"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full text-green-300 text-sm font-medium backdrop-blur-sm">
                <Zap className="w-4 h-4" />
                Temps Réel (&lt; 1 seconde)
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/40 rounded-full text-purple-300 text-sm font-medium backdrop-blur-sm">
                <Globe className="w-4 h-4" />
                France • Belgique • OHADA
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-sm font-medium backdrop-blur-sm">
                <Lightbulb className="w-4 h-4" />
                Simulations What-If
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-sm font-medium backdrop-blur-sm">
                <Shield className="w-4 h-4" />
                Reverse Accounting
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 text-sm font-medium backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                100% Automatisé
              </span>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-yellow-500 via-green-400 to-purple-500 text-black font-semibold px-8 py-6 text-lg hover:scale-105 transition-transform shadow-2xl shadow-purple-500/50"
                onClick={() => navigate('/signup')}
              >
                Démarrer Gratuitement
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-6 text-lg backdrop-blur-sm"
                onClick={() => navigate('/login')}
              >
                Voir la Démo
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl lg:text-5xl font-bold gradient-text mb-2">
                    {stat.number}
                  </div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Auto-Accounting Section */}
      <section className="py-24 bg-gradient-to-b from-[#1a1f4a] to-[#0f1229] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse-custom"></div>
          <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-custom delay-500"></div>
        </div>

        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-6 py-2 bg-gradient-to-r from-green-500/20 to-purple-500/20 rounded-full border border-green-500/30 text-sm font-medium text-green-300 backdrop-blur-sm mb-6">
              <Zap className="w-4 h-4 inline mr-2" />
              Solution Tout-en-Un Multi-Pays
            </span>
            <h2 className="gradient-text text-4xl lg:text-5xl font-bold mb-6">
              Gestion Financière & Comptable Automatisée
            </h2>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto">
              <span className="text-green-400 font-semibold">Vous introduisez les données, CashPilot fait le reste.</span>
              <br />
              Comptabilité France 🇫🇷 • Belgique 🇧🇪 • OHADA 🌍
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Génération Automatique */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30 backdrop-blur-sm p-8 h-full hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl mb-6 mx-auto">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="gradient-text text-2xl font-bold mb-4 text-center">
                  Génération Automatique
                </h3>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Créez une facture → Écritures générées instantanément</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Enregistrez une dépense → Écritures créées automatiquement</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Recevez un paiement → Écriture bancaire automatique</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Temps Réel */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30 backdrop-blur-sm p-8 h-full hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl mb-6 mx-auto">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="gradient-text text-2xl font-bold mb-4 text-center">
                  Mises à Jour Temps Réel
                </h3>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Diagnostic financier actualisé automatiquement</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Bilan et compte de résultat en direct (&lt; 1 seconde)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Synchronisation multi-onglets et multi-utilisateurs</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Reverse Accounting */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/30 backdrop-blur-sm p-8 h-full hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl mb-6 mx-auto">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="gradient-text text-2xl font-bold mb-4 text-center">
                  Reverse Accounting
                </h3>
                <div className="space-y-3 text-gray-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Supprimez un paiement → Écriture d'annulation (OD)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Supprimez une dépense → Écritures inversées automatiquement</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <p className="text-sm">Annulez une facture → Contrepassation automatique</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Normes & Standards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <Card className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-sm p-8">
              <div className="text-center mb-6">
                <h3 className="gradient-text text-2xl font-bold mb-3">
                  Multi-Pays & Conformité Totale
                </h3>
                <p className="text-gray-300">
                  Un système qui s'adapte aux normes comptables de votre pays
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold gradient-text mb-2">🇫🇷</div>
                  <div className="text-sm text-gray-300 font-semibold mb-1">France</div>
                  <div className="text-xs text-gray-400">PCG • Liasse fiscale</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold gradient-text mb-2">🇧🇪</div>
                  <div className="text-sm text-gray-300 font-semibold mb-1">Belgique</div>
                  <div className="text-xs text-gray-400">PCMN • Déclaration TVA</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold gradient-text mb-2">🌍</div>
                  <div className="text-sm text-gray-300 font-semibold mb-1">OHADA</div>
                  <div className="text-xs text-gray-400">17 pays africains</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-600/50">
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text mb-1">&lt; 1s</div>
                  <div className="text-xs text-gray-400">Génération</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text mb-1">100%</div>
                  <div className="text-xs text-gray-400">Traçabilité</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text mb-1">0</div>
                  <div className="text-xs text-gray-400">Saisie manuelle</div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Financial Simulation Section */}
      <section className="py-24 bg-gradient-to-b from-[#0f1229] via-[#1a1f4a] to-[#0f1229] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse-custom"></div>
          <div className="absolute bottom-1/3 left-20 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse-custom delay-700"></div>
        </div>

        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-6 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-full border border-amber-500/30 text-sm font-medium text-amber-300 backdrop-blur-sm mb-6">
              <Lightbulb className="w-4 h-4 inline mr-2" />
              Simulations & Projections Financières
            </span>
            <h2 className="gradient-text text-4xl lg:text-5xl font-bold mb-6">
              Anticipez l'Avenir de Votre Entreprise
            </h2>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto">
              Testez vos décisions avant de les prendre. Scénarios "What-if", projections et aide à la décision.
            </p>
          </motion.div>

          {/* Use Cases Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-12">
            {simulationUseCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-sm p-6 h-full hover:scale-105 transition-all duration-300 hover:shadow-xl hover:border-amber-500/30">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${useCase.color} mb-4`}>
                    {useCase.icon}
                  </div>
                  <h3 className="text-amber-300 text-lg font-bold mb-3">
                    {useCase.title}
                  </h3>
                  <p className="text-gray-400 text-sm italic">
                    "{useCase.question}"
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Simulation Features */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <Card className="bg-gradient-to-r from-amber-900/30 via-yellow-900/30 to-amber-900/30 border-amber-500/30 backdrop-blur-sm p-8">
              <h3 className="gradient-text text-2xl font-bold mb-6 text-center">
                Fonctionnalités de Simulation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-amber-300 font-semibold mb-2">Projections Financières</h4>
                    <p className="text-gray-400 text-sm">Prédisez l'évolution de votre trésorerie, CA et rentabilité sur 3, 6, 12 mois</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-purple-300 font-semibold mb-2">Scénarios What-If</h4>
                    <p className="text-gray-400 text-sm">Testez l'impact de vos décisions : embauches, investissements, prix...</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-blue-300 font-semibold mb-2">Budget Prévisionnel vs Réel</h4>
                    <p className="text-gray-400 text-sm">Créez des budgets prévisionnels et comparez automatiquement avec le réel</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-green-300 font-semibold mb-2">Aide à la Décision</h4>
                    <p className="text-gray-400 text-sm">Comparez plusieurs options et choisissez la meilleure stratégie</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-24 bg-gradient-to-b from-[#0f1229] to-[#1a1f4a] relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="gradient-text text-4xl lg:text-5xl font-bold mb-6">
              Conçu Pour Vous
            </h2>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto">
              Quelle que soit votre activité, CashPilot s'adapte à vos besoins
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {targetAudience.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30 backdrop-blur-sm p-8 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
                  <div className="gradient-icon mb-4">
                    {item.icon}
                  </div>
                  <h3 className="gradient-text text-2xl font-bold mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-300">
                    {item.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-[#0f1229] to-[#1a1f4a] relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="gradient-text text-4xl lg:text-5xl font-bold mb-6">
              Fonctionnalités Principales
            </h2>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto">
              Une suite complète d'outils pour gérer tous les aspects de votre entreprise
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700/50 backdrop-blur-sm p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 h-full">
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.color} mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="gradient-text text-xl font-bold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-300 text-sm">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-24 bg-gradient-to-b from-[#1a1f4a] to-[#0f1229] relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="gradient-text text-4xl lg:text-5xl font-bold mb-6">
              Pourquoi Choisir CashPilot ?
            </h2>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto">
              Des avantages qui font la différence
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {advantages.map((advantage, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 backdrop-blur-sm hover:scale-105 transition-all"
                >
                  <div className="gradient-icon flex-shrink-0">
                    {advantage.icon}
                  </div>
                  <p className="text-gray-200 font-medium">{advantage.text}</p>
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 ml-auto" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-[#0f1229] to-[#0a0e27] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center max-w-4xl mx-auto"
          >
            <h2 className="gradient-text text-4xl lg:text-6xl font-bold mb-6">
              Prêt à transformer votre gestion d'entreprise ?
            </h2>
            <p className="text-gray-300 text-xl mb-12">
              Rejoignez des milliers d'entrepreneurs qui ont déjà choisi CashPilot
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-yellow-500 via-green-400 to-purple-500 text-black font-semibold px-12 py-6 text-lg hover:scale-105 transition-transform shadow-2xl shadow-purple-500/50"
                onClick={() => navigate('/signup')}
              >
                Commencer Maintenant
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-12 py-6 text-lg backdrop-blur-sm"
                onClick={() => navigate('/login')}
              >
                Contactez-nous
              </Button>
            </div>

            <p className="text-gray-400 mt-8 text-sm">
              ✨ Essai gratuit • Sans carte de crédit • Installation en 2 minutes
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#0a0e27] border-t border-blue-500/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand Section */}
            <div>
              <h3 className="gradient-text text-2xl font-bold mb-3">CashPilot</h3>
              <p className="text-gray-400 text-sm mb-4">
                La solution complète pour votre entreprise
              </p>
              <p className="text-gray-500 text-xs">
                Propulsé par DMG Management
              </p>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-purple-300 font-semibold mb-4 text-sm uppercase tracking-wider">
                Contact
              </h4>
              <div className="space-y-3 text-sm">
                <a
                  href="https://www.dmgmanagement.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>www.dmgmanagement.tech</span>
                </a>
                <a
                  href="mailto:info@dmgmanagement.tech"
                  className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>info@dmgmanagement.tech</span>
                </a>
                <a
                  href="tel:+32472544765"
                  className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>+32.472.544.765</span>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-purple-300 font-semibold mb-4 text-sm uppercase tracking-wider">
                Liens Rapides
              </h4>
              <div className="flex flex-col gap-3 text-sm">
                <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
                  À propos
                </a>
                <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
                  Fonctionnalités
                </a>
                <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
                  Tarifs
                </a>
                <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
                  Support
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-blue-500/20 text-center text-gray-500 text-sm">
            <p>© 2024 CashPilot. Tous droits réservés.</p>
            <p className="mt-2 text-xs">
              Développé avec ❤️ par{' '}
              <a
                href="https://www.dmgmanagement.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                DMG Management
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
