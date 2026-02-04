import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';
import supabase from '@/lib/customSupabaseClient';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const { t } = useTranslation();
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors = {};
    if (!validateEmail(email)) {
      newErrors.email = t('validation.invalidEmail') || "Invalid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: t('auth.passwordResetEmailSent') || "Email envoyé ✅",
        description: t('auth.checkYourEmail') || "Vérifiez votre boîte mail pour le lien de réinitialisation",
        className: "bg-green-500 border-none text-white"
      });

    } catch (error) {
      console.error('Password reset error:', error);

      setErrors({ submit: error.message || t('auth.passwordResetError') || "Une erreur est survenue" });
      toast({
        title: t('common.error') || "Erreur",
        description: error.message || t('auth.passwordResetError') || "Impossible d'envoyer l'email",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-orange-900/20 to-slate-900 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-4 shadow-lg shadow-orange-500/20"
            >
              <Mail className="w-8 h-8 text-white" />
            </motion.div>

            <h1 className="text-3xl font-bold text-white mb-2">
              {t('auth.forgotPassword') || 'Mot de passe oublié ?'}
            </h1>
            <p className="text-slate-400 text-sm">
              {t('auth.forgotPasswordDescription') || 'Entrez votre email pour recevoir un lien de réinitialisation'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-8"
              >
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {t('auth.emailSent') || 'Email envoyé !'}
                </h3>
                <p className="text-slate-400 mb-6">
                  {t('auth.checkYourInbox') || 'Vérifiez votre boîte mail et suivez les instructions'}
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('auth.backToLogin') || 'Retour à la connexion'}
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    {t('common.email') || 'Email'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth.enterYourEmail') || 'votre@email.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500 ${
                        errors.email ? 'border-red-500' : ''
                      }`}
                      disabled={loading}
                    />
                    {errors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm mt-1 flex items-center gap-1"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {errors.email}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{errors.submit}</p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-300 hover:shadow-orange-500/40 hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('common.loading') || 'Envoi en cours...'}
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      {t('auth.sendResetLink') || 'Envoyer le lien'}
                    </>
                  )}
                </Button>

                {/* Back to Login */}
                <div className="text-center pt-4">
                  <Link
                    to="/login"
                    className="text-sm text-slate-400 hover:text-orange-400 transition-colors inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t('auth.backToLogin') || 'Retour à la connexion'}
                  </Link>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-slate-500 text-sm mt-6"
        >
          © 2026 CashPilot. {t('common.allRightsReserved') || 'Tous droits réservés.'}
        </motion.p>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
