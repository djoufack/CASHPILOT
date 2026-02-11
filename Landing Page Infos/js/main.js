/* ============================================
   CashPilot Landing Page - Main JavaScript
   Advanced Animations & Interactions
   ============================================ */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    initLucideIcons();
    initCustomCursor();
    initNavigation();
    initScrollAnimations();
    initParticles();
    init3DBackground();
    initMagneticButtons();
    initParallax();
    initCounterAnimations();
    initCardEffects();
});

/* ============================================
   Preloader
   ============================================ */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    
    window.addEventListener('load', () => {
        setTimeout(() => {
            preloader.classList.add('loaded');
            document.body.style.overflow = 'visible';
            
            // Trigger hero animations after preloader
            setTimeout(() => {
                triggerHeroAnimations();
            }, 300);
        }, 1500);
    });
}

/* ============================================
   Lucide Icons Initialization
   ============================================ */
function initLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/* ============================================
   Custom Cursor
   ============================================ */
function initCustomCursor() {
    const cursor = document.querySelector('.cursor-follower');
    const dot = document.querySelector('.cursor-dot');
    
    if (!cursor || !dot) return;
    
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let dotX = 0;
    let dotY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    // Smooth cursor animation
    function animateCursor() {
        // Follower - slower, smoother
        cursorX += (mouseX - cursorX) * 0.1;
        cursorY += (mouseY - cursorY) * 0.1;
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        
        // Dot - faster, more responsive
        dotX += (mouseX - dotX) * 0.3;
        dotY += (mouseY - dotY) * 0.3;
        dot.style.left = dotX + 'px';
        dot.style.top = dotY + 'px';
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();
    
    // Hover effects for interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .feature-card, .audience-card, .simulation-card, .accounting-card, .country-item, .advantage-item');
    
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
        });
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
        });
    });
}

/* ============================================
   Navigation
   ============================================ */
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileMenu = document.getElementById('mobile-menu');
    let lastScroll = 0;
    
    // Scroll behavior
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // Add/remove scrolled class
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Hide/show navbar on scroll
        if (currentScroll > lastScroll && currentScroll > 200) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScroll = currentScroll;
    });
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Mobile menu functions
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : 'visible';
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = 'visible';
}

// Navigate function for buttons
function navigateTo(path) {
    // In a real app, this would use a router
    // For demo purposes, we'll show an alert
    console.log(`Navigating to: ${path}`);
    
    // Create a notification
    showNotification(`Redirection vers ${path === '/signup' ? 'l\'inscription' : 'la connexion'}...`);
    
    // Simulate navigation delay
    setTimeout(() => {
        // window.location.href = path;
    }, 1000);
}

function showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.5s ease forwards;
        box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4);
    `;
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease forwards';
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

/* ============================================
   Hero Animations
   ============================================ */
function triggerHeroAnimations() {
    const animatedElements = document.querySelectorAll('.animate-in');
    
    animatedElements.forEach((el, index) => {
        const delay = parseInt(el.dataset.delay) || index * 100;
        setTimeout(() => {
            el.classList.add('visible');
        }, delay);
    });
}

/* ============================================
   Scroll Animations with GSAP
   ============================================ */
function initScrollAnimations() {
    // Register ScrollTrigger plugin
    gsap.registerPlugin(ScrollTrigger);
    
    // Section headers animation
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
    
    // Country card
    gsap.from('.country-card', {
        opacity: 0,
        scale: 0.9,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.country-card',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        }
    });
    
    // Simulation cards with stagger
    gsap.from('.simulation-card', {
        opacity: 0,
        y: 60,
        stagger: 0.1,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.simulation-grid',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        }
    });
    
    // Audience cards
    gsap.utils.toArray('.audience-card').forEach((card, index) => {
        gsap.from(card, {
            opacity: 0,
            y: 60,
            scale: 0.9,
            duration: 0.7,
            delay: index * 0.1,
            ease: 'back.out(1.7)',
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    });
    
    // Feature cards with 3D effect
    gsap.utils.toArray('.feature-card').forEach((card, index) => {
        gsap.from(card, {
            opacity: 0,
            scale: 0.8,
            rotationY: -20,
            duration: 0.6,
            delay: index * 0.05,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                toggleActions: 'play none none reverse'
            }
        });
    });
    
    // Advantage items with slide effect
    gsap.utils.toArray('.advantage-item').forEach((item, index) => {
        gsap.from(item, {
            opacity: 0,
            x: index % 2 === 0 ? -60 : 60,
            duration: 0.7,
            delay: index * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: item,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    });
    
    // CTA section
    gsap.from('.cta-content', {
        opacity: 0,
        y: 80,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.section-cta',
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        }
    });
    
    // Simulation features card
    gsap.from('.simulation-features-card', {
        opacity: 0,
        y: 60,
        scale: 0.95,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.simulation-features-card',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        }
    });
    
    // Feature items inside simulation card
    gsap.utils.toArray('.feature-item').forEach((item, index) => {
        gsap.from(item, {
            opacity: 0,
            x: -40,
            duration: 0.6,
            delay: index * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: item,
                start: 'top 90%',
                toggleActions: 'play none none reverse'
            }
        });
    });
}

/* ============================================
   Particle Effects
   ============================================ */
function initParticles() {
    // Create particle container for CTA section
    const ctaParticles = document.getElementById('cta-particles');
    if (ctaParticles) {
        createParticles(ctaParticles, 30);
    }
    
    // Create particle container for simulation section
    const simParticles = document.getElementById('simulation-particles');
    if (simParticles) {
        createParticles(simParticles, 20);
    }
}

function createParticles(container, count) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 4 + 2;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * -20;
        const hue = Math.random() > 0.5 ? 
            Math.random() * 60 + 30 : // Yellow/orange
            Math.random() * 60 + 120; // Green/cyan
        
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: hsla(${hue}, 100%, 70%, 0.6);
            border-radius: 50%;
            left: ${x}%;
            top: ${y}%;
            animation: particleFloat ${duration}s linear infinite;
            animation-delay: ${delay}s;
            pointer-events: none;
            filter: blur(1px);
        `;
        
        container.appendChild(particle);
    }
    
    // Add animation keyframes
    if (!document.getElementById('particle-styles')) {
        const style = document.createElement('style');
        style.id = 'particle-styles';
        style.textContent = `
            @keyframes particleFloat {
                0%, 100% {
                    transform: translateY(0) translateX(0) scale(1);
                    opacity: 0;
                }
                10% {
                    opacity: 0.8;
                }
                50% {
                    transform: translateY(-50px) translateX(30px) scale(1.2);
                    opacity: 0.6;
                }
                90% {
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/* ============================================
   3D Background with Three.js
   ============================================ */
function init3DBackground() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || typeof THREE === 'undefined') return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
        canvas,
        alpha: true,
        antialias: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 10;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    // Create material with gradient colors
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Create connecting lines
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
    
    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Animation
    function animate() {
        requestAnimationFrame(animate);
        
        // Rotate particles
        particlesMesh.rotation.x += 0.0003;
        particlesMesh.rotation.y += 0.0005;
        
        // Lines rotation
        linesMesh.rotation.x += 0.0002;
        linesMesh.rotation.y += 0.0003;
        
        // Mouse interaction
        particlesMesh.rotation.x += mouseY * 0.0005;
        particlesMesh.rotation.y += mouseX * 0.0005;
        
        // Color animation
        const time = Date.now() * 0.001;
        const hue = (Math.sin(time * 0.5) + 1) * 0.5 * 60 + 240; // Blue to purple range
        particlesMaterial.color.setHSL(hue / 360, 0.7, 0.6);
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Handle resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

/* ============================================
   Magnetic Buttons
   ============================================ */
function initMagneticButtons() {
    const buttons = document.querySelectorAll('.magnetic-btn');
    
    buttons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            const magnetStrength = 0.3;
            
            gsap.to(button, {
                x: x * magnetStrength,
                y: y * magnetStrength,
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
}

/* ============================================
   Parallax Effects
   ============================================ */
function initParallax() {
    // Parallax for floating shapes
    const shapes = document.querySelectorAll('.floating-shape');
    const orbs = document.querySelectorAll('.orb');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        shapes.forEach((shape, index) => {
            const speed = 0.1 + index * 0.05;
            shape.style.transform = `translateY(${scrolled * speed}px)`;
        });
        
        orbs.forEach((orb, index) => {
            const speed = 0.05 + index * 0.03;
            orb.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
    
    // Parallax on mouse move for hero section
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.addEventListener('mousemove', (e) => {
            const mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
            
            shapes.forEach((shape, index) => {
                const speed = (index + 1) * 10;
                gsap.to(shape, {
                    x: mouseX * speed,
                    y: mouseY * speed,
                    duration: 0.5,
                    ease: 'power2.out'
                });
            });
        });
    }
}

/* ============================================
   Counter Animations
   ============================================ */
function initCounterAnimations() {
    const counters = document.querySelectorAll('.stat-number');
    
    const animateCounter = (counter) => {
        const target = counter.textContent;
        const isPercent = target.includes('%');
        const isSecond = target.includes('s');
        const isCountry = target.includes('Pays');
        
        // For special text values, just animate opacity
        if (target.includes('<') || isCountry) {
            gsap.from(counter, {
                opacity: 0,
                y: 20,
                duration: 1,
                ease: 'power3.out'
            });
            return;
        }
        
        let endValue = parseInt(target.replace(/[^0-9]/g, ''));
        if (isNaN(endValue)) endValue = 100;
        
        const obj = { value: 0 };
        
        gsap.to(obj, {
            value: endValue,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => {
                let displayValue = Math.round(obj.value);
                if (isPercent) displayValue += '%';
                else if (isSecond) displayValue = '< ' + displayValue + 's';
                counter.textContent = displayValue;
            }
        });
    };
    
    // Use Intersection Observer for counters
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => observer.observe(counter));
}

/* ============================================
   Card Effects
   ============================================ */
function initCardEffects() {
    // 3D tilt effect for cards
    const cards = document.querySelectorAll('.accounting-card, .simulation-card, .audience-card, .feature-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        });
    });
    
    // Glow effect following mouse
    const glowCards = document.querySelectorAll('.accounting-card');
    
    glowCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
    
    // Add glow styles
    const style = document.createElement('style');
    style.textContent = `
        .accounting-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(
                circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                rgba(139, 92, 246, 0.15),
                transparent 50%
            );
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            border-radius: inherit;
        }
        
        .accounting-card:hover::after {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
    
    // Country items hover effect
    const countryItems = document.querySelectorAll('.country-item');
    
    countryItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const country = item.dataset.country;
            let color;
            
            switch(country) {
                case 'france':
                    color = 'rgba(59, 130, 246, 0.1)';
                    break;
                case 'belgium':
                    color = 'rgba(239, 68, 68, 0.1)';
                    break;
                case 'ohada':
                    color = 'rgba(16, 185, 129, 0.1)';
                    break;
                default:
                    color = 'rgba(139, 92, 246, 0.1)';
            }
            
            item.style.background = color;
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
    });
}

/* ============================================
   Typing Animation (bonus)
   ============================================ */
function initTypingAnimation() {
    const typingText = document.querySelector('.typing-text');
    if (!typingText) return;
    
    const text = typingText.textContent;
    typingText.textContent = '';
    typingText.style.borderRight = '2px solid var(--accent-purple)';
    
    let i = 0;
    function type() {
        if (i < text.length) {
            typingText.textContent += text.charAt(i);
            i++;
            setTimeout(type, 50);
        } else {
            typingText.style.borderRight = 'none';
        }
    }
    
    setTimeout(type, 1000);
}

/* ============================================
   Intersection Observer for Animations
   ============================================ */
function observeElements() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

/* ============================================
   Smooth Scroll Reveal
   ============================================ */
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    window.addEventListener('scroll', () => {
        reveals.forEach(element => {
            const windowHeight = window.innerHeight;
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    });
}

/* ============================================
   Performance Optimization
   ============================================ */
// Debounce function for resize events
function debounce(func, wait = 20) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit = 16) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        if (!lastRan) {
            func(...args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func(...args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Handle resize with debounce
window.addEventListener('resize', debounce(() => {
    // Reinitialize any dimension-dependent features
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}, 250));

/* ============================================
   Accessibility Features
   ============================================ */
// Reduce motion for users who prefer it
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion.matches) {
    // Disable complex animations
    document.documentElement.style.setProperty('--transition-medium', '0s');
    document.documentElement.style.setProperty('--transition-slow', '0s');
    
    // Stop GSAP animations
    if (typeof gsap !== 'undefined') {
        gsap.globalTimeline.pause();
    }
}

/* ============================================
   Initialize Everything
   ============================================ */
console.log('🚀 CashPilot Landing Page Initialized');

// ============================================================
// AI ASSISTANT SECTION ANIMATIONS
// ============================================================

// Animate AI section on scroll
if (typeof ScrollTrigger !== 'undefined') {
    // AI Badge animation
    gsap.from('.ai-badge', {
        scrollTrigger: {
            trigger: '.section-ai',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out'
    });

    // AI Title animation
    gsap.from('.ai-title span', {
        scrollTrigger: {
            trigger: '.section-ai',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        stagger: 0.2,
        duration: 0.8,
        ease: 'power3.out'
    });

    // Value Banner animation
    gsap.from('.ai-value-banner', {
        scrollTrigger: {
            trigger: '.ai-value-banner',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        scale: 0.9,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.3)'
    });

    // Value items stagger
    gsap.from('.value-item', {
        scrollTrigger: {
            trigger: '.ai-value-banner',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        stagger: 0.15,
        duration: 0.6,
        delay: 0.3,
        ease: 'power2.out'
    });

    // AI Columns animation
    gsap.from('.ai-column', {
        scrollTrigger: {
            trigger: '.ai-content-grid',
            start: 'top 75%',
            toggleActions: 'play none none reverse'
        },
        y: 60,
        opacity: 0,
        stagger: 0.2,
        duration: 0.8,
        ease: 'power3.out'
    });

    // AI Features list animation
    gsap.from('.ai-features-list li', {
        scrollTrigger: {
            trigger: '.ai-features-list',
            start: 'top 85%',
            toggleActions: 'play none none reverse'
        },
        x: -30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.5,
        ease: 'power2.out'
    });

    // Questions grid animation
    gsap.from('.ai-question-card', {
        scrollTrigger: {
            trigger: '.ai-examples',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        scale: 0.9,
        opacity: 0,
        stagger: {
            amount: 0.6,
            from: 'start'
        },
        duration: 0.5,
        ease: 'back.out(1.4)'
    });

    // AI CTA animation
    gsap.from('.ai-cta', {
        scrollTrigger: {
            trigger: '.ai-cta',
            start: 'top 85%',
            toggleActions: 'play none none reverse'
        },
        y: 40,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out'
    });

    // Continuous pulse animation for AI badge
    gsap.to('.ai-badge', {
        scale: 1.05,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
    });

    // Floating animation for AI orbs
    gsap.to('.ai-orb-1', {
        x: 50,
        y: -30,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    gsap.to('.ai-orb-2', {
        x: -60,
        y: 40,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    gsap.to('.ai-orb-3', {
        x: 40,
        y: -50,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    // Hover effects for question cards
    document.querySelectorAll('.ai-question-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            gsap.to(this, {
                scale: 1.05,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', function() {
            gsap.to(this, {
                scale: 1,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // Shimmer effect on AI button
    gsap.to('.btn-ai-primary .btn-shine', {
        x: '200%',
        duration: 2,
        repeat: -1,
        repeatDelay: 3,
        ease: 'power2.inOut'
    });
}

// Add shine element to AI button if it doesn't exist
document.addEventListener('DOMContentLoaded', function() {
    const aiButton = document.querySelector('.btn-ai-primary');
    if (aiButton && !aiButton.querySelector('.btn-shine')) {
        const shine = document.createElement('span');
        shine.className = 'btn-shine';
        aiButton.appendChild(shine);
    }
});

