import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routesPath = path.resolve(process.cwd(), 'src/routes.jsx');
const sidebarPath = path.resolve(process.cwd(), 'src/components/Sidebar.jsx');
const mobileMenuPath = path.resolve(process.cwd(), 'src/components/MobileMenu.jsx');

describe('Navigation and route access contracts', () => {
  const routes = fs.readFileSync(routesPath, 'utf8');
  const sidebar = fs.readFileSync(sidebarPath, 'utf8');
  const mobileMenu = fs.readFileSync(mobileMenuPath, 'utf8');

  it('keeps protected/admin wrappers on critical route groups', () => {
    expect(routes).toMatch(/path="\/app\/onboarding"[\s\S]*?<ProtectedRoute>/);
    expect(routes).toMatch(/path="\/app"[\s\S]*?<ProtectedRoute>/);
    expect(routes).toMatch(/path="\/admin\/\*"[\s\S]*?<AdminRoute>/);
  });

  it('keeps entitlement gates on enterprise-critical premium routes', () => {
    expect(routes).toMatch(
      /path="scenarios"[\s\S]*?EntitlementGate featureKey=\{ENTITLEMENT_KEYS\.SCENARIOS_FINANCIAL\}/
    );
    expect(routes).toMatch(
      /path="scenarios\/:scenarioId"[\s\S]*?EntitlementGate featureKey=\{ENTITLEMENT_KEYS\.SCENARIOS_FINANCIAL\}/
    );
    expect(routes).toMatch(
      /path="analytics"[\s\S]*?EntitlementGate featureKey=\{ENTITLEMENT_KEYS\.ANALYTICS_REPORTS\}/
    );
    expect(routes).toMatch(
      /path="webhooks"[\s\S]*?EntitlementGate featureKey=\{ENTITLEMENT_KEYS\.DEVELOPER_WEBHOOKS\}/
    );
    expect(routes).toMatch(/path="api-mcp"[\s\S]*?EntitlementGate featureKey=\{ENTITLEMENT_KEYS\.DEVELOPER_WEBHOOKS\}/);
  });

  it('keeps menu-level filters for entitlements and OHADA country-specific modules', () => {
    for (const source of [sidebar, mobileMenu]) {
      expect(source).toContain('filterCategorizedNavigation');
      expect(source).toContain('featureKey: ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL');
      expect(source).toContain('OHADA_COUNTRIES');
      expect(source).toContain("path: '/app/syscohada/balance-sheet'");
      expect(source).toContain("path: '/app/syscohada/income-statement'");
      expect(source).toContain("path: '/app/tafire'");
    }
  });
});
