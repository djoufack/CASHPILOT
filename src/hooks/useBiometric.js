
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useBiometric = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isAvailable = async () => {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  };

  const registerBiometric = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Create random challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "CashPilot", id: window.location.hostname },
        user: {
          id: Uint8Array.from(user.id, c => c.charCodeAt(0)),
          name: user.email,
          displayName: user.email,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform" },
        timeout: 60000,
        attestation: "direct"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      // Save credential ID (In a real app, verify attestation on server)
      // Here we just store the ID to "enable" it for the user
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      
      await supabase.from('biometric_credentials').insert({
        user_id: user.id,
        biometric_type: 'platform', // e.g. TouchID/FaceID
        device_id: navigator.userAgent,
        public_key: credentialId // Simplified for demo
      });

      toast({ title: 'Success', description: 'Biometric login enabled.' });
    } catch (err) {
      console.error("Biometric registration failed", err);
      toast({ title: 'Error', description: 'Failed to register biometric.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return { isAvailable, register: registerBiometric, loading };
};
