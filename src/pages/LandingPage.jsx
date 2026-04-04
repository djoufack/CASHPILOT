import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DemoBanner from '@/components/DemoBanner';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { landingPageContent } from '@/content/landingPageContent';
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
  Coins,
  Download,
  Rocket,
} from 'lucide-react';
import '../styles/landing.css';

let gsapModulePromise;
const loadGsapModules = () => {
  if (!gsapModulePromise) {
    gsapModulePromise = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([gsapModule, scrollTriggerModule]) => ({
        gsap: gsapModule.gsap || gsapModule.default || gsapModule,
        ScrollTrigger: scrollTriggerModule.ScrollTrigger || scrollTriggerModule.default || scrollTriggerModule,
      })
    );
  }
  return gsapModulePromise;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [mobileMenuActive, setMobileMenuActive] = useState(false);
  const [navbarScrolled, setNavbarScrolled] = useState(false);
  const [demoBannerVisible, setDemoBannerVisible] = useState(!localStorage.getItem('cashpilot_demo_banner_dismissed'));

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

  // Lock body scroll only while mobile menu is open and always restore previous state.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (mobileMenuActive) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuActive]);

  // Custom Cursor
  useEffect(() => {
    if (window.innerWidth <= 768) return;

    const cursor = cursorFollowerRef.current;
    const dot = cursorDotRef.current;

    if (!cursor || !dot) return;

    let mouseX = 0,
      mouseY = 0;
    let cursorX = 0,
      cursorY = 0;
    let dotX = 0,
      dotY = 0;

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
    const interactiveElements = document.querySelectorAll(
      'a, button, .feature-card, .audience-card, .simulation-card, .accounting-card, .country-item, .advantage-item'
    );

    interactiveElements.forEach((el) => {
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
    if (!heroCanvasRef.current) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import('three');
      if (cancelled || !heroCanvasRef.current) return;

      const canvas = heroCanvasRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
        blending: THREE.AdditiveBlending,
      });

      const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);

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
        opacity: 0.2,
      });

      const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
      scene.add(linesMesh);

      camera.position.z = 3;

      let mouseX = 0;
      let mouseY = 0;

      const handleMouseMove = (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      document.addEventListener('mousemove', handleMouseMove);

      const animate = () => {
        if (cancelled) return;

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

      cleanup = () => {
        cancelled = true;
        document.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        particlesGeometry.dispose();
        particlesMaterial.dispose();
        linesGeometry.dispose();
        linesMaterial.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  // GSAP Scroll Animations
  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    const cleanupHandlers = [];
    let scrollTriggerApi = null;

    (async () => {
      const { gsap, ScrollTrigger } = await loadGsapModules();
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerApi = ScrollTrigger;

      gsap.utils.toArray('.section-header').forEach((header) => {
        gsap.from(header, {
          opacity: 0,
          y: 60,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: header,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      });

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
            toggleActions: 'play none none reverse',
          },
        });
      });

      const buttons = document.querySelectorAll('.magnetic-btn');
      buttons.forEach((button) => {
        const handleMove = (e) => {
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;

          gsap.to(button, {
            x: x * 0.3,
            y: y * 0.3,
            duration: 0.3,
            ease: 'power2.out',
          });
        };

        const handleLeave = () => {
          gsap.to(button, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: 'elastic.out(1, 0.3)',
          });
        };

        button.addEventListener('mousemove', handleMove);
        button.addEventListener('mouseleave', handleLeave);
        cleanupHandlers.push(() => {
          button.removeEventListener('mousemove', handleMove);
          button.removeEventListener('mouseleave', handleLeave);
        });
      });
    })();

    return () => {
      cancelled = true;
      cleanupHandlers.forEach((fn) => fn());
      scrollTriggerApi?.getAll?.().forEach((trigger) => trigger.kill());
    };
  }, [isLoaded]);

  const toggleMobileMenu = () => {
    setMobileMenuActive((previous) => !previous);
  };

  const closeMobileMenu = () => {
    setMobileMenuActive(false);
  };

  const languageCode = String(i18n.resolvedLanguage || i18n.language || 'en')
    .toLowerCase()
    .split('-')[0];
  const copy = landingPageContent[languageCode] || landingPageContent.en;
  const legalLinkLabels =
    languageCode === 'fr'
      ? { privacy: 'Politique de confidentialite', legal: 'Mentions legales' }
      : languageCode === 'nl'
        ? { privacy: 'Privacybeleid', legal: 'Juridische vermeldingen' }
        : { privacy: 'Privacy policy', legal: 'Legal notice' };

  const handleNavigate = (path) => {
    closeMobileMenu();
    navigate(path);
  };

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const target = document.querySelector(targetId);
    if (target) {
      const offsetTop = target.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      });
    }
    closeMobileMenu();
  };

  const navLinks = [
    { href: '#features', label: copy.nav.features },
    { href: '#latest', label: copy.nav.latest },
    { href: '#simulation', label: copy.nav.simulations },
    { href: '#audience', label: copy.nav.audience },
    { href: '#advantages', label: copy.nav.advantages },
  ];

  const heroTags = [
    { icon: Zap, className: 'tag tag-green', label: copy.hero.tags.realtime },
    { icon: Globe, className: 'tag tag-purple', label: copy.hero.tags.regions },
    { icon: Lightbulb, className: 'tag tag-amber', label: copy.hero.tags.whatIf },
    { icon: Shield, className: 'tag tag-blue', label: copy.hero.tags.reverseAccounting },
    { icon: Sparkles, className: 'tag tag-yellow', label: copy.hero.tags.automated },
    { icon: Bot, className: 'tag tag-cyan', label: copy.hero.tags.mcp },
    { icon: Briefcase, className: 'tag tag-indigo', label: copy.hero.tags.projectsCrm },
    { icon: Lock, className: 'tag tag-red', label: copy.hero.tags.security },
  ];

  const accountingCards = [
    { icon: Zap, className: 'accounting-card card-green', ...copy.accounting.cards[0] },
    { icon: TrendingUp, className: 'accounting-card card-purple', ...copy.accounting.cards[1] },
    { icon: Shield, className: 'accounting-card card-blue', ...copy.accounting.cards[2] },
  ];

  const simulationCards = [
    { icon: TrendingUp, className: 'sim-green', ...copy.simulation.cards[0] },
    { icon: UserPlus, className: 'sim-blue', ...copy.simulation.cards[1] },
    { icon: DollarSign, className: 'sim-purple', ...copy.simulation.cards[2] },
    { icon: Wallet, className: 'sim-orange', ...copy.simulation.cards[3] },
    { icon: Target, className: 'sim-indigo', ...copy.simulation.cards[4] },
  ];

  const simulationFeatures = [
    { icon: TrendingUp, className: 'feature-item feature-amber', ...copy.simulation.features[0] },
    { icon: Lightbulb, className: 'feature-item feature-purple', ...copy.simulation.features[1] },
    { icon: Target, className: 'feature-item feature-blue', ...copy.simulation.features[2] },
    { icon: BarChart3, className: 'feature-item feature-green', ...copy.simulation.features[3] },
  ];

  const audienceCards = [
    { icon: UserCheck, ...copy.audience.cards[0] },
    { icon: Building2, ...copy.audience.cards[1] },
    { icon: Briefcase, ...copy.audience.cards[2] },
    { icon: Users, ...copy.audience.cards[3] },
    { icon: Store, ...copy.audience.cards[4] },
    { icon: Sparkles, ...copy.audience.cards[5] },
  ];

  const featureCards = [
    { icon: Users, color: 'blue-cyan', ...copy.features.cards[0] },
    { icon: BarChart3, color: 'purple-pink', ...copy.features.cards[1] },
    { icon: Clock, color: 'green-emerald', ...copy.features.cards[2] },
    { icon: FileText, color: 'yellow-orange', ...copy.features.cards[3] },
    { icon: Calculator, color: 'red-rose', ...copy.features.cards[4] },
    { icon: Package, color: 'indigo-blue', ...copy.features.cards[5] },
    { icon: Receipt, color: 'teal-cyan', ...copy.features.cards[6] },
    { icon: TrendingUp, color: 'violet-purple', ...copy.features.cards[7] },
    { icon: Target, color: 'orange-red', ...copy.features.cards[8] },
    { icon: PieChart, color: 'lime-green', ...copy.features.cards[9] },
    { icon: Lightbulb, color: 'amber-yellow', ...copy.features.cards[10] },
    { icon: Bot, color: 'cyan-blue', ...copy.features.cards[11] },
    { icon: Lock, color: 'rose-red', ...copy.features.cards[12] },
    { icon: ShieldCheck, color: 'sky-indigo', ...copy.features.cards[13] },
    { icon: Brain, color: 'emerald-teal', ...copy.features.cards[14] },
    { icon: Landmark, color: 'green-lime', ...copy.features.cards[15] },
    { icon: Mail, color: 'pink-purple', ...copy.features.cards[16] },
    { icon: Repeat, color: 'blue-indigo', ...copy.features.cards[17] },
    { icon: Plug, color: 'orange-amber', ...copy.features.cards[18] },
    { icon: Coins, color: 'violet-indigo', ...copy.features.cards[19] },
    { icon: Download, color: 'lime-emerald', ...copy.features.cards[20] },
  ];
  const latestCardIcons = [FileText, Users, Briefcase, UserCheck, Brain];
  const latestCardColors = ['yellow-orange', 'green-emerald', 'purple-pink', 'blue-cyan', 'violet-purple'];
  const latestCards = (copy.latest?.cards || []).map((card, index) => ({
    icon: latestCardIcons[index % latestCardIcons.length],
    color: latestCardColors[index % latestCardColors.length],
    ...card,
  }));

  const pilotageCards = [
    { icon: PieChart, className: 'sim-orange', ...copy.pilotage.cards[0] },
    { icon: Calculator, className: 'sim-blue', ...copy.pilotage.cards[1] },
    { icon: TrendingUp, className: 'sim-green', ...copy.pilotage.cards[2] },
    { icon: DollarSign, className: 'sim-purple', ...copy.pilotage.cards[3] },
    { icon: Lightbulb, className: 'sim-indigo', ...copy.pilotage.cards[4] },
    { icon: Shield, className: 'sim-green', ...copy.pilotage.cards[5] },
  ];

  const pilotageFeatures = [
    { icon: Briefcase, className: 'feature-item feature-amber', ...copy.pilotage.features[0] },
    { icon: Globe, className: 'feature-item feature-purple', ...copy.pilotage.features[1] },
    { icon: BarChart3, className: 'feature-item feature-blue', ...copy.pilotage.features[2] },
    { icon: Target, className: 'feature-item feature-green', ...copy.pilotage.features[3] },
  ];

  const mcpAgents = [
    { iconText: 'C', style: { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }, ...copy.mcp.agents[0] },
    { iconText: 'G', style: { background: 'rgba(16,185,129,0.15)', color: '#34d399' }, ...copy.mcp.agents[1] },
    { iconText: 'G', style: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }, ...copy.mcp.agents[2] },
    { iconText: 'M', style: { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }, ...copy.mcp.agents[3] },
    { iconText: 'R', style: { background: 'rgba(236,72,153,0.15)', color: '#f472b6' }, ...copy.mcp.agents[4] },
    { iconText: 'n', style: { background: 'rgba(239,68,68,0.15)', color: '#f87171' }, ...copy.mcp.agents[5] },
    { iconText: 'G', style: { background: 'rgba(6,182,212,0.15)', color: '#22d3ee' }, ...copy.mcp.agents[6] },
    { iconText: '+', style: { background: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }, ...copy.mcp.agents[7] },
  ];

  const mcpCardIcons = [Mic, Briefcase, Users, Workflow, Plug, Bot];
  const mcpCards = (copy.mcp.cards || []).map((card, index) => ({
    icon: mcpCardIcons[index % mcpCardIcons.length],
    ...card,
  }));

  const peppolCards = [
    { icon: Clock, iconStyle: undefined, tagClassName: 'peppol-card-tag tag-green', ...copy.peppol.cards[0] },
    {
      icon: Rocket,
      iconStyle: { color: 'var(--accent-blue)' },
      tagClassName: 'peppol-card-tag tag-blue',
      ...copy.peppol.cards[1],
    },
    {
      icon: Download,
      iconStyle: { color: '#a78bfa' },
      tagClassName: 'peppol-card-tag tag-purple',
      ...copy.peppol.cards[2],
    },
  ];

  const countryIds = ['france', 'belgium', 'ohada'];
  const advantageIcons = [Sparkles, Globe, Lightbulb, Zap, Shield, Star, Bot, Lock, Brain, Landmark];

  return (
    <div id="top" className={`landing-page${demoBannerVisible ? ' has-demo-banner' : ''}`}>
      <Helmet>
        <title>CashPilot</title>
      </Helmet>
      {/* Demo Banner */}
      {demoBannerVisible && <DemoBanner onDismiss={() => setDemoBannerVisible(false)} />}

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
      <nav
        id="navbar"
        className={`navbar ${navbarScrolled ? 'scrolled' : ''}`}
        ref={navbarRef}
        role="navigation"
        aria-label={copy.nav?.ariaLabel || 'Primary navigation'}
      >
        <div className="nav-container">
          <a
            href="#"
            className="nav-logo"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Wallet className="logo-icon" />
            <span>CashPilot</span>
          </a>
          <div className="nav-links">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="nav-prismatic"
                onClick={(e) => handleSmoothScroll(e, item.href)}
              >
                {item.label}
              </a>
            ))}
            <a
              href="/pricing"
              className="nav-prismatic"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('/pricing');
              }}
            >
              {copy.nav.pricing}
            </a>
            <a
              href="/mcp-tools.html"
              className="nav-prismatic"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open('/mcp-tools.html', '_blank');
              }}
            >
              {copy.nav.mcpTools}
            </a>
            <a
              href="/guide/"
              className="nav-prismatic"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open('/guide/', '_blank');
              }}
            >
              {copy.nav.guide}
            </a>
            <button className="nav-peppol-btn nav-prismatic" onClick={() => handleNavigate('/peppol-guide')}>
              <Globe /> {copy.nav.peppol}
            </button>
          </div>
          <div className="nav-actions">
            <LanguageSwitcher variant="segmented" />
            <button className="btn nav-prismatic" onClick={() => handleNavigate('/login')}>
              {copy.nav.login}
            </button>
            <button className="btn btn-primary nav-prismatic magnetic-btn" onClick={() => handleNavigate('/login')}>
              {copy.nav.start} <ArrowRight />
            </button>
          </div>
          <div className="mobile-nav-actions">
            <button className="nav-prismatic mobile-login-btn" onClick={() => handleNavigate('/login')}>
              {copy.nav.login}
            </button>
            <button
              className="mobile-menu-btn"
              onClick={toggleMobileMenu}
              aria-label={copy.nav?.openMenu || 'Open navigation menu'}
              aria-expanded={mobileMenuActive}
              aria-controls="mobile-menu"
            >
              <Menu />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div id="mobile-menu" className={`mobile-menu ${mobileMenuActive ? 'active' : ''}`}>
        <div className="mobile-menu-content">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="mobile-link"
              onClick={(e) => handleSmoothScroll(e, item.href)}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/pricing"
            className="mobile-link"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('/pricing');
            }}
          >
            {copy.nav.pricing}
          </a>
          <a
            href="/mcp-tools.html"
            className="mobile-link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              window.open('/mcp-tools.html', '_blank');
            }}
          >
            {copy.nav.mcpTools}
          </a>
          <a
            href="/guide/"
            className="mobile-link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              window.open('/guide/', '_blank');
            }}
          >
            {copy.nav.guide}
          </a>
          <button
            className="nav-peppol-btn nav-prismatic"
            onClick={() => {
              setMobileMenuActive(false);
              handleNavigate('/peppol-guide');
            }}
          >
            <Globe /> {copy.nav.peppolGuide}
          </button>
          <LanguageSwitcher variant="segmented" />
          <div className="mobile-actions">
            <button className="btn nav-prismatic" onClick={() => handleNavigate('/login')}>
              {copy.nav.login}
            </button>
            <button className="btn btn-primary nav-prismatic" onClick={() => handleNavigate('/login')}>
              {copy.nav.start}
            </button>
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
              <span>{copy.hero.badge}</span>
            </div>

            <h1 className="hero-title animate-in" data-delay="100">
              <span className="title-main">CashPilot</span>
            </h1>

            <h2 className="hero-subtitle animate-in" data-delay="200">
              <span className="typing-text">{copy.hero.subtitle}</span>
            </h2>

            <p className="hero-description animate-in" data-delay="300">
              <span className="highlight">{copy.hero.descriptionHighlight}</span>
              <br />
              {copy.hero.descriptionBody}
            </p>

            <p className="hero-mcp-banner animate-in" data-delay="350">
              {copy.hero.mcpBanner}
            </p>

            <div className="feature-tags animate-in" data-delay="400">
              {heroTags.map((tag) => {
                const Icon = tag.icon;
                return (
                  <div key={tag.label} className={tag.className}>
                    <Icon />
                    <span>{tag.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="hero-cta animate-in" data-delay="500">
              <button className="btn btn-hero-primary magnetic-btn" onClick={() => handleNavigate('/login')}>
                <span className="btn-text">{copy.hero.primaryCta}</span>
                <span className="btn-icon">
                  <ArrowRight />
                </span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-hero-secondary magnetic-btn" onClick={() => window.open('/guide/', '_blank')}>
                <span className="btn-text">{copy.hero.secondaryCta}</span>
                <span className="btn-play">
                  <Play />
                </span>
              </button>
            </div>

            <div className="hero-stats animate-in" data-delay="600">
              {copy.hero.stats.map((stat, index) => (
                <div key={stat.label} className="stat-item">
                  <span className="stat-number">{stat.number}</span>
                  <span className="stat-label">{stat.label}</span>
                  {index < copy.hero.stats.length - 1 ? <div className="stat-divider"></div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="scroll-indicator animate-in" data-delay="700">
            <div className="mouse">
              <div className="wheel"></div>
            </div>
            <span>{copy.hero.discover}</span>
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
              <span>{copy.accounting.badge}</span>
            </div>
            <h2 className="section-title">{copy.accounting.title}</h2>
            <p className="section-description">
              <span className="highlight">{copy.accounting.descriptionHighlight}</span>
              <br />
              {copy.accounting.descriptionBody}
            </p>
          </div>

          <div className="accounting-cards">
            {accountingCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className={card.className}>
                  <div className="card-glow"></div>
                  <div className="card-content">
                    <div className="card-icon">
                      <Icon />
                    </div>
                    <h3 className="card-title">{card.title}</h3>
                    <ul className="card-list">
                      {card.items.map((item) => (
                        <li key={item}>
                          <CheckCircle2 />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-particles"></div>
                </div>
              );
            })}
          </div>

          <div className="country-card">
            <div className="country-card-glow"></div>
            <div className="country-header">
              <h3>{copy.accounting.countryTitle}</h3>
              <p>{copy.accounting.countryDescription}</p>
            </div>
            <div className="country-grid">
              {copy.accounting.countries.map((country, index) => (
                <div key={country.name} className="country-item" data-country={countryIds[index] || 'default'}>
                  <span className="country-flag">{country.flag}</span>
                  <span className="country-name">{country.name}</span>
                  <span className="country-detail">{country.detail}</span>
                </div>
              ))}
            </div>
            <div className="country-stats">
              {copy.accounting.stats.map((stat) => (
                <div key={stat.label} className="country-stat">
                  <span className="country-stat-number">{stat.number}</span>
                  <span className="country-stat-label">{stat.label}</span>
                </div>
              ))}
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
              <span>{copy.simulation.badge}</span>
            </div>
            <h2 className="section-title">{copy.simulation.title}</h2>
            <p className="section-description">{copy.simulation.description}</p>
          </div>

          <div className="simulation-grid">
            {simulationCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="simulation-card">
                  <div className={`sim-icon ${card.className}`}>
                    <Icon />
                  </div>
                  <h4 className="sim-title">{card.title}</h4>
                  <p className="sim-question">{card.question}</p>
                </div>
              );
            })}
          </div>

          <div className="simulation-features-card">
            <h3 className="features-card-title">{copy.simulation.featureTitle}</h3>
            <div className="features-grid">
              {simulationFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className={feature.className}>
                    <div className="feature-icon">
                      <Icon />
                    </div>
                    <div className="feature-content">
                      <h4>{feature.title}</h4>
                      <p>{feature.description}</p>
                    </div>
                  </div>
                );
              })}
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
            <h2 className="section-title">{copy.audience.title}</h2>
            <p className="section-description">{copy.audience.description}</p>
          </div>

          <div className="audience-grid">
            {audienceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="audience-card">
                  <div className="audience-icon">
                    <Icon />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <div className="audience-glow"></div>
                </div>
              );
            })}
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
            <h2 className="section-title">{copy.features.title}</h2>
            <p className="section-description">{copy.features.description}</p>
          </div>

          <div className="features-grid">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="feature-card" data-color={card.color}>
                  <div className="feature-card-icon">
                    <Icon />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {latestCards.length > 0 && (
        <section id="latest" className="section section-features">
          <div className="section-bg">
            <div className="bg-gradient features-gradient"></div>
            <div className="bg-mesh"></div>
          </div>

          <div className="container">
            <div className="section-header">
              <div className="section-badge badge-cyan">
                <Sparkles />
                <span>{copy.latest.badge}</span>
              </div>
              <h2 className="section-title">{copy.latest.title}</h2>
              <p className="section-description">{copy.latest.description}</p>
            </div>

            <div className="features-grid">
              {latestCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="feature-card" data-color={card.color}>
                    <div className="feature-card-icon">
                      <Icon />
                    </div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Pilotage Stratégique Section */}
      <section id="pilotage" className="section section-simulation">
        <div className="section-bg">
          <div className="bg-gradient simulation-gradient"></div>
          <div className="bg-mesh"></div>
        </div>

        <div className="container">
          <div className="section-header">
            <div className="section-badge badge-amber">
              <Target />
              <span>{copy.pilotage.badge}</span>
            </div>
            <h2 className="section-title">{copy.pilotage.title}</h2>
            <p className="section-description">{copy.pilotage.description}</p>
          </div>

          <div className="simulation-grid">
            {pilotageCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="simulation-card">
                  <div className={`sim-icon ${card.className}`}>
                    <Icon />
                  </div>
                  <h4 className="sim-title">{card.title}</h4>
                  <p className="sim-question">{card.description}</p>
                </div>
              );
            })}
          </div>

          <div className="simulation-features-card">
            <h3 className="features-card-title">{copy.pilotage.featureTitle}</h3>
            <div className="features-grid">
              {pilotageFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className={feature.className}>
                    <div className="feature-icon">
                      <Icon />
                    </div>
                    <div className="feature-content">
                      <h4>{feature.title}</h4>
                      <p>{feature.description}</p>
                    </div>
                  </div>
                );
              })}
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
              <span>{copy.mcp.badge}</span>
            </div>
            <h2 className="section-title">{copy.mcp.title}</h2>
            <p className="section-description">{copy.mcp.description}</p>
          </div>

          <div className="mcp-agents-grid">
            {mcpAgents.map((agent) => (
              <div key={agent.name} className="mcp-agent-badge">
                <span className="mcp-agent-icon" style={agent.style}>
                  {agent.iconText}
                </span>
                <span className="mcp-agent-name">{agent.name}</span>
                <span className="mcp-agent-company">{agent.company}</span>
              </div>
            ))}
          </div>

          <div className="mcp-cards">
            {mcpCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="mcp-card">
                  <div className="mcp-card-glow"></div>
                  <div className="mcp-card-icon">
                    <Icon />
                  </div>
                  <h3 className="mcp-card-title">{card.title}</h3>
                  <p className="mcp-card-description">{card.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mcp-example">
            <div className="mcp-example-label">{copy.mcp.exampleLabel}</div>
            <p className="mcp-example-text">{copy.mcp.exampleText}</p>
            <p className="mcp-example-result">
              <CheckCircle2 />
              <span>{copy.mcp.exampleResult}</span>
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
              <span>{copy.peppol.badge}</span>
            </div>
            <h2 className="section-title">{copy.peppol.title}</h2>
            <p className="section-description">{copy.peppol.description}</p>
          </div>

          <div className="peppol-cards">
            {peppolCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="peppol-card">
                  <div className="peppol-card-glow"></div>
                  <div className="peppol-card-icon" style={card.iconStyle}>
                    <Icon />
                  </div>
                  <h3 className="peppol-card-title">{card.title}</h3>
                  <p className="peppol-card-description">{card.description}</p>
                  <span className={card.tagClassName}>{card.tag}</span>
                </div>
              );
            })}
          </div>

          <div className="peppol-infographic">
            <img src="/images/peppol-scrada-guide.jpg" alt={copy.peppol.imageAlt} loading="lazy" />
          </div>

          <div className="peppol-cta">
            <button className="peppol-cta-btn" onClick={() => handleNavigate('/peppol-guide')}>
              <Globe /> {copy.peppol.cta} <ArrowRight />
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
            <h2 className="section-title">{copy.advantages.title}</h2>
            <p className="section-description">{copy.advantages.description}</p>
          </div>

          <div className="advantages-grid">
            {copy.advantages.items.map((item, index) => {
              const Icon = advantageIcons[index] || CheckCircle2;
              return (
                <div key={item} className="advantage-item">
                  <div className="advantage-icon">
                    <Icon />
                  </div>
                  <p>{item}</p>
                  <div className="advantage-check">
                    <CheckCircle2 />
                  </div>
                </div>
              );
            })}
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
            <h2 className="cta-title">{copy.cta.title}</h2>
            <p className="cta-description">{copy.cta.description}</p>
            <div className="cta-buttons">
              <button className="btn btn-cta-primary magnetic-btn" onClick={() => handleNavigate('/login')}>
                <span className="btn-text">{copy.cta.primary}</span>
                <span className="btn-icon">
                  <ArrowRight />
                </span>
                <span className="btn-shine"></span>
              </button>
              <button className="btn btn-cta-secondary magnetic-btn" onClick={() => handleNavigate('/login')}>
                <span className="btn-text">{copy.cta.secondary}</span>
              </button>
            </div>
            <p className="cta-note">{copy.cta.note}</p>
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
              <p className="footer-tagline">{copy.footer.tagline}</p>
              <p className="footer-powered">{copy.footer.powered}</p>
            </div>

            <div className="footer-section">
              <h4>{copy.footer.contactTitle}</h4>
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
              <h4>{copy.footer.linksTitle}</h4>
              <div className="footer-links">
                <a href="#top" onClick={(e) => handleSmoothScroll(e, '#top')}>
                  {copy.footer.links.about}
                </a>
                <a href="#features">{copy.footer.links.features}</a>
                <a
                  href="/pricing"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/pricing');
                  }}
                >
                  {copy.footer.links.pricing}
                </a>
                <a
                  href="/peppol-guide"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/peppol-guide');
                  }}
                >
                  {copy.footer.links.support}
                </a>
                <a
                  href="/status"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/status');
                  }}
                >
                  {copy.footer.links.status}
                </a>
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/privacy');
                  }}
                >
                  {legalLinkLabels.privacy}
                </a>
                <a
                  href="/legal"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/legal');
                  }}
                >
                  {legalLinkLabels.legal}
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new Event('show-cookie-consent'));
                  }}
                >
                  {t('cookies.footerLink')}
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>{copy.footer.rights}</p>
            <p>
              {copy.footer.builtBy}{' '}
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
