import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import {
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Lightbulb,
  Shield,
  CheckCircle2,
  TrendingUp,
  Users,
  Building2,
  Briefcase,
  Store,
  UserCheck,
  BarChart3,
  Clock,
  FileText,
  Calculator,
  Package,
  Receipt,
  PieChart,
  Target,
  DollarSign,
  UserPlus,
  Wallet,
  Menu,
  Play,
  Star,
  Smartphone,
  Bot,
  Mic,
  Workflow,
  Plug,
  Lock,
  ShieldCheck,
  Brain,
  Landmark,
  Mail,
  Repeat,
  Webhook,
  Coins,
  Download,
  Rocket,
  Wand2
} from 'lucide-react';
import '../styles/landing.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [mobileMenuActive, setMobileMenuActive] = useState(false);
  const [navbarScrolled, setNavbarScrolled] = useState(false);

  const preloaderRef = useRef(null);
  const cursorFollowerRef = useRef(null);
  const cursorDotRef = useRef(null);
  const heroCanvasRef = useRef(null);
  const navbarRef = useRef(null);

  // Preloader
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      if (preloaderRef.current) {
        preloaderRef.current.classList.add('loaded');
      }
      document.body.style.overflow = 'visible';

      // Trigger hero animations
      setTimeout(() => {
        const animatedElements = document.querySelectorAll('.animate-in');
        animatedElements.forEach((el, index) => {
          const delay = parseInt(el.dataset.delay) || index * 100;
          setTimeout(() => {
            el.classList.add('visible');
          }, delay);
        });
      }, 300);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Custom Cursor
  useEffect(() => {
    if (window.innerWidth <= 768) return;

    const cursor = cursorFollowerRef.current;
    const dot = cursorDotRef.current;

    if (!cursor || !dot) return;

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let dotX = 0, dotY = 0;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    document.addEventListener('mousemove', handleMouseMove);

    const animateCursor = () => {
      cursorX += (mouseX - cursorX) * 0.1;
      cursorY += (mouseY - cursorY) * 0.1;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';

      dotX += (mouseX - dotX) * 0.3;
      dotY += (mouseY - dotY) * 0.3;
      dot.style.left = dotX + 'px';
      dot.style.top = dotY + 'px';

      requestAnimationFrame(animateCursor);
    };

    animateCursor();

    // Hover effects
    const interactiveElements = document.querySelectorAll('a, button, .feature-card, .audience-card, .simulation-card, .accounting-card, .country-item, .advantage-item');

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Navigation Scroll
  useEffect(() => {
    let lastScroll = 0;

    const handleScroll = () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 50) {
        setNavbarScrolled(true);
      } else {
        setNavbarScrolled(false);
      }

      if (navbarRef.current) {
        if (currentScroll > lastScroll && currentScroll > 200) {
          navbarRef.current.style.transform = 'translateY(-100%)';
        } else {
          navbarRef.current.style.transform = 'translateY(0)';
        }
      }

      lastScroll = currentScroll;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Three.js 3D Background
  useEffect(() => {
    if (!heroCanvasRef.current || typeof THREE === 'undefined') return;

    const canvas = heroCanvasRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 10;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Lines
    const linesGeometry = new THREE.BufferGeometry();
    const linesCount = 100;
    const linesPositions = new Float32Array(linesCount * 6);

    for (let i = 0; i < linesCount * 6; i += 6) {
      const x1 = (Math.random() - 0.5) * 8;
      const y1 = (Math.random() - 0.5) * 8;
      const z1 = (Math.random() - 0.5) * 8;
      const x2 = x1 + (Math.random() - 0.5) * 2;
      const y2 = y1 + (Math.random() - 0.5) * 2;
      const z2 = z1 + (Math.random() - 0.5) * 2;

      linesPositions[i] = x1;
      linesPositions[i + 1] = y1;
      linesPositions[i + 2] = z1;
      linesPositions[i + 3] = x2;
      linesPositions[i + 4] = y2;
      linesPositions[i + 5] = z2;
    }

    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linesPositions, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.2
    });

    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    scene.add(linesMesh);

    camera.position.z = 3;

    let mouseX = 0, mouseY = 0;

    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    document.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);

      particlesMesh.rotation.x += 0.0003;
      particlesMesh.rotation.y += 0.0005;

      linesMesh.rotation.x += 0.0002;
      linesMesh.rotation.y += 0.0003;

      particlesMesh.rotation.x += mouseY * 0.0005;
      particlesMesh.rotation.y += mouseX * 0.0005;

      const time = Date.now() * 0.001;
      const hue = (Math.sin(time * 0.5) + 1) * 0.5 * 60 + 240;
      particlesMaterial.color.setHSL(hue / 360, 0.7, 0.6);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // GSAP Scroll Animations
  useEffect(() => {
    if (!isLoaded) return;

    // Section headers
    gsap.utils.toArray('.section-header').forEach(header => {
      gsap.from(header, {
        opacity: 0,
        y: 60,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: header,
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    // Accounting cards
    gsap.utils.toArray('.accounting-card').forEach((card, index) => {
      gsap.from(card, {
        opacity: 0,
        y: 80,
        rotationX: -15,
        duration: 0.8,
        delay: index * 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    // Magnetic buttons
    const buttons = document.querySelectorAll('.magnetic-btn');
    buttons.forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(button, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      button.addEventListener('mouseleave', () => {
        gsap.to(button, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.3)'
        });
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [isLoaded]);

  const toggleMobileMenu = () => {
    setMobileMenuActive(!mobileMenuActive);
    document.body.style.overflow = !mobileMenuActive ? 'hidden' : 'visible';
  };

  const closeMobileMenu = () => {
    setMobileMenuActive(false);
    document.body.style.overflow = 'visible';
  };

  const handleNavigate = (path) => {
    console.log(`Navigating to: ${path}`);
    navigate(path);
  };

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const target = document.querySelector(targetId);
    if (target) {
      const offsetTop = target.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
    closeMobileMenu();
  };

  return (
    <div className="landing-page">
      {/* Preloader */}
      <div id="preloader" ref={preloaderRef}>
        <div className="loader-container">
          <div className="logo-loader">
            <span className="logo-text">CashPilot</span>
            <div className="loader-bar"></div>
          </div>
        </div>
      </div>

      {/* Cursor follower */}
      <div className="cursor-follower" ref={cursorFollowerRef}></div>
      <div className="cursor-dot" ref={cursorDotRef}></div>

      {/* Navigation */}
      <nav id="navbar" className={`navbar ${navbarScrolled ? 'scrolled' : ''}`} ref={navbarRef}>
        <div className="nav-container">
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <Wallet className="logo-icon" />
            <span>CashPilot</span>
          </a>
          <div className="nav-links">
            <a href="#features" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#features')}>Fonctionnalités</a>
            <a href="#simulation" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#simulation')}>Simulations</a>
            <a href="#audience" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#audience')}>Pour qui ?</a>
            <a href="#advantages" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#advantages')}>Avantages</a>
            <a href="/pricing" className="nav-link" onClick={(e) => { e.preventDefault(); handleNavigate('/pricing'); }}>Prix</a>
            <a href="/mcp-tools.html" className="nav-link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open('/mcp-tools.html', '_blank'); }}>MCP Tools</a>
            <a href="/guide/" className="nav-link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open('/guide/', '_blank'); }}>Guide</a>
            <button className="nav-peppol-btn" onClick={() => handleNavigate('/peppol-guide')}>
              <Globe /> Peppol
            </button>
          </div>
          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={() => handleNavigate('/login')}>Connexion</button>
            <button className="btn btn-primary magnetic-btn" onClick={() => handleNavigate('/signup')}>
              Démarrer <ArrowRight />
            </button>
          </div>
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            <Menu />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div id="mobile-menu" className={`mobile-menu ${mobileMenuActive ? 'active' : ''}`}>
        <div className="mobile-menu-content">
          <a href="#features" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#features')}>Fonctionnalités</a>
          <a href="#simulation" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#simulation')}>Simulations</a>
          <a href="#audience" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#audience')}>Pour qui ?</a>
          <a href="#advantages" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#advantages')}>Avantages</a>
          <a href="/pricing" className="mobile-link" onClick={(e) => { e.preventDefault(); handleNavigate('/pricing'); }}>Prix</a>
          <a href="/mcp-tools.html" className="mobile-link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open('/mcp-tools.html', '_blank'); }}>MCP Tools</a>
          <a href="/guide/" className="mobile-link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open('/guide/', '_blank'); }}>Guide</a>
          <button className="nav-peppol-btn" style={{ fontSize: '1rem', padding: '10px 24px' }} onClick={() => { setMobileMenuActive(false); handleNavigate('/peppol-guide'); }}>
            <Globe /> Guide Peppol
          </button>
          <div className="mobile-actions">
            <button className="btn btn-ghost" onClick={() => handleNavigate('/login')}>Connexion</button>
            <button className="btn btn-primary" onClick={() => handleNavigate('/signup')}>Démarrer</button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section id="hero" className="hero-section">
        <canvas id="hero-canvas" ref={heroCanvasRef}></canvas>

        <div className="floating-elements">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="floating-shape shape-4"></div>
          <div className="floating-shape shape-5"></div>
        </div>

        <div className="gradient-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge animate-in" data-delay="0">
              <Sparkles />
              <span>Solution de Gestion d'Entreprise Complète</span>
            </div>

            <h1 className="hero-title animate-in" data-delay="100">
              <span className="title-main">CashPilot</span>
            </h1>

            <h2 className="hero-subtitle animate-in" data-delay="200">
              <span className="typing-text">La révolution de la comptabilité automatisée</span>
            </h2>

            <p className="hero-description animate-in" data-delay="300">
              <span className="highlight">Vous introduisez les données, CashPilot fait le reste.</span>
              <br />
              Gestion financière et comptabilité 100% automatisée pour la France, la Belgique et l'Afrique (OHADA).
            </p>

            <p className="hero-mcp-banner animate-in" data-delay="350">
              <span className="highlight">Révolutionnaire</span> dans le monde de la comptabilité et la finance d'entreprise : CashPilot est aussi un <strong>serveur MCP</strong>, qui offre <strong>169 outils</strong> à tout client MCP (ChatGPT, Claude, Gemini, Mistral, n8n, Gumloop…), dont l'<strong>extraction IA de factures fournisseurs</strong> (PDF/image), pour une conversation en temps réel ou pour son intégration dans vos workflows d'automatisation (n8n, Zapier, Rube.app…).
            </p>

            <div className="feature-tags animate-in" data-delay="400">
              <div className="tag tag-green">
                <Zap />
                <span>Temps Réel (&lt; 1 seconde)</span>
              </div>
              <div className="tag tag-purple">
                <Globe />
                <span>France • Belgique • OHADA</span>
              </div>
              <div className="tag tag-amber">
                <Lightbulb />
                <span>Simulations What-If</span>
              </div>
              <div className="tag tag-blue">
                <Shield />
                <span>Reverse Accounting</span>
              </div>
              <div className="tag tag-yellow">
                <Sparkles />
                <span>100% Automatisé</span>
              </div>
              <div className="tag tag-cyan">
                <Bot />
                <span>Serveur MCP &bull; 169 Outils IA</span>
              </div>
              <div className="tag tag-red">
                <Lock />
                <span>MFA & GDPR</span>
              </div>
            </div>

            <div className="hero-cta animate-in" data-delay="500">
              <button className="btn btn-hero-primary magnetic-btn" onClick={() => handleNavigate('/signup')}>
                <span className="btn-text">Démarrer Gratuitement</span>
                <span className="btn-icon"><ArrowRight /></span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-hero-secondary magnetic-btn" onClick={() => window.open('/guide/', '_blank')}>
                <span className="btn-text">Voir la Démo</span>
                <span className="btn-play"><Play /></span>
              </button>
            </div>

            <div className="hero-stats animate-in" data-delay="600">
              <div className="stat-item">
                <span className="stat-number">&lt; 1s</span>
                <span className="stat-label">Génération Écritures</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">Auto-Comptabilité</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">3 Pays</span>
                <span className="stat-label">FR • BE • OHADA</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">0</span>
                <span className="stat-label">Saisie Manuelle</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">244</span>
                <span className="stat-label">Tests Automatisés</span>
              </div>
            </div>
          </div>

          <div className="scroll-indicator animate-in" data-delay="700">
            <div className="mouse">
              <div className="wheel"></div>
            </div>
            <span>Découvrir</span>
          </div>
        </div>
      </section>

      {/* Auto-Accounting Section */}
      <section id="auto-accounting" className="section section-accounting">
        <div className="section-bg">
          <div className="bg-gradient"></div>
          <div className="bg-pattern"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge">
              <Zap />
              <span>Solution Tout-en-Un Multi-Pays</span>
            </div>
            <h2 className="section-title">Gestion Financière & Comptable Automatisée</h2>
            <p className="section-description">
              <span className="highlight">Vous introduisez les données, CashPilot fait le reste.</span>
              <br />
              Comptabilité France 🇫🇷 • Belgique 🇧🇪 • OHADA 🌍
            </p>
          </div>

          <div className="accounting-cards">
            <div className="accounting-card card-green">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <Zap />
                </div>
                <h3 className="card-title">Génération Automatique</h3>
                <ul className="card-list">
                  <li>
                    <CheckCircle2 />
                    <span>Créez une facture → Écritures générées instantanément</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Enregistrez une dépense → Écritures créées automatiquement</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Recevez un paiement → Écriture bancaire automatique</span>
                  </li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>

            <div className="accounting-card card-purple">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <TrendingUp />
                </div>
                <h3 className="card-title">Mises à Jour Temps Réel</h3>
                <ul className="card-list">
                  <li>
                    <CheckCircle2 />
                    <span>Diagnostic financier actualisé automatiquement</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Bilan et compte de résultat en direct (&lt; 1 seconde)</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Synchronisation multi-onglets et multi-utilisateurs</span>
                  </li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>

            <div className="accounting-card card-blue">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <Shield />
                </div>
                <h3 className="card-title">Reverse Accounting</h3>
                <ul className="card-list">
                  <li>
                    <CheckCircle2 />
                    <span>Supprimez un paiement → Écriture d'annulation (OD)</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Supprimez une dépense → Écritures inversées automatiquement</span>
                  </li>
                  <li>
                    <CheckCircle2 />
                    <span>Annulez une facture → Contrepassation automatique</span>
                  </li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>
          </div>

          <div className="country-card">
            <div className="country-card-glow"></div>
            <div className="country-header">
              <h3>Multi-Pays & Conformité Totale</h3>
              <p>Un système qui s'adapte aux normes comptables de votre pays</p>
            </div>
            <div className="country-grid">
              <div className="country-item" data-country="france">
                <span className="country-flag">🇫🇷</span>
                <span className="country-name">France</span>
                <span className="country-detail">PCG • Liasse fiscale</span>
              </div>
              <div className="country-item" data-country="belgium">
                <span className="country-flag">🇧🇪</span>
                <span className="country-name">Belgique</span>
                <span className="country-detail">PCMN • Déclaration TVA</span>
              </div>
              <div className="country-item" data-country="ohada">
                <span className="country-flag">🌍</span>
                <span className="country-name">OHADA</span>
                <span className="country-detail">17 pays africains</span>
              </div>
            </div>
            <div className="country-stats">
              <div className="country-stat">
                <span className="country-stat-number">&lt; 1s</span>
                <span className="country-stat-label">Génération</span>
              </div>
              <div className="country-stat">
                <span className="country-stat-number">100%</span>
                <span className="country-stat-label">Traçabilité</span>
              </div>
              <div className="country-stat">
                <span className="country-stat-number">0</span>
                <span className="country-stat-label">Saisie manuelle</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Simulation Section */}
      <section id="simulation" className="section section-simulation">
        <div className="section-bg">
          <div className="bg-gradient simulation-gradient"></div>
          <div className="bg-particles" id="simulation-particles"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge badge-amber">
              <Lightbulb />
              <span>Simulations & Projections Financières</span>
            </div>
            <h2 className="section-title">Anticipez l'Avenir de Votre Entreprise</h2>
            <p className="section-description">
              Testez vos décisions avant de les prendre. Scénarios "What-if", projections et aide à la décision.
            </p>
          </div>

          <div className="simulation-grid">
            <div className="simulation-card">
              <div className="sim-icon sim-green">
                <TrendingUp />
              </div>
              <h4 className="sim-title">Simulation de Croissance</h4>
              <p className="sim-question">"Si j'augmente mes prix de 10%, quel sera l'impact sur ma trésorerie dans 6 mois ?"</p>
            </div>

            <div className="simulation-card">
              <div className="sim-icon sim-blue">
                <UserPlus />
              </div>
              <h4 className="sim-title">Planification d'Embauche</h4>
              <p className="sim-question">"Si j'embauche 2 personnes à 3000€/mois, puis-je tenir financièrement ?"</p>
            </div>

            <div className="simulation-card">
              <div className="sim-icon sim-purple">
                <DollarSign />
              </div>
              <h4 className="sim-title">Investissement</h4>
              <p className="sim-question">"Si j'achète un équipement à 50 000€, comment évoluera mon BFR ?"</p>
            </div>

            <div className="simulation-card">
              <div className="sim-icon sim-orange">
                <Wallet />
              </div>
              <h4 className="sim-title">Optimisation Trésorerie</h4>
              <p className="sim-question">"Si je négocie 60 jours de délai fournisseur au lieu de 30, quel impact sur le BFR ?"</p>
            </div>

            <div className="simulation-card">
              <div className="sim-icon sim-indigo">
                <Target />
              </div>
              <h4 className="sim-title">Budget Prévisionnel</h4>
              <p className="sim-question">"Créer un budget pour l'année prochaine et comparer avec le réel"</p>
            </div>
          </div>

          <div className="simulation-features-card">
            <h3 className="features-card-title">Fonctionnalités de Simulation</h3>
            <div className="features-grid">
              <div className="feature-item feature-amber">
                <div className="feature-icon">
                  <TrendingUp />
                </div>
                <div className="feature-content">
                  <h4>Projections Financières</h4>
                  <p>Prédisez l'évolution de votre trésorerie, CA et rentabilité sur 3, 6, 12 mois</p>
                </div>
              </div>
              <div className="feature-item feature-purple">
                <div className="feature-icon">
                  <Lightbulb />
                </div>
                <div className="feature-content">
                  <h4>Scénarios What-If</h4>
                  <p>Testez l'impact de vos décisions : embauches, investissements, prix...</p>
                </div>
              </div>
              <div className="feature-item feature-blue">
                <div className="feature-icon">
                  <Target />
                </div>
                <div className="feature-content">
                  <h4>Budget Prévisionnel vs Réel</h4>
                  <p>Créez des budgets prévisionnels et comparez automatiquement avec le réel</p>
                </div>
              </div>
              <div className="feature-item feature-green">
                <div className="feature-icon">
                  <BarChart3 />
                </div>
                <div className="feature-content">
                  <h4>Aide à la Décision</h4>
                  <p>Comparez plusieurs options et choisissez la meilleure stratégie</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section id="audience" className="section section-audience">
        <div className="section-bg">
          <div className="bg-gradient audience-gradient"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Conçu Pour Vous</h2>
            <p className="section-description">
              Quelle que soit votre activité, CashPilot s'adapte à vos besoins
            </p>
          </div>

          <div className="audience-grid">
            <div className="audience-card">
              <div className="audience-icon">
                <UserCheck />
              </div>
              <h3>Freelances</h3>
              <p>Gestion complète de votre activité</p>
              <div className="audience-glow"></div>
            </div>

            <div className="audience-card">
              <div className="audience-icon">
                <Building2 />
              </div>
              <h3>PME/TPE</h3>
              <p>Suite de gestion d'entreprise</p>
              <div className="audience-glow"></div>
            </div>

            <div className="audience-card">
              <div className="audience-icon">
                <Briefcase />
              </div>
              <h3>Agences</h3>
              <p>Gestion projets et clients</p>
              <div className="audience-glow"></div>
            </div>

            <div className="audience-card">
              <div className="audience-icon">
                <Users />
              </div>
              <h3>Consultants</h3>
              <p>Suivi temps et facturation</p>
              <div className="audience-glow"></div>
            </div>

            <div className="audience-card">
              <div className="audience-icon">
                <Store />
              </div>
              <h3>Commerçants</h3>
              <p>Gestion stock et fournisseurs</p>
              <div className="audience-glow"></div>
            </div>

            <div className="audience-card">
              <div className="audience-icon">
                <Sparkles />
              </div>
              <h3>Services</h3>
              <p>Facturation et projets</p>
              <div className="audience-glow"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section section-features">
        <div className="section-bg">
          <div className="bg-gradient features-gradient"></div>
          <div className="bg-mesh"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Fonctionnalités Principales</h2>
            <p className="section-description">
              Une suite complète d'outils pour gérer tous les aspects de votre entreprise
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card" data-color="blue-cyan">
              <div className="feature-card-icon">
                <Users />
              </div>
              <h3>Gestion Clients</h3>
              <p>CRM complet pour suivre vos relations commerciales</p>
            </div>

            <div className="feature-card" data-color="purple-pink">
              <div className="feature-card-icon">
                <BarChart3 />
              </div>
              <h3>Projets & Tâches</h3>
              <p>Organisez et suivez vos projets avec Kanban</p>
            </div>

            <div className="feature-card" data-color="green-emerald">
              <div className="feature-card-icon">
                <Clock />
              </div>
              <h3>Suivi du Temps</h3>
              <p>Feuilles de temps et chronomètre intégré</p>
            </div>

            <div className="feature-card" data-color="yellow-orange">
              <div className="feature-card-icon">
                <FileText />
              </div>
              <h3>Facturation</h3>
              <p>Factures et devis professionnels en PDF</p>
            </div>

            <div className="feature-card" data-color="red-rose">
              <div className="feature-card-icon">
                <Calculator />
              </div>
              <h3>Comptabilité Multi-Pays</h3>
              <p>France, Belgique, OHADA - Écritures automatiques en temps réel</p>
            </div>

            <div className="feature-card" data-color="indigo-blue">
              <div className="feature-card-icon">
                <Package />
              </div>
              <h3>Gestion Stock</h3>
              <p>Inventaire avec scanner de codes-barres</p>
            </div>

            <div className="feature-card" data-color="teal-cyan">
              <div className="feature-card-icon">
                <Receipt />
              </div>
              <h3>Dépenses</h3>
              <p>Suivi et catégorisation des dépenses</p>
            </div>

            <div className="feature-card" data-color="violet-purple">
              <div className="feature-card-icon">
                <TrendingUp />
              </div>
              <h3>Fournisseurs</h3>
              <p>Gestion fournisseurs + extraction IA de factures via MCP</p>
            </div>

            <div className="feature-card" data-color="lime-green">
              <div className="feature-card-icon">
                <PieChart />
              </div>
              <h3>Rapports & Analytics</h3>
              <p>Visualisations et exports PDF personnalisés</p>
            </div>

            <div className="feature-card" data-color="amber-yellow">
              <div className="feature-card-icon">
                <Lightbulb />
              </div>
              <h3>Simulations Financières</h3>
              <p>Scénarios what-if et projections pour anticiper l'avenir</p>
            </div>

            <div className="feature-card" data-color="cyan-blue">
              <div className="feature-card-icon">
                <Bot />
              </div>
              <h3>Serveur MCP & API</h3>
              <p>169 outils MCP (dont extraction IA factures) + API REST pour agents IA et automations</p>
            </div>

            <div className="feature-card" data-color="rose-red">
              <div className="feature-card-icon">
                <Lock />
              </div>
              <h3>MFA / 2FA (TOTP)</h3>
              <p>Authentification à deux facteurs via Google Authenticator ou Authy</p>
            </div>

            <div className="feature-card" data-color="sky-indigo">
              <div className="feature-card-icon">
                <ShieldCheck />
              </div>
              <h3>Conformité RGPD</h3>
              <p>Consentement cookies, export données, droit à l'oubli</p>
            </div>

            <div className="feature-card" data-color="emerald-teal">
              <div className="feature-card-icon">
                <Brain />
              </div>
              <h3>Extraction IA Factures</h3>
              <p>Upload PDF/image → extraction automatique par Gemini 2.0 Flash, aussi via MCP</p>
            </div>

            <div className="feature-card" data-color="green-lime">
              <div className="feature-card-icon">
                <Landmark />
              </div>
              <h3>Connexion Bancaire</h3>
              <p>3000+ banques via GoCardless Open Banking</p>
            </div>

            <div className="feature-card" data-color="pink-purple">
              <div className="feature-card-icon">
                <Mail />
              </div>
              <h3>Email & Rappels Auto</h3>
              <p>Envoi de factures et rappels de paiement automatiques</p>
            </div>

            <div className="feature-card" data-color="blue-indigo">
              <div className="feature-card-icon">
                <Repeat />
              </div>
              <h3>Factures Récurrentes</h3>
              <p>Facturation automatique des abonnements et contrats</p>
            </div>

            <div className="feature-card" data-color="orange-amber">
              <div className="feature-card-icon">
                <Plug />
              </div>
              <h3>API REST & Webhooks</h3>
              <p>API documentée + webhooks HMAC pour intégrations externes</p>
            </div>

            <div className="feature-card" data-color="violet-indigo">
              <div className="feature-card-icon">
                <Coins />
              </div>
              <h3>Taux de Change BCE</h3>
              <p>33 devises avec taux officiels mis à jour automatiquement</p>
            </div>

            <div className="feature-card" data-color="lime-emerald">
              <div className="feature-card-icon">
                <Download />
              </div>
              <h3>Export Excel/CSV Natif</h3>
              <p>Export en un clic depuis toutes les pages principales</p>
            </div>
          </div>
        </div>
      </section>

      {/* MCP & AI Agents Section */}
      <section id="mcp" className="section section-mcp">
        <div className="section-bg">
          <div className="bg-gradient mcp-gradient"></div>
          <div className="bg-mesh"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge badge-cyan">
              <Bot />
              <span>Serveur MCP Natif</span>
            </div>
            <h2 className="section-title">Connecté à Tous Vos Agents IA</h2>
            <p className="section-description">
              CashPilot est un <strong>serveur MCP (Model Context Protocol)</strong> avec 169 outils intégrés, dont l'<strong>extraction IA de factures fournisseurs</strong>.
              <br />
              Pilotez votre gestion financière par la voix ou le texte, depuis n'importe quel agent IA.
            </p>
          </div>

          <div className="mcp-agents-grid">
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>C</span>
              <span className="mcp-agent-name">Claude</span>
              <span className="mcp-agent-company">Anthropic</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>G</span>
              <span className="mcp-agent-name">ChatGPT</span>
              <span className="mcp-agent-company">OpenAI</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>G</span>
              <span className="mcp-agent-name">Gemini</span>
              <span className="mcp-agent-company">Google</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>M</span>
              <span className="mcp-agent-name">Mistral</span>
              <span className="mcp-agent-company">Mistral AI</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>R</span>
              <span className="mcp-agent-name">Rube.app</span>
              <span className="mcp-agent-company">Automation</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>n</span>
              <span className="mcp-agent-name">n8n</span>
              <span className="mcp-agent-company">Workflow</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee' }}>G</span>
              <span className="mcp-agent-name">Gunloop</span>
              <span className="mcp-agent-company">Automation</span>
            </div>
            <div className="mcp-agent-badge">
              <span className="mcp-agent-icon" style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>+</span>
              <span className="mcp-agent-name">Tout Client MCP</span>
              <span className="mcp-agent-company">Universel</span>
            </div>
          </div>

          <div className="mcp-cards">
            <div className="mcp-card">
              <div className="mcp-card-glow"></div>
              <div className="mcp-card-icon">
                <Mic />
              </div>
              <h3 className="mcp-card-title">Contrôle Vocal & Texte</h3>
              <p className="mcp-card-description">
                Pilotez CashPilot depuis Claude, ChatGPT, Gemini ou Mistral par la voix ou le texte.
                Créez des factures, consultez vos finances, générez des rapports — en langage naturel.
              </p>
            </div>

            <div className="mcp-card">
              <div className="mcp-card-glow"></div>
              <div className="mcp-card-icon">
                <Plug />
              </div>
              <h3 className="mcp-card-title">169 Outils MCP</h3>
              <p className="mcp-card-description">
                Création de factures, recherche de clients, export comptable, résumé financier, extraction IA de factures fournisseurs
                — 169 outils accessibles via le protocole MCP standard.
              </p>
            </div>

            <div className="mcp-card">
              <div className="mcp-card-glow"></div>
              <div className="mcp-card-icon">
                <Workflow />
              </div>
              <h3 className="mcp-card-title">Brique d'Automatisation</h3>
              <p className="mcp-card-description">
                Intégrez CashPilot dans vos pipelines : Rube.app, n8n, Gunloop, Zapier, Make.
                Votre gestion financière devient un composant de votre écosystème automatisé.
              </p>
            </div>
          </div>

          <div className="mcp-example">
            <div className="mcp-example-label">Exemple depuis un agent IA</div>
            <p className="mcp-example-text">
              &laquo; Extrais cette facture fournisseur et enregistre-la dans CashPilot &raquo;
            </p>
            <p className="mcp-example-result">
              <CheckCircle2 />
              <span>Facture extraite par IA : Fournisseur ABC, 2 450&euro; TTC, 3 lignes. Enregistrée automatiquement.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Peppol & E-Invoicing Section */}
      <section id="peppol" className="section section-peppol">
        <div className="section-bg">
          <div className="bg-gradient peppol-gradient"></div>
          <div className="bg-mesh"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge badge-peppol">
              <Globe />
              <span>Peppol &amp; E-Invoicing</span>
            </div>
            <h2 className="section-title">Facturation Électronique via Peppol</h2>
            <p className="section-description">
              Envoyez et recevez vos factures sur le <strong>réseau européen Peppol</strong> directement depuis CashPilot,
              grâce à <strong>Scrada</strong>, Access Point certifié belge. Conforme EN16931 &amp; UBL 2.1.
            </p>
          </div>

          <div className="peppol-cards">
            <div className="peppol-card">
              <div className="peppol-card-glow"></div>
              <div className="peppol-card-icon">
                <Clock />
              </div>
              <h3 className="peppol-card-title">Configuration en 5 Minutes</h3>
              <p className="peppol-card-description">
                Créez votre compte Scrada, générez une clé API, et collez vos identifiants dans CashPilot.
                Un clic pour tester la connexion — c'est prêt.
              </p>
              <span className="peppol-card-tag tag-green">Dès 2 €/mois</span>
            </div>

            <div className="peppol-card">
              <div className="peppol-card-glow"></div>
              <div className="peppol-card-icon" style={{ color: 'var(--accent-blue)' }}>
                <Rocket />
              </div>
              <h3 className="peppol-card-title">Envoi Peppol Automatique</h3>
              <p className="peppol-card-description">
                CashPilot valide votre facture (13 règles EN16931), génère le XML UBL conforme,
                et l'envoie via Scrada sur le réseau Peppol. Suivi du statut en temps réel.
              </p>
              <span className="peppol-card-tag tag-blue">UBL 2.1 / BIS Billing 3.0</span>
            </div>

            <div className="peppol-card">
              <div className="peppol-card-glow"></div>
              <div className="peppol-card-icon" style={{ color: '#a78bfa' }}>
                <Download />
              </div>
              <h3 className="peppol-card-title">Réception &amp; Vérification</h3>
              <p className="peppol-card-description">
                Recevez les factures entrantes via Peppol et vérifiez si vos clients sont enregistrés
                sur le réseau — en un clic depuis leur fiche.
              </p>
              <span className="peppol-card-tag tag-purple">B2G &amp; B2B</span>
            </div>
          </div>

          <div className="peppol-infographic">
            <img src="/images/peppol-scrada-guide.jpg" alt="Connexion CashPilot - Peppol via Scrada : configuration, forfaits et bénéfices" loading="lazy" />
          </div>

          <div className="peppol-cta">
            <button className="peppol-cta-btn" onClick={() => handleNavigate('/peppol-guide')}>
              <Globe /> Voir le Guide Complet <ArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section id="advantages" className="section section-advantages">
        <div className="section-bg">
          <div className="bg-gradient advantages-gradient"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Pourquoi Choisir CashPilot ?</h2>
            <p className="section-description">
              Des avantages qui font la différence
            </p>
          </div>

          <div className="advantages-grid">
            <div className="advantage-item">
              <div className="advantage-icon">
                <Sparkles />
              </div>
              <p>Vous introduisez les données, CashPilot fait tout le reste automatiquement</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Globe />
              </div>
              <p>Multi-Pays : France (PCG), Belgique (PCMN), OHADA (17 pays)</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Lightbulb />
              </div>
              <p>Simulations financières : Testez vos décisions avant de les prendre</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Zap />
              </div>
              <p>Génération instantanée des écritures comptables (&lt; 1 seconde)</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Shield />
              </div>
              <p>Reverse accounting : Annulations et corrections automatiques</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Star />
              </div>
              <p>Tout-en-un : Gestion, Facturation, Comptabilité, Simulations</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Bot />
              </div>
              <p>Serveur MCP : 169 outils dont extraction IA de factures, depuis ChatGPT, Claude, Gemini, Mistral</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Lock />
              </div>
              <p>Sécurité renforcée : MFA/2FA, RGPD, 244 tests automatisés</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Brain />
              </div>
              <p>IA intégrée : Extraction factures fournisseurs par Gemini 2.0 Flash</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>

            <div className="advantage-item">
              <div className="advantage-icon">
                <Landmark />
              </div>
              <p>Banque connectée : 3000+ banques, rapprochement auto, taux de change BCE</p>
              <div className="advantage-check">
                <CheckCircle2 />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="section section-cta">
        <div className="cta-bg">
          <div className="cta-gradient"></div>
          <div className="cta-particles" id="cta-particles"></div>
          <div className="cta-orbs">
            <div className="cta-orb cta-orb-1"></div>
            <div className="cta-orb cta-orb-2"></div>
          </div>
        </div>

        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Prêt à transformer votre gestion d'entreprise ?</h2>
            <p className="cta-description">
              Rejoignez des milliers d'entrepreneurs qui ont déjà choisi CashPilot
            </p>
            <div className="cta-buttons">
              <button className="btn btn-cta-primary magnetic-btn" onClick={() => handleNavigate('/signup')}>
                <span className="btn-text">Commencer Maintenant</span>
                <span className="btn-icon"><ArrowRight /></span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-cta-secondary magnetic-btn" onClick={() => handleNavigate('/login')}>
                <span className="btn-text">Contactez-nous</span>
              </button>
            </div>
            <p className="cta-note">
              ✨ Essai gratuit • Sans carte de crédit • Installation en 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-gradient"></div>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <Wallet />
                <span>CashPilot</span>
              </div>
              <p className="footer-tagline">La solution complète pour votre entreprise</p>
              <p className="footer-powered">Propulsé par DMG Management</p>
            </div>

            <div className="footer-section">
              <h4>Contact</h4>
              <div className="footer-links">
                <a href="https://www.dmgmanagement.tech" target="_blank" rel="noopener noreferrer">
                  <Globe />
                  <span>www.dmgmanagement.tech</span>
                </a>
                <a href="mailto:info@dmgmanagement.tech">
                  <FileText />
                  <span>info@dmgmanagement.tech</span>
                </a>
                <a href="tel:+32472544765">
                  <Smartphone />
                  <span>+32.472.544.765</span>
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h4>Liens Rapides</h4>
              <div className="footer-links">
                <a href="#">À propos</a>
                <a href="#features">Fonctionnalités</a>
                <a href="#">Tarifs</a>
                <a href="#">Support</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 CashPilot. Tous droits réservés.</p>
            <p>
              Développé avec ❤️ par{' '}
              <a href="https://www.dmgmanagement.tech" target="_blank" rel="noopener noreferrer">
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
