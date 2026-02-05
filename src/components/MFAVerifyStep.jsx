import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MFAVerifyStep = ({ onVerify, onCancel, isLoading = false }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || 'Code invalide. Veuillez réessayer.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <Shield className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white">Vérification MFA</h3>
        <p className="text-gray-400 text-sm mt-1">
          Entrez le code de votre application d'authentification
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code" className="text-gray-300">
            Code à 6 chiffres
          </Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="bg-gray-900/50 border-gray-700 text-white text-center text-2xl tracking-[0.5em] focus:border-orange-500"
            placeholder="000000"
            autoFocus
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Vérification...</span>
            </div>
          ) : (
            'Vérifier'
          )}
        </Button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-400 hover:text-gray-200 text-sm py-2"
          >
            Annuler
          </button>
        )}
      </form>
    </motion.div>
  );
};

export default MFAVerifyStep;
