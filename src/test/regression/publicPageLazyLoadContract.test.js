import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const landingPagePath = path.resolve(process.cwd(), 'src/pages/LandingPage.jsx');
const loginBackgroundPath = path.resolve(process.cwd(), 'src/components/Login3DBackground.jsx');
const loginPagePath = path.resolve(process.cwd(), 'src/pages/LoginPage.jsx');

describe('Public page lazy-load contract', () => {
  const landingPage = fs.readFileSync(landingPagePath, 'utf8');
  const loginBackground = fs.readFileSync(loginBackgroundPath, 'utf8');
  const loginPage = fs.readFileSync(loginPagePath, 'utf8');

  it('loads gsap dynamically on the landing page', () => {
    expect(landingPage).not.toContain("from 'gsap'");
    expect(landingPage).not.toContain('from "gsap"');
    expect(landingPage).not.toContain("from 'gsap/ScrollTrigger'");
    expect(landingPage).toContain("import('gsap')");
    expect(landingPage).toContain("import('gsap/ScrollTrigger')");
  });

  it('loads three dynamically in the login background component', () => {
    expect(loginBackground).not.toContain("from 'three'");
    expect(loginBackground).not.toContain('from "three"');
    expect(loginBackground).toContain("import('three')");
  });

  it('lazy-loads the login background chunk from the login page', () => {
    expect(loginPage).toContain("lazy(() => import('@/components/Login3DBackground'))");
    expect(loginPage).toContain('Suspense');
  });
});
