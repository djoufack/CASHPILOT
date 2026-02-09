# Skill : Create Landing Page

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `create-landing-page` |
| Version | 1.0.0 |
| Agent | `Landing-Page-Agent.md` |
| Declencheur | Demande de creation d'une landing page premium pour un produit/service |

---

## Synopsis

Ce skill genere une landing page premium complete (JSX + CSS) avec arriere-plan Three.js,
animations GSAP, curseur custom, boutons magnetiques et dark theme. Il utilise le code
de la landing page CashPilot comme template de reference avec des placeholders parametrables.

```
PHASE 1            PHASE 2            PHASE 3            PHASE 4
Collecte     -->   Generation    -->   Adaptation    -->   Verification
(Parametres)       (JSX + CSS)        (Remplacement)      (Build)
```

---

## PHASE 1 — Collecte des parametres

### Objectif
Rassembler toutes les informations necessaires pour generer la landing page.

### Procedure

1. **Demander les parametres obligatoires** via `AskUserQuestion` :
   - `productName` : Nom du produit
   - `tagline` : Slogan principal
   - `description` : Description courte

2. **Proposer les parametres optionnels** avec valeurs par defaut :
   - Couleurs (primary, accent, secondary)
   - Sections a inclure
   - Features, stats, audience, advantages, simulations
   - Contact et navigation

3. **Construire l'objet de configuration** :

```javascript
const config = {
  productName: "{{PRODUCT_NAME}}",
  tagline: "{{TAGLINE}}",
  description: "{{DESCRIPTION}}",
  primaryColor: "{{PRIMARY_COLOR}}",       // default: "#8b5cf6"
  accentColor: "{{ACCENT_COLOR}}",         // default: "#f59e0b"
  secondaryColor: "{{SECONDARY_COLOR}}",   // default: "#10b981"
  sections: {{SECTIONS}},                  // default: ["hero","features","audience","advantages","simulation","cta","footer"]
  features: {{FEATURES}},
  stats: {{STATS}},
  audienceCards: {{AUDIENCE_CARDS}},
  advantages: {{ADVANTAGES}},
  simulations: {{SIMULATIONS}},
  ctaTitle: "{{CTA_TITLE}}",
  ctaDescription: "{{CTA_DESCRIPTION}}",
  ctaButtonText: "{{CTA_BUTTON_TEXT}}",
  loginPath: "{{LOGIN_PATH}}",             // default: "/login"
  signupPath: "{{SIGNUP_PATH}}",           // default: "/signup"
  contactEmail: "{{CONTACT_EMAIL}}",
  contactPhone: "{{CONTACT_PHONE}}",
  website: "{{WEBSITE}}",
  companyName: "{{COMPANY_NAME}}",
  navLinks: {{NAV_LINKS}},
};
```

---

## PHASE 2 — Generation des fichiers

### Objectif
Generer les 2 fichiers (JSX + CSS) en utilisant les templates ci-dessous.

### Fichier 1 : LandingPage.jsx

Le template JSX complet est base sur `src/pages/LandingPage.jsx` (1114 lignes).
Les placeholders `{{...}}` doivent etre remplaces par les valeurs de la configuration.

```jsx
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
  Smartphone
} from 'lucide-react';
import '{{CSS_IMPORT_PATH}}';

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

  // =========================================
  // PRELOADER
  // =========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      if (preloaderRef.current) {
        preloaderRef.current.classList.add('loaded');
      }
      document.body.style.overflow = 'visible';

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

  // =========================================
  // CUSTOM CURSOR (desktop only)
  // =========================================
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

    const interactiveElements = document.querySelectorAll('a, button, .feature-card, .audience-card, .simulation-card, .accounting-card, .country-item, .advantage-item');

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // =========================================
  // NAVIGATION SCROLL (hide/show on scroll)
  // =========================================
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

  // =========================================
  // THREE.JS 3D BACKGROUND (particles + lines)
  // =========================================
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

    // {{THREE_PARTICLE_COLOR}} — Replace 0x8b5cf6 with your primary color as hex int
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x{{PRIMARY_COLOR_HEX_INT}},
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

      // Dynamic color cycling (HSL)
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

  // =========================================
  // GSAP SCROLL ANIMATIONS
  // =========================================
  useEffect(() => {
    if (!isLoaded) return;

    // Section headers — reveal on scroll
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

    // Cards — staggered 3D reveal
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

    // Magnetic buttons — follow cursor with elastic return
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

  // =========================================
  // HELPERS
  // =========================================
  const toggleMobileMenu = () => {
    setMobileMenuActive(!mobileMenuActive);
    document.body.style.overflow = !mobileMenuActive ? 'hidden' : 'visible';
  };

  const closeMobileMenu = () => {
    setMobileMenuActive(false);
    document.body.style.overflow = 'visible';
  };

  const handleNavigate = (path) => {
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

  // =========================================
  // RENDER
  // =========================================
  return (
    <div className="landing-page">
      {/* Preloader */}
      <div id="preloader" ref={preloaderRef}>
        <div className="loader-container">
          <div className="logo-loader">
            <span className="logo-text">{{PRODUCT_NAME}}</span>
            <div className="loader-bar"></div>
          </div>
        </div>
      </div>

      {/* Cursor follower (desktop only) */}
      <div className="cursor-follower" ref={cursorFollowerRef}></div>
      <div className="cursor-dot" ref={cursorDotRef}></div>

      {/* Navigation */}
      <nav id="navbar" className={`navbar ${navbarScrolled ? 'scrolled' : ''}`} ref={navbarRef}>
        <div className="nav-container">
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <{{LOGO_ICON}} className="logo-icon" />
            <span>{{PRODUCT_NAME}}</span>
          </a>
          <div className="nav-links">
            {/* {{NAV_LINKS}} — Generate one <a> per nav link */}
            <a href="#features" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#features')}>{{NAV_LINK_1_LABEL}}</a>
            <a href="#simulation" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#simulation')}>{{NAV_LINK_2_LABEL}}</a>
            <a href="#audience" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#audience')}>{{NAV_LINK_3_LABEL}}</a>
            <a href="#advantages" className="nav-link" onClick={(e) => handleSmoothScroll(e, '#advantages')}>{{NAV_LINK_4_LABEL}}</a>
          </div>
          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={() => handleNavigate('{{LOGIN_PATH}}')}>{{LOGIN_BUTTON_TEXT}}</button>
            <button className="btn btn-primary" onClick={() => handleNavigate('{{SIGNUP_PATH}}')}>
              {{SIGNUP_BUTTON_TEXT}}
              <ArrowRight />
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
          {/* {{NAV_LINKS}} — Repeat for mobile */}
          <a href="#features" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#features')}>{{NAV_LINK_1_LABEL}}</a>
          <a href="#simulation" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#simulation')}>{{NAV_LINK_2_LABEL}}</a>
          <a href="#audience" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#audience')}>{{NAV_LINK_3_LABEL}}</a>
          <a href="#advantages" className="mobile-link" onClick={(e) => handleSmoothScroll(e, '#advantages')}>{{NAV_LINK_4_LABEL}}</a>
          <div className="mobile-actions">
            <button className="btn btn-ghost" onClick={() => handleNavigate('{{LOGIN_PATH}}')}>{{LOGIN_BUTTON_TEXT}}</button>
            <button className="btn btn-primary" onClick={() => handleNavigate('{{SIGNUP_PATH}}')}>{{SIGNUP_BUTTON_TEXT}}</button>
          </div>
        </div>
      </div>

      {/* ========== HERO SECTION ========== */}
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
              <span>{{HERO_BADGE_TEXT}}</span>
            </div>

            <h1 className="hero-title animate-in" data-delay="100">
              <span className="title-main">{{PRODUCT_NAME}}</span>
            </h1>

            <h2 className="hero-subtitle animate-in" data-delay="200">
              <span className="typing-text">{{TAGLINE}}</span>
            </h2>

            <p className="hero-description animate-in" data-delay="300">
              <span className="highlight">{{DESCRIPTION_HIGHLIGHT}}</span>
              <br />
              {{DESCRIPTION_DETAIL}}
            </p>

            {/* {{FEATURE_TAGS}} — Generate tags from config */}
            <div className="feature-tags animate-in" data-delay="400">
              {/* Example tags — replace with actual config values */}
              <div className="tag tag-green">
                <Zap />
                <span>{{TAG_1_TEXT}}</span>
              </div>
              <div className="tag tag-purple">
                <Globe />
                <span>{{TAG_2_TEXT}}</span>
              </div>
              <div className="tag tag-amber">
                <Lightbulb />
                <span>{{TAG_3_TEXT}}</span>
              </div>
              <div className="tag tag-blue">
                <Shield />
                <span>{{TAG_4_TEXT}}</span>
              </div>
              <div className="tag tag-yellow">
                <Sparkles />
                <span>{{TAG_5_TEXT}}</span>
              </div>
            </div>

            <div className="hero-cta animate-in" data-delay="500">
              <button className="btn btn-hero-primary magnetic-btn" onClick={() => handleNavigate('{{SIGNUP_PATH}}')}>
                <span className="btn-text">{{CTA_BUTTON_TEXT}}</span>
                <span className="btn-icon"><ArrowRight /></span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-hero-secondary magnetic-btn" onClick={() => handleNavigate('{{LOGIN_PATH}}')}>
                <span className="btn-text">{{SECONDARY_CTA_TEXT}}</span>
                <span className="btn-play"><Play /></span>
              </button>
            </div>

            {/* {{STATS}} — Generate from config */}
            <div className="hero-stats animate-in" data-delay="600">
              <div className="stat-item">
                <span className="stat-number">{{STAT_1_NUMBER}}</span>
                <span className="stat-label">{{STAT_1_LABEL}}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{{STAT_2_NUMBER}}</span>
                <span className="stat-label">{{STAT_2_LABEL}}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{{STAT_3_NUMBER}}</span>
                <span className="stat-label">{{STAT_3_LABEL}}</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{{STAT_4_NUMBER}}</span>
                <span className="stat-label">{{STAT_4_LABEL}}</span>
              </div>
            </div>
          </div>

          <div className="scroll-indicator animate-in" data-delay="700">
            <div className="mouse">
              <div className="wheel"></div>
            </div>
            <span>{{SCROLL_TEXT}}</span>
          </div>
        </div>
      </section>

      {/* ========== SECTION 2 : ACCOUNTING / KEY FEATURES ========== */}
      {/* {{IF sections.includes("features")}} */}
      <section id="auto-accounting" className="section section-accounting">
        <div className="section-bg">
          <div className="bg-gradient"></div>
          <div className="bg-pattern"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge">
              <Zap />
              <span>{{ACCOUNTING_BADGE_TEXT}}</span>
            </div>
            <h2 className="section-title">{{ACCOUNTING_TITLE}}</h2>
            <p className="section-description">
              <span className="highlight">{{ACCOUNTING_HIGHLIGHT}}</span>
              <br />
              {{ACCOUNTING_DETAIL}}
            </p>
          </div>

          {/* {{ACCOUNTING_CARDS}} — Generate 3 cards from config */}
          <div className="accounting-cards">
            <div className="accounting-card card-green">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <{{CARD_1_ICON}} />
                </div>
                <h3 className="card-title">{{CARD_1_TITLE}}</h3>
                <ul className="card-list">
                  <li><CheckCircle2 /><span>{{CARD_1_ITEM_1}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_1_ITEM_2}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_1_ITEM_3}}</span></li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>

            <div className="accounting-card card-purple">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <{{CARD_2_ICON}} />
                </div>
                <h3 className="card-title">{{CARD_2_TITLE}}</h3>
                <ul className="card-list">
                  <li><CheckCircle2 /><span>{{CARD_2_ITEM_1}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_2_ITEM_2}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_2_ITEM_3}}</span></li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>

            <div className="accounting-card card-blue">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">
                  <{{CARD_3_ICON}} />
                </div>
                <h3 className="card-title">{{CARD_3_TITLE}}</h3>
                <ul className="card-list">
                  <li><CheckCircle2 /><span>{{CARD_3_ITEM_1}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_3_ITEM_2}}</span></li>
                  <li><CheckCircle2 /><span>{{CARD_3_ITEM_3}}</span></li>
                </ul>
              </div>
              <div className="card-particles"></div>
            </div>
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== SECTION 3 : SIMULATION ========== */}
      {/* {{IF sections.includes("simulation")}} */}
      <section id="simulation" className="section section-simulation">
        <div className="section-bg">
          <div className="bg-gradient simulation-gradient"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge badge-amber">
              <Lightbulb />
              <span>{{SIMULATION_BADGE_TEXT}}</span>
            </div>
            <h2 className="section-title">{{SIMULATION_TITLE}}</h2>
            <p className="section-description">{{SIMULATION_DESCRIPTION}}</p>
          </div>

          {/* {{SIMULATIONS}} — Generate cards from config */}
          <div className="simulation-grid">
            {/* Repeat for each simulation card */}
            <div className="simulation-card">
              <div className="sim-icon sim-green"><{{SIM_1_ICON}} /></div>
              <h4 className="sim-title">{{SIM_1_TITLE}}</h4>
              <p className="sim-question">{{SIM_1_QUESTION}}</p>
            </div>
            {/* ... more simulation cards ... */}
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== SECTION 4 : AUDIENCE ========== */}
      {/* {{IF sections.includes("audience")}} */}
      <section id="audience" className="section section-audience">
        <div className="section-bg">
          <div className="bg-gradient audience-gradient"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{{AUDIENCE_TITLE}}</h2>
            <p className="section-description">{{AUDIENCE_DESCRIPTION}}</p>
          </div>

          {/* {{AUDIENCE_CARDS}} — Generate from config */}
          <div className="audience-grid">
            <div className="audience-card">
              <div className="audience-icon"><{{AUD_1_ICON}} /></div>
              <h3>{{AUD_1_TITLE}}</h3>
              <p>{{AUD_1_DESCRIPTION}}</p>
              <div className="audience-glow"></div>
            </div>
            {/* ... more audience cards ... */}
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== SECTION 5 : FEATURES GRID ========== */}
      {/* {{IF sections.includes("features")}} */}
      <section id="features" className="section section-features">
        <div className="section-bg">
          <div className="bg-gradient features-gradient"></div>
          <div className="bg-mesh"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{{FEATURES_TITLE}}</h2>
            <p className="section-description">{{FEATURES_DESCRIPTION}}</p>
          </div>

          {/* {{FEATURES}} — Generate feature cards from config */}
          <div className="features-grid">
            <div className="feature-card" data-color="blue-cyan">
              <div className="feature-card-icon"><{{FEAT_1_ICON}} /></div>
              <h3>{{FEAT_1_TITLE}}</h3>
              <p>{{FEAT_1_DESCRIPTION}}</p>
            </div>
            {/* ... more feature cards ... */}
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== SECTION 6 : ADVANTAGES ========== */}
      {/* {{IF sections.includes("advantages")}} */}
      <section id="advantages" className="section section-advantages">
        <div className="section-bg">
          <div className="bg-gradient advantages-gradient"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{{ADVANTAGES_TITLE}}</h2>
            <p className="section-description">{{ADVANTAGES_DESCRIPTION}}</p>
          </div>

          {/* {{ADVANTAGES}} — Generate from config */}
          <div className="advantages-grid">
            <div className="advantage-item">
              <div className="advantage-icon"><{{ADV_1_ICON}} /></div>
              <p>{{ADV_1_TEXT}}</p>
              <div className="advantage-check"><CheckCircle2 /></div>
            </div>
            {/* ... more advantage items ... */}
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== SECTION 7 : CTA ========== */}
      {/* {{IF sections.includes("cta")}} */}
      <section id="cta" className="section section-cta">
        <div className="cta-bg">
          <div className="cta-gradient"></div>
          <div className="cta-orbs">
            <div className="cta-orb cta-orb-1"></div>
            <div className="cta-orb cta-orb-2"></div>
          </div>
        </div>

        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">{{CTA_TITLE}}</h2>
            <p className="cta-description">{{CTA_DESCRIPTION}}</p>
            <div className="cta-buttons">
              <button className="btn btn-cta-primary magnetic-btn" onClick={() => handleNavigate('{{SIGNUP_PATH}}')}>
                <span className="btn-text">{{CTA_BUTTON_TEXT}}</span>
                <span className="btn-icon"><ArrowRight /></span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-cta-secondary magnetic-btn" onClick={() => handleNavigate('{{LOGIN_PATH}}')}>
                <span className="btn-text">{{CTA_SECONDARY_TEXT}}</span>
              </button>
            </div>
            <p className="cta-note">{{CTA_NOTE}}</p>
          </div>
        </div>
      </section>
      {/* {{END IF}} */}

      {/* ========== FOOTER ========== */}
      {/* {{IF sections.includes("footer")}} */}
      <footer className="footer">
        <div className="footer-gradient"></div>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <{{LOGO_ICON}} />
                <span>{{PRODUCT_NAME}}</span>
              </div>
              <p className="footer-tagline">{{FOOTER_TAGLINE}}</p>
              <p className="footer-powered">{{FOOTER_POWERED_BY}}</p>
            </div>

            <div className="footer-section">
              <h4>Contact</h4>
              <div className="footer-links">
                <a href="{{WEBSITE}}" target="_blank" rel="noopener noreferrer">
                  <Globe /><span>{{WEBSITE_DISPLAY}}</span>
                </a>
                <a href="mailto:{{CONTACT_EMAIL}}">
                  <FileText /><span>{{CONTACT_EMAIL}}</span>
                </a>
                <a href="tel:{{CONTACT_PHONE}}">
                  <Smartphone /><span>{{CONTACT_PHONE_DISPLAY}}</span>
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h4>{{FOOTER_QUICK_LINKS_TITLE}}</h4>
              <div className="footer-links">
                {/* {{FOOTER_LINKS}} — Generate from config */}
                <a href="#">{{FOOTER_LINK_1}}</a>
                <a href="#features">{{FOOTER_LINK_2}}</a>
                <a href="#">{{FOOTER_LINK_3}}</a>
                <a href="#">{{FOOTER_LINK_4}}</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>{{FOOTER_COPYRIGHT}}</p>
            <p>
              {{FOOTER_MADE_WITH}}{' '}
              <a href="{{WEBSITE}}" target="_blank" rel="noopener noreferrer">
                {{COMPANY_NAME}}
              </a>
            </p>
          </div>
        </div>
      </footer>
      {/* {{END IF}} */}
    </div>
  );
};

export default LandingPage;
```

### Fichier 2 : landing.css

Le template CSS complet est base sur `src/styles/landing.css` (2199 lignes).
Les variables CSS doivent etre adaptees aux couleurs du produit.

```css
/* ============================================
   {{PRODUCT_NAME}} Landing Page - Professional Design
   ============================================ */

/* CSS Variables — ADAPT THESE TO YOUR PRODUCT COLORS */
:root {
    /* Colors — Primary theme */
    --primary-dark: #0a0e27;
    --secondary-dark: #141b3d;
    --tertiary-dark: #1a1f4a;
    --accent-blue: #3b82f6;
    --accent-purple: {{PRIMARY_COLOR}};
    --accent-pink: #ec4899;
    --accent-green: {{SECONDARY_COLOR}};
    --accent-yellow: {{ACCENT_COLOR}};
    --accent-cyan: #06b6d4;
    --accent-amber: {{ACCENT_COLOR}};
    --text-primary: #ffffff;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;

    /* Gradients — Uses your 3 colors */
    --gradient-main: linear-gradient(135deg, {{ACCENT_COLOR}} 0%, {{SECONDARY_COLOR}} 50%, {{PRIMARY_COLOR}} 100%);
    --gradient-hero: linear-gradient(135deg, #0a0e27 0%, #141b3d 50%, #1a1f4a 100%);
    --gradient-card: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);

    /* Spacing */
    --section-padding: 120px;
    --container-width: 1280px;

    /* Transitions */
    --transition-fast: 0.2s ease;
    --transition-medium: 0.3s ease;
    --transition-slow: 0.5s ease;

    /* Border Radius */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 20px;
    --radius-xl: 30px;
    --radius-full: 9999px;
}

/* Reset & Base - Scoped to landing page only */
.landing-page * {
    margin: 0;
    padding: 0;
}

.landing-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--primary-dark);
    color: var(--text-primary);
    line-height: 1.6;
}

/* Custom Scrollbar */
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-track { background: var(--primary-dark); }
::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, var(--accent-purple), var(--accent-blue));
    border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, var(--accent-pink), var(--accent-purple));
}

/* Selection */
::selection {
    background: rgba(139, 92, 246, 0.3);
    color: var(--text-primary);
}

/* ============================================
   Preloader
   ============================================ */
#preloader {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--primary-dark);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;
    transition: opacity 0.5s ease, visibility 0.5s ease;
}
#preloader.loaded { opacity: 0; visibility: hidden; }

.loader-container { text-align: center; }
.logo-loader { display: flex; flex-direction: column; align-items: center; gap: 20px; }

.logo-text {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 3rem; font-weight: 700;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: pulse 1.5s ease-in-out infinite;
}

.loader-bar {
    width: 200px; height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px; overflow: hidden; position: relative;
}
.loader-bar::after {
    content: ''; position: absolute; top: 0; left: -100%;
    width: 100%; height: 100%;
    background: var(--gradient-main);
    animation: loading 1.5s ease-in-out infinite;
}

@keyframes loading {
    0% { left: -100%; }
    50% { left: 0; }
    100% { left: 100%; }
}

/* ============================================
   Custom Cursor
   ============================================ */
.cursor-follower {
    width: 40px; height: 40px;
    border: 2px solid rgba(139, 92, 246, 0.5);
    border-radius: 50%; position: fixed; pointer-events: none;
    z-index: 9999;
    transition: transform 0.15s ease-out, opacity 0.15s ease;
    transform: translate(-50%, -50%); opacity: 0;
}
.cursor-dot {
    width: 8px; height: 8px; background: var(--accent-purple);
    border-radius: 50%; position: fixed; pointer-events: none;
    z-index: 10000; transform: translate(-50%, -50%); opacity: 0;
}
body:hover .cursor-follower, body:hover .cursor-dot { opacity: 1; }
.cursor-follower.hover {
    transform: translate(-50%, -50%) scale(1.5);
    border-color: var(--accent-pink);
    background: rgba(236, 72, 153, 0.1);
}
@media (max-width: 768px) {
    .cursor-follower, .cursor-dot { display: none; }
}

/* ============================================
   Navigation
   ============================================ */
.navbar {
    position: fixed; top: 0; left: 0; width: 100%; z-index: 1000;
    padding: 20px 0; transition: all var(--transition-medium);
}
.navbar.scrolled {
    background: rgba(10, 14, 39, 0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(139, 92, 246, 0.1);
    padding: 15px 0;
}
.nav-container {
    max-width: var(--container-width); margin: 0 auto; padding: 0 30px;
    display: flex; align-items: center; justify-content: space-between;
}
.nav-logo {
    display: flex; align-items: center; gap: 10px; text-decoration: none;
    font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem;
    font-weight: 700; color: var(--text-primary);
}
.nav-logo .logo-icon { width: 32px; height: 32px; color: var(--accent-purple); }
.nav-logo span {
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
}
.nav-links { display: flex; align-items: center; gap: 40px; }
.nav-link {
    color: var(--text-secondary); text-decoration: none; font-size: 0.95rem;
    font-weight: 500; position: relative; transition: color var(--transition-fast);
}
.nav-link::after {
    content: ''; position: absolute; bottom: -5px; left: 0;
    width: 0; height: 2px; background: var(--gradient-main);
    transition: width var(--transition-medium);
}
.nav-link:hover { color: var(--text-primary); }
.nav-link:hover::after { width: 100%; }
.nav-actions { display: flex; align-items: center; gap: 15px; }
.mobile-menu-btn {
    display: none; background: none; border: none;
    color: var(--text-primary); cursor: pointer; padding: 8px;
}

/* Mobile Menu */
.mobile-menu {
    position: fixed; top: 0; right: -100%; width: 100%; height: 100vh;
    background: rgba(10, 14, 39, 0.98); backdrop-filter: blur(20px);
    z-index: 999; transition: right var(--transition-medium);
    display: flex; align-items: center; justify-content: center;
}
.mobile-menu.active { right: 0; }
.mobile-menu-content { text-align: center; display: flex; flex-direction: column; gap: 30px; }
.mobile-link {
    color: var(--text-primary); text-decoration: none;
    font-size: 1.5rem; font-weight: 600; transition: color var(--transition-fast);
}
.mobile-link:hover { color: var(--accent-purple); }
.mobile-actions { display: flex; flex-direction: column; gap: 15px; margin-top: 20px; }

@media (max-width: 968px) {
    .nav-links, .nav-actions { display: none; }
    .mobile-menu-btn { display: block; }
}

/* ============================================
   Buttons
   ============================================ */
.btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 24px; border: none; border-radius: var(--radius-full);
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; transition: all var(--transition-medium);
    position: relative; overflow: hidden;
}
.btn-ghost {
    background: transparent; color: var(--text-secondary);
    border: 1px solid rgba(139, 92, 246, 0.3);
}
.btn-ghost:hover {
    background: rgba(139, 92, 246, 0.1);
    color: var(--text-primary);
    border-color: rgba(139, 92, 246, 0.5);
}
.btn-primary { background: var(--gradient-main); color: #000; }
.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4);
}

/* Hero Buttons */
.btn-hero-primary {
    background: var(--gradient-main); color: #000;
    padding: 18px 36px; font-size: 1.1rem; position: relative; z-index: 1;
}
.btn-hero-primary .btn-shine {
    position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    z-index: 2; animation: shine 3s infinite;
}
@keyframes shine {
    0%, 100% { left: -100%; }
    50% { left: 100%; }
}
.btn-hero-primary:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 20px 60px rgba(139, 92, 246, 0.5);
}
.btn-hero-secondary {
    background: transparent; border: 2px solid rgba(139, 92, 246, 0.5);
    color: var(--accent-purple); padding: 18px 36px; font-size: 1.1rem;
    backdrop-filter: blur(10px);
}
.btn-hero-secondary:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: var(--accent-purple); transform: translateY(-3px);
}
.btn-hero-secondary .btn-play {
    width: 24px; height: 24px; background: var(--accent-purple);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
}

/* CTA Buttons */
.btn-cta-primary {
    background: var(--gradient-main); color: #000;
    padding: 20px 48px; font-size: 1.15rem;
}
.btn-cta-primary:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 20px 60px rgba(139, 92, 246, 0.5);
}
.btn-cta-secondary {
    background: transparent; border: 2px solid rgba(139, 92, 246, 0.5);
    color: var(--accent-purple); padding: 20px 48px; font-size: 1.15rem;
}
.btn-cta-secondary:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: var(--accent-purple);
}

/* ============================================
   Hero Section
   ============================================ */
.hero-section {
    min-height: 100vh; position: relative; display: flex;
    align-items: center; overflow: hidden; background: var(--gradient-hero);
}
#hero-canvas {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;
}

/* Floating Elements */
.floating-elements {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 2; pointer-events: none;
}
.floating-shape { position: absolute; border-radius: 50%; opacity: 0.5; filter: blur(1px); }
.shape-1 { width: 15px; height: 15px; background: var(--accent-purple); top: 20%; left: 10%; animation: float1 6s ease-in-out infinite; }
.shape-2 { width: 10px; height: 10px; background: var(--accent-pink); top: 60%; left: 5%; animation: float2 8s ease-in-out infinite; }
.shape-3 { width: 20px; height: 20px; background: var(--accent-cyan); top: 30%; right: 15%; animation: float3 7s ease-in-out infinite; }
.shape-4 { width: 8px; height: 8px; background: var(--accent-green); top: 70%; right: 10%; animation: float1 5s ease-in-out infinite; }
.shape-5 { width: 12px; height: 12px; background: var(--accent-yellow); top: 80%; left: 20%; animation: float2 9s ease-in-out infinite; }

@keyframes float1 { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-30px) rotate(180deg); } }
@keyframes float2 { 0%, 100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-20px) translateX(20px); } }
@keyframes float3 { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-25px) scale(1.1); } }

/* Gradient Orbs */
.gradient-orbs { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.4; }
.orb-1 { width: 400px; height: 400px; background: var(--accent-blue); top: 10%; left: -5%; animation: orbFloat1 10s ease-in-out infinite; }
.orb-2 { width: 500px; height: 500px; background: var(--accent-purple); bottom: 10%; right: -10%; animation: orbFloat2 12s ease-in-out infinite; }
.orb-3 { width: 300px; height: 300px; background: var(--accent-pink); top: 50%; left: 50%; transform: translate(-50%, -50%); animation: orbFloat3 8s ease-in-out infinite; }

@keyframes orbFloat1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 30px); } }
@keyframes orbFloat2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-40px, -20px); } }
@keyframes orbFloat3 { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.1); } }

/* Hero Container */
.hero-container {
    position: relative; z-index: 10; width: 100%;
    max-width: var(--container-width); margin: 0 auto; padding: 120px 30px;
}
.hero-content { text-align: center; max-width: 900px; margin: 0 auto; }

/* Hero Badge */
.hero-badge {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 24px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2));
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-full); font-size: 0.9rem;
    color: var(--accent-blue); margin-bottom: 30px; backdrop-filter: blur(10px);
}

/* Hero Title */
.hero-title { margin-bottom: 20px; }
.title-main {
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(3rem, 10vw, 7rem); font-weight: 800;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.1; letter-spacing: -2px; display: block;
    animation: titleGlow 3s ease-in-out infinite;
}
@keyframes titleGlow {
    0%, 100% { filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.3)); }
    50% { filter: drop-shadow(0 0 40px rgba(139, 92, 246, 0.5)); }
}

/* Hero Subtitle */
.hero-subtitle {
    font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 600; margin-bottom: 25px;
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Hero Description */
.hero-description {
    font-size: 1.2rem; color: var(--text-secondary);
    max-width: 700px; margin: 0 auto 30px; line-height: 1.8;
}
.hero-description .highlight { color: var(--accent-green); font-weight: 600; }

/* Feature Tags */
.feature-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-bottom: 40px; }
.tag {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border-radius: var(--radius-full);
    font-size: 0.85rem; font-weight: 500; backdrop-filter: blur(10px);
    transition: all var(--transition-medium);
}
.tag:hover { transform: translateY(-3px); }
.tag-green { background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; }
.tag-purple { background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #a78bfa; }
.tag-amber { background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; }
.tag-blue { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; }
.tag-yellow { background: rgba(234, 179, 8, 0.2); border: 1px solid rgba(234, 179, 8, 0.4); color: #facc15; }

/* Hero CTA */
.hero-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-bottom: 60px; }

/* Hero Stats */
.hero-stats { display: flex; justify-content: center; align-items: center; gap: 40px; flex-wrap: wrap; }
.stat-item { text-align: center; }
.stat-number {
    display: block; font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(2rem, 5vw, 3rem); font-weight: 700;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; margin-bottom: 5px;
}
.stat-label { font-size: 0.85rem; color: var(--text-muted); }
.stat-divider { width: 1px; height: 50px; background: linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.5), transparent); }

/* Scroll Indicator */
.scroll-indicator {
    position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    color: var(--text-muted); font-size: 0.85rem;
    animation: bounce 2s ease-in-out infinite;
}
.mouse { width: 26px; height: 42px; border: 2px solid rgba(139, 92, 246, 0.5); border-radius: 20px; display: flex; justify-content: center; padding-top: 8px; }
.wheel { width: 4px; height: 10px; background: var(--accent-purple); border-radius: 2px; animation: scroll 2s ease-in-out infinite; }
@keyframes scroll { 0%, 100% { opacity: 1; transform: translateY(0); } 50% { opacity: 0.5; transform: translateY(6px); } }
@keyframes bounce { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-10px); } }

/* Animation Classes */
.animate-in { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease, transform 0.8s ease; }
.animate-in.visible { opacity: 1; transform: translateY(0); }

/* ============================================
   Sections Base Styles
   ============================================ */
.section { position: relative; padding: var(--section-padding) 0; overflow: hidden; }
.section-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
.bg-gradient { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.bg-pattern {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-image: radial-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px);
    background-size: 40px 40px; opacity: 0.5;
}
.bg-mesh {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px),
                linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
}
.container { max-width: var(--container-width); margin: 0 auto; padding: 0 30px; position: relative; z-index: 10; }

/* Section Headers */
.section-header { text-align: center; margin-bottom: 60px; }
.section-badge {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 24px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(139, 92, 246, 0.2));
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--radius-full); font-size: 0.9rem;
    color: var(--accent-green); margin-bottom: 25px; backdrop-filter: blur(10px);
}
.section-badge.badge-amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 179, 8, 0.2));
    border-color: rgba(245, 158, 11, 0.3); color: var(--accent-amber);
}
.section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 20px; line-height: 1.2;
}
.section-description {
    font-size: 1.2rem; color: var(--text-secondary);
    max-width: 700px; margin: 0 auto; line-height: 1.7;
}
.section-description .highlight { color: var(--accent-green); font-weight: 600; }

/* ============================================
   Accounting / Key Features Section
   ============================================ */
.section-accounting { background: linear-gradient(180deg, var(--tertiary-dark) 0%, var(--primary-dark) 100%); }
.section-accounting .bg-gradient {
    background: radial-gradient(ellipse at 20% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
}
.accounting-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; margin-bottom: 60px; }
.accounting-card {
    position: relative; background: rgba(15, 18, 41, 0.6);
    border-radius: var(--radius-lg); padding: 40px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden; transition: all var(--transition-medium);
}
.accounting-card:hover { transform: translateY(-10px); border-color: rgba(255, 255, 255, 0.1); }
.card-glow { position: absolute; top: 0; left: 0; right: 0; height: 2px; opacity: 0; transition: opacity var(--transition-medium); }
.accounting-card:hover .card-glow { opacity: 1; }
.card-green .card-glow { background: linear-gradient(90deg, transparent, var(--accent-green), transparent); }
.card-purple .card-glow { background: linear-gradient(90deg, transparent, var(--accent-purple), transparent); }
.card-blue .card-glow { background: linear-gradient(90deg, transparent, var(--accent-blue), transparent); }
.card-green:hover { box-shadow: 0 20px 60px rgba(16, 185, 129, 0.15); }
.card-purple:hover { box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15); }
.card-blue:hover { box-shadow: 0 20px 60px rgba(59, 130, 246, 0.15); }
.card-icon {
    width: 70px; height: 70px; border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 25px;
}
.card-green .card-icon { background: linear-gradient(135deg, var(--accent-green), #059669); }
.card-purple .card-icon { background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink)); }
.card-blue .card-icon { background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan)); }
.card-title {
    font-size: 1.5rem; font-weight: 700; text-align: center; margin-bottom: 25px;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.card-list { list-style: none; display: flex; flex-direction: column; gap: 15px; }
.card-list li { display: flex; align-items: flex-start; gap: 12px; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; }
.card-green .card-list li i, .card-green .card-list li svg { color: var(--accent-green); }
.card-purple .card-list li i, .card-purple .card-list li svg { color: var(--accent-purple); }
.card-blue .card-list li i, .card-blue .card-list li svg { color: var(--accent-blue); }

/* ============================================
   Simulation Section
   ============================================ */
.section-simulation { background: linear-gradient(180deg, var(--primary-dark) 0%, var(--tertiary-dark) 50%, var(--primary-dark) 100%); }
.section-simulation .simulation-gradient {
    background: radial-gradient(ellipse at 70% 30%, rgba(245, 158, 11, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 30% 70%, rgba(234, 179, 8, 0.1) 0%, transparent 50%);
}
.simulation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; margin-bottom: 60px; }
.simulation-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5));
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: var(--radius-md); padding: 30px; transition: all var(--transition-medium);
}
.simulation-card:hover {
    transform: translateY(-8px); border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 20px 50px rgba(245, 158, 11, 0.1);
}
.sim-icon { width: 50px; height: 50px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
.sim-green { background: linear-gradient(135deg, #10b981, #059669); }
.sim-blue { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.sim-purple { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
.sim-orange { background: linear-gradient(135deg, #f97316, #ef4444); }
.sim-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.sim-title { font-size: 1.15rem; font-weight: 600; color: var(--accent-amber); margin-bottom: 12px; }
.sim-question { font-size: 0.9rem; color: var(--text-muted); font-style: italic; line-height: 1.6; }

/* ============================================
   Audience Section
   ============================================ */
.section-audience { background: linear-gradient(180deg, var(--primary-dark) 0%, var(--tertiary-dark) 100%); }
.section-audience .audience-gradient { background: radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%); }
.audience-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
.audience-card {
    position: relative;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: var(--radius-lg); padding: 40px; text-align: center;
    transition: all var(--transition-medium); overflow: hidden;
}
.audience-card:hover {
    transform: translateY(-10px) scale(1.02);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 25px 60px rgba(139, 92, 246, 0.2);
}
.audience-glow {
    position: absolute; top: 50%; left: 50%; width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.2), transparent 70%);
    transform: translate(-50%, -50%); opacity: 0;
    transition: opacity var(--transition-medium); pointer-events: none;
}
.audience-card:hover .audience-glow { opacity: 1; }
.audience-icon {
    width: 70px; height: 70px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;
    margin: 0 auto 25px; transition: transform var(--transition-medium);
}
.audience-card:hover .audience-icon { transform: scale(1.1) rotate(5deg); }
.audience-card h3 {
    font-size: 1.5rem; font-weight: 700; margin-bottom: 10px;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.audience-card p { color: var(--text-secondary); font-size: 0.95rem; }

/* ============================================
   Features Section
   ============================================ */
.section-features { background: linear-gradient(180deg, var(--primary-dark) 0%, var(--tertiary-dark) 100%); }
.section-features .features-gradient {
    background: radial-gradient(ellipse at 30% 40%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 60%, rgba(139, 92, 246, 0.08) 0%, transparent 50%);
}
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
.feature-card {
    position: relative;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5));
    border: 1px solid rgba(100, 116, 139, 0.2);
    border-radius: var(--radius-md); padding: 30px;
    transition: all var(--transition-medium); overflow: hidden;
}
.feature-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    opacity: 0; transition: opacity var(--transition-medium);
}
.feature-card:hover::before { opacity: 1; }
.feature-card[data-color="blue-cyan"]::before { background: linear-gradient(90deg, #3b82f6, #06b6d4); }
.feature-card[data-color="purple-pink"]::before { background: linear-gradient(90deg, #8b5cf6, #ec4899); }
.feature-card[data-color="green-emerald"]::before { background: linear-gradient(90deg, #10b981, #059669); }
.feature-card[data-color="yellow-orange"]::before { background: linear-gradient(90deg, #eab308, #f97316); }
.feature-card[data-color="red-rose"]::before { background: linear-gradient(90deg, #ef4444, #f43f5e); }
.feature-card[data-color="indigo-blue"]::before { background: linear-gradient(90deg, #6366f1, #3b82f6); }
.feature-card[data-color="teal-cyan"]::before { background: linear-gradient(90deg, #14b8a6, #06b6d4); }
.feature-card[data-color="violet-purple"]::before { background: linear-gradient(90deg, #7c3aed, #8b5cf6); }
.feature-card[data-color="lime-green"]::before { background: linear-gradient(90deg, #84cc16, #10b981); }
.feature-card[data-color="amber-yellow"]::before { background: linear-gradient(90deg, #f59e0b, #eab308); }
.feature-card:hover {
    transform: translateY(-8px) scale(1.02);
    border-color: rgba(139, 92, 246, 0.3);
    box-shadow: 0 20px 50px rgba(139, 92, 246, 0.15);
}
.feature-card-icon {
    width: 50px; height: 50px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px; transition: transform var(--transition-medium);
}
.feature-card:hover .feature-card-icon { transform: scale(1.1) rotate(5deg); }
.feature-card[data-color="blue-cyan"] .feature-card-icon { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.feature-card[data-color="purple-pink"] .feature-card-icon { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
.feature-card[data-color="green-emerald"] .feature-card-icon { background: linear-gradient(135deg, #10b981, #059669); }
.feature-card[data-color="yellow-orange"] .feature-card-icon { background: linear-gradient(135deg, #eab308, #f97316); }
.feature-card[data-color="red-rose"] .feature-card-icon { background: linear-gradient(135deg, #ef4444, #f43f5e); }
.feature-card[data-color="indigo-blue"] .feature-card-icon { background: linear-gradient(135deg, #6366f1, #3b82f6); }
.feature-card[data-color="teal-cyan"] .feature-card-icon { background: linear-gradient(135deg, #14b8a6, #06b6d4); }
.feature-card[data-color="violet-purple"] .feature-card-icon { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
.feature-card[data-color="lime-green"] .feature-card-icon { background: linear-gradient(135deg, #84cc16, #10b981); }
.feature-card[data-color="amber-yellow"] .feature-card-icon { background: linear-gradient(135deg, #f59e0b, #eab308); }
.feature-card h3 {
    font-size: 1.2rem; font-weight: 700; margin-bottom: 10px;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.feature-card p { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; }

/* ============================================
   Advantages Section
   ============================================ */
.section-advantages { background: linear-gradient(180deg, var(--tertiary-dark) 0%, var(--primary-dark) 100%); }
.section-advantages .advantages-gradient { background: radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 60%); }
.advantages-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; max-width: 1000px; margin: 0 auto; }
.advantage-item {
    display: flex; align-items: center; gap: 20px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: var(--radius-md); padding: 25px 30px;
    transition: all var(--transition-medium);
}
.advantage-item:hover {
    transform: translateX(10px) scale(1.02);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 15px 40px rgba(139, 92, 246, 0.15);
}
.advantage-icon {
    width: 45px; height: 45px;
    background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
    border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: transform var(--transition-medium);
}
.advantage-item:hover .advantage-icon { transform: scale(1.1) rotate(5deg); }
.advantage-item p { flex: 1; color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; line-height: 1.5; }
.advantage-check { flex-shrink: 0; }
.advantage-check i, .advantage-check svg { width: 24px; height: 24px; color: var(--accent-green); }

/* ============================================
   CTA Section
   ============================================ */
.section-cta { background: linear-gradient(180deg, var(--primary-dark) 0%, #050814 100%); padding: 150px 0; }
.cta-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; overflow: hidden; }
.cta-gradient {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: radial-gradient(ellipse at 25% 40%, rgba(245, 158, 11, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 75% 60%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
}
.cta-orbs { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.cta-orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.4; }
.cta-orb-1 { width: 500px; height: 500px; background: var(--accent-yellow); top: 0; left: 20%; animation: ctaOrb1 15s ease-in-out infinite; }
.cta-orb-2 { width: 400px; height: 400px; background: var(--accent-green); bottom: 0; right: 20%; animation: ctaOrb2 12s ease-in-out infinite; }
@keyframes ctaOrb1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(50px, 30px); } }
@keyframes ctaOrb2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-40px, -20px); } }
.cta-content { text-align: center; max-width: 900px; margin: 0 auto; position: relative; z-index: 10; }
.cta-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(2rem, 5vw, 4rem); font-weight: 700;
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 25px; line-height: 1.2;
}
.cta-description { font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 40px; }
.cta-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-bottom: 30px; }
.cta-note { font-size: 0.9rem; color: var(--text-muted); }

/* ============================================
   Footer
   ============================================ */
.footer {
    position: relative; background: #050814; padding: 80px 0 40px;
    border-top: 1px solid rgba(59, 130, 246, 0.1);
}
.footer-gradient {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
    pointer-events: none;
}
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 60px; margin-bottom: 60px; }
.footer-brand { max-width: 300px; }
.footer-logo {
    display: flex; align-items: center; gap: 10px; margin-bottom: 15px;
    font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700;
}
.footer-logo span {
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.footer-tagline { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 10px; }
.footer-powered { color: var(--text-muted); font-size: 0.8rem; }
.footer-section h4 {
    font-size: 0.85rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: var(--accent-purple); margin-bottom: 20px;
}
.footer-links { display: flex; flex-direction: column; gap: 12px; }
.footer-links a {
    display: flex; align-items: center; gap: 10px;
    color: var(--text-muted); text-decoration: none; font-size: 0.9rem;
    transition: color var(--transition-fast);
}
.footer-links a:hover { color: var(--accent-purple); }
.footer-bottom { padding-top: 30px; border-top: 1px solid rgba(59, 130, 246, 0.1); text-align: center; }
.footer-bottom p { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 10px; }
.footer-bottom a { color: var(--accent-purple); text-decoration: none; transition: color var(--transition-fast); }
.footer-bottom a:hover { color: var(--accent-pink); }

/* ============================================
   Utility Classes
   ============================================ */
.text-gradient {
    background: var(--gradient-main);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.landing-page .hidden { display: none !important; }
.landing-page .visible { opacity: 1 !important; transform: translateY(0) !important; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.glow-text { text-shadow: 0 0 20px currentColor; }
.glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }

/* ============================================
   Responsive Design
   ============================================ */
@media (max-width: 1024px) {
    :root { --section-padding: 80px; }
    .hero-stats { gap: 20px; }
    .stat-divider { display: none; }
    .features-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
    .footer-brand { grid-column: 1 / -1; max-width: 100%; text-align: center; }
}

@media (max-width: 768px) {
    :root { --section-padding: 60px; }
    .hero-container { padding: 100px 20px 60px; }
    .hero-cta { flex-direction: column; align-items: center; }
    .btn-hero-primary, .btn-hero-secondary { width: 100%; max-width: 300px; }
    .hero-stats { flex-direction: column; gap: 25px; }
    .accounting-cards { grid-template-columns: 1fr; }
    .simulation-grid { grid-template-columns: 1fr; }
    .audience-grid { grid-template-columns: 1fr; }
    .advantages-grid { grid-template-columns: 1fr; }
    .advantage-item { flex-wrap: wrap; }
    .cta-buttons { flex-direction: column; align-items: center; }
    .btn-cta-primary, .btn-cta-secondary { width: 100%; max-width: 300px; }
    .scroll-indicator { display: none; }
    .footer-grid { grid-template-columns: 1fr; gap: 30px; text-align: center; }
    .footer-brand { max-width: 100%; }
    .footer-links { align-items: center; }
}

@media (max-width: 480px) {
    .container { padding: 0 15px; }
    .section-title { font-size: 1.8rem; }
    .section-description { font-size: 1rem; }
    .feature-tags { gap: 8px; }
    .tag { padding: 8px 14px; font-size: 0.75rem; }
    .accounting-card { padding: 25px; }
    .simulation-card, .audience-card, .feature-card { padding: 25px; }
    .features-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
}
```

---

## PHASE 3 — Adaptation

### Objectif
Remplacer tous les placeholders `{{...}}` par les valeurs de la configuration.

### Liste des placeholders a remplacer

#### Placeholders globaux (JSX + CSS)

| Placeholder | Description | Exemple |
|-------------|-------------|---------|
| `{{PRODUCT_NAME}}` | Nom du produit | "CashPilot" |
| `{{PRIMARY_COLOR}}` | Couleur primaire CSS | "#8b5cf6" |
| `{{ACCENT_COLOR}}` | Couleur accent CSS | "#f59e0b" |
| `{{SECONDARY_COLOR}}` | Couleur secondaire CSS | "#10b981" |
| `{{PRIMARY_COLOR_HEX_INT}}` | Couleur Three.js (sans #) | "8b5cf6" |
| `{{CSS_IMPORT_PATH}}` | Chemin import CSS | "../styles/landing.css" |

#### Placeholders JSX — Navigation

| Placeholder | Description | Exemple |
|-------------|-------------|---------|
| `{{LOGO_ICON}}` | Composant lucide-react pour le logo | "Wallet" |
| `{{NAV_LINK_1_LABEL}}` | Label du premier lien nav | "Fonctionnalites" |
| `{{NAV_LINK_2_LABEL}}` | Label du second lien nav | "Simulations" |
| `{{NAV_LINK_3_LABEL}}` | Label du troisieme lien nav | "Pour qui ?" |
| `{{NAV_LINK_4_LABEL}}` | Label du quatrieme lien nav | "Avantages" |
| `{{LOGIN_PATH}}` | Route de connexion | "/login" |
| `{{SIGNUP_PATH}}` | Route d'inscription | "/signup" |
| `{{LOGIN_BUTTON_TEXT}}` | Texte bouton connexion | "Connexion" |
| `{{SIGNUP_BUTTON_TEXT}}` | Texte bouton inscription | "Demarrer" |

#### Placeholders JSX — Hero Section

| Placeholder | Description | Exemple |
|-------------|-------------|---------|
| `{{HERO_BADGE_TEXT}}` | Texte du badge hero | "Solution de Gestion d'Entreprise" |
| `{{TAGLINE}}` | Slogan sous le titre | "La revolution de la comptabilite" |
| `{{DESCRIPTION_HIGHLIGHT}}` | Texte mis en avant (vert) | "Vous introduisez les donnees..." |
| `{{DESCRIPTION_DETAIL}}` | Detail sous le highlight | "Gestion financiere 100% automatisee" |
| `{{TAG_N_TEXT}}` | Texte des tags (1-5) | "Temps Reel" |
| `{{CTA_BUTTON_TEXT}}` | Bouton CTA principal | "Demarrer Gratuitement" |
| `{{SECONDARY_CTA_TEXT}}` | Bouton CTA secondaire | "Voir la Demo" |
| `{{STAT_N_NUMBER}}` | Chiffre stat (1-4) | "< 1s" |
| `{{STAT_N_LABEL}}` | Label stat (1-4) | "Generation Ecritures" |
| `{{SCROLL_TEXT}}` | Texte scroll indicator | "Decouvrir" |

#### Placeholders JSX — Sections

| Placeholder | Description |
|-------------|-------------|
| `{{ACCOUNTING_BADGE_TEXT}}` | Badge section comptabilite |
| `{{ACCOUNTING_TITLE}}` | Titre section |
| `{{ACCOUNTING_HIGHLIGHT}}` | Highlight de la description |
| `{{CARD_N_ICON}}` | Icone lucide-react de la carte N |
| `{{CARD_N_TITLE}}` | Titre de la carte N |
| `{{CARD_N_ITEM_N}}` | Item de la liste de la carte N |
| `{{SIMULATION_BADGE_TEXT}}` | Badge section simulation |
| `{{SIMULATION_TITLE}}` | Titre section simulation |
| `{{SIM_N_ICON}}` | Icone simulation N |
| `{{SIM_N_TITLE}}` | Titre simulation N |
| `{{SIM_N_QUESTION}}` | Question simulation N |
| `{{AUDIENCE_TITLE}}` | Titre section audience |
| `{{AUD_N_ICON}}` | Icone audience N |
| `{{AUD_N_TITLE}}` | Titre audience N |
| `{{AUD_N_DESCRIPTION}}` | Description audience N |
| `{{FEATURES_TITLE}}` | Titre section features |
| `{{FEAT_N_ICON}}` | Icone feature N |
| `{{FEAT_N_TITLE}}` | Titre feature N |
| `{{FEAT_N_DESCRIPTION}}` | Description feature N |
| `{{ADVANTAGES_TITLE}}` | Titre section avantages |
| `{{ADV_N_ICON}}` | Icone avantage N |
| `{{ADV_N_TEXT}}` | Texte avantage N |

#### Placeholders JSX — CTA + Footer

| Placeholder | Description |
|-------------|-------------|
| `{{CTA_TITLE}}` | Titre section CTA |
| `{{CTA_DESCRIPTION}}` | Description CTA |
| `{{CTA_NOTE}}` | Note sous les boutons CTA |
| `{{FOOTER_TAGLINE}}` | Tagline dans le footer |
| `{{FOOTER_POWERED_BY}}` | Texte "Propulse par..." |
| `{{COMPANY_NAME}}` | Nom de l'entreprise |
| `{{WEBSITE}}` | URL du site |
| `{{WEBSITE_DISPLAY}}` | URL affichee (sans https://) |
| `{{CONTACT_EMAIL}}` | Email de contact |
| `{{CONTACT_PHONE}}` | Telephone (format tel:) |
| `{{CONTACT_PHONE_DISPLAY}}` | Telephone affiche |
| `{{FOOTER_QUICK_LINKS_TITLE}}` | Titre colonne liens rapides |
| `{{FOOTER_LINK_N}}` | Labels des liens footer (1-4) |
| `{{FOOTER_COPYRIGHT}}` | Texte copyright |
| `{{FOOTER_MADE_WITH}}` | Texte "Developpe avec..." |

### Sections conditionnelles

Le template utilise des marqueurs `{{IF sections.includes("...")}}` / `{{END IF}}` pour les sections optionnelles. Si une section n'est pas dans la liste `sections` de la config, supprimer le bloc JSX correspondant.

---

## PHASE 4 — Verification

### Objectif
S'assurer que les fichiers generes sont fonctionnels.

### Checklist

1. **JSX valide** : Pas de placeholder `{{...}}` restant dans le code genere
2. **CSS valide** : Les variables CSS `:root` contiennent les bonnes couleurs
3. **Imports corrects** : Toutes les icones lucide-react utilisees sont importees
4. **Pas de references a CashPilot** : Sauf si c'est le produit cible
5. **Build** : `npm run build` passe sans erreurs
6. **Responsive** : Les 3 breakpoints sont presents (1024px, 768px, 480px)

### Criteres de qualite

| Critere | Verification |
|---------|-------------|
| Preloader fonctionne | Logo + barre animee, disparait apres 1.5s |
| Curseur custom | Follower + dot sur desktop, masque sur mobile |
| Three.js canvas | Particules 3D avec rotation et couleur dynamique |
| GSAP animations | Section headers + cards animees au scroll |
| Boutons magnetiques | Suivent le curseur, retour elastique |
| Gradient textes | Titres avec gradient personnalise |
| Dark theme | Fond sombre, texte clair, cartes semi-transparentes |
| Responsive | Layout adapte a chaque breakpoint |

---

## Dependances npm requises

```json
{
  "three": "^0.160.0",
  "gsap": "^3.12.0",
  "lucide-react": "^0.300.0",
  "react-router-dom": "^6.20.0"
}
```

---

## Exemple d'utilisation

```
Utilisateur: "Cree-moi une landing page pour mon app de fitness 'FitTracker'"

Agent: Applique le skill create-landing-page avec :
  - productName: "FitTracker"
  - tagline: "Votre coach fitness intelligent"
  - description: "Suivez vos performances, atteignez vos objectifs"
  - primaryColor: "#ef4444" (rouge)
  - accentColor: "#f59e0b" (amber)
  - secondaryColor: "#22c55e" (vert)
  - features: [
      { icon: "Dumbbell", title: "Exercices", description: "500+ exercices guides" },
      { icon: "TrendingUp", title: "Progression", description: "Graphiques et stats" },
      ...
    ]
  - Genere FitTrackerLandingPage.jsx + fittracker-landing.css
```

---

## Fichiers de reference

| Fichier | Utilite |
|---------|---------|
| `src/pages/LandingPage.jsx` | Template JSX source (1114 lignes) |
| `src/styles/landing.css` | Template CSS source (2199 lignes) |
| `docs/Landing-Page-Agent.md` | Definition de l'agent |
