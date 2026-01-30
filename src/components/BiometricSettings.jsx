
import React from 'react';
import { useBiometric } from '@/hooks/useBiometric';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BiometricSettings = () => {
  const { isAvailable, register, loading } = useBiometric();
  const [available, setAvailable] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    isAvailable().then(setAvailable);
  }, []);

  const handleRegister = async () => {
    await register();
  };

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="text-purple-500" /> Biometric Authentication
        </CardTitle>
        <CardDescription>
          Use your device's fingerprint or face ID to log in securely.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {available ? (
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 border border-gray-800 rounded bg-gray-800/50">
                <div className="flex items-center gap-3">
                   <ShieldCheck className="text-green-500" />
                   <div>
                      <p className="font-medium text-white">Secure Login</p>
                      <p className="text-sm text-gray-400">Enable faster login with passkeys.</p>
                   </div>
                </div>
                <Button onClick={handleRegister} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                   {loading ? "Registering..." : "Setup Biometric"}
                </Button>
             </div>
             <p className="text-xs text-gray-500 mt-2">
               Note: Biometric data is stored securely on your device and never sent to our servers.
             </p>
          </div>
        ) : (
          <div className="p-4 bg-yellow-900/20 border border-yellow-900/50 rounded text-yellow-500 text-sm">
            Biometric authentication is not available on this device or browser.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BiometricSettings;
