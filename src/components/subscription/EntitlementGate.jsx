import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getEntitlementLabel, getEntitlementPlanLabel } from '@/utils/subscriptionEntitlements';

const EntitlementGate = ({ featureKey, title, description, children }) => {
  const { loading, hasEntitlement } = useEntitlements();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (hasEntitlement(featureKey)) {
    return children;
  }

  const featureLabel = title || getEntitlementLabel(featureKey);
  const requiredPlan = getEntitlementPlanLabel(featureKey);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-[60vh] bg-gray-950 text-white flex items-center justify-center">
      <Card className="w-full max-w-2xl bg-gray-900 border-gray-800 text-white">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Accès réservé</CardTitle>
            <p className="text-sm text-gray-400">
              {description || `${featureLabel} est disponible à partir du plan ${requiredPlan}.`}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/pricing">
              Voir les tarifs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <Link to="/app/settings?tab=facturation">Gérer l'abonnement</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EntitlementGate;
