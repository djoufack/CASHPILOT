
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';
import MFAVerifyStep from '@/components/MFAVerifyStep';
import { supabase } from '@/lib/supabase';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signIn } = useAuth(); // Removed connectionStatus, checkConnection
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);

  const demoAccounts = [
    { region: 'FR', flag: '\u{1F1EB}\u{1F1F7}', email: 'pilotage.fr.demo@cashpilot.cloud', password: 'PilotageFR#2026!', labelKey: 'auth.demoRegionFR', tagKey: 'auth.demoTagFR' },
    { region: 'BE', flag: '\u{1F1E7}\u{1F1EA}', email: 'pilotage.be.demo@cashpilot.cloud', password: 'PilotageBE#2026!', labelKey: 'auth.demoRegionBE', tagKey: 'auth.demoTagBE' },
    { region: 'OHADA', flag: '\u{1F30D}', email: 'pilotage.ohada.demo@cashpilot.cloud', password: 'PilotageOHADA#2026!', labelKey: 'auth.demoRegionOHADA', tagKey: 'auth.demoTagOHADA' },
  ];

  const handleDemoLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!validateEmail(email)) newErrors.email = t('validation.invalidEmail') || "Invalid email address";
    if (!password) newErrors.password = t('auth.passwordRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      await signIn(email, password);

      // Check if user has MFA enabled
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = (factorsData?.totp || []).filter(f => f.status === 'verified');

      if (totpFactors.length > 0) {
        // MFA required - show verification step
        setMfaRequired(true);
        setMfaFactorId(totpFactors[0].id);
        setLoading(false);
        return;
      }

      // No MFA - proceed normally
      setSuccess(true);
      toast({
        title: t('mfa.loginSuccess', 'Login successful'),
        description: t('mfa.redirecting', 'Redirecting to dashboard...'),
        className: "bg-green-500 border-none text-white"
      });

      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      let errorMessage = error.message;

      if (error.message.includes('Invalid login credentials') || error.message.includes('AuthApiError')) {
        errorMessage = t('mfa.invalidCredentials', 'Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = t('mfa.emailNotConfirmed', 'Please confirm your email before signing in.');
      } else if (error.message.includes('Network request failed')) {
        errorMessage = t('mfa.networkError', 'Network error. Check your internet connection.');
      } else {
        errorMessage = t('mfa.unexpectedError', 'An unexpected error occurred. Please try again.');
      }
      
      setErrors({ form: errorMessage });
      setLoading(false);
    }
  };

  const handleMFAVerify = async (code) => {
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code
      });
      if (verifyError) throw verifyError;

      setSuccess(true);
      toast({
        title: t('mfa.loginSuccess', 'Login successful'),
        description: t('mfa.redirecting', 'Redirecting to dashboard...'),
        className: "bg-green-500 border-none text-white"
      });

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const handleMFACancel = async () => {
    setMfaRequired(false);
    setMfaFactorId(null);
    // Sign out since we passed password but didn't complete MFA
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/20 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md space-y-6"
      >
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-1">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-yellow-500 via-amber-400 to-lime-500 opacity-50 pointer-events-none" />
          
          <div className="bg-gray-950/90 rounded-xl p-8 relative z-10 h-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gradient mb-2 tracking-tight">
                {t('app.name')}
              </h1>
              <p className="text-gray-400 text-sm">{t('auth.welcomeBack')}</p>
            </div>

            <div className="flex mb-8 relative bg-gray-900/50 rounded-lg p-1">
              <button className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-white">
                {t('auth.signIn')}
                <div className="absolute inset-0 bg-gray-800 rounded-md -z-10 shadow-sm" />
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-gray-400 hover:text-gray-200"
              >
                {t('auth.signUp')}
              </button>
            </div>

            {success ? (
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex flex-col items-center justify-center py-8 space-y-4"
               >
                 <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse" />
                 <h3 className="text-xl font-bold text-white">{t('mfa.loginSuccess', 'Login successful')}</h3>
                 <p className="text-gray-400 text-sm">{t('mfa.redirecting')}</p>
               </motion.div>
            ) : mfaRequired ? (
              <MFAVerifyStep
                onVerify={handleMFAVerify}
                onCancel={handleMFACancel}
                isLoading={loading}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence>
                  {errors.form && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2 overflow-hidden"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{errors.form}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900/50 border-gray-700 text-white focus:border-orange-500"
                    placeholder="name@company.com"
                    disabled={loading}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-gray-300">{t('auth.password')}</Label>
                    <Link to="/forgot-password" className="text-xs text-orange-400 hover:text-orange-300">
                      {t('auth.forgotPassword') || 'Mot de passe oublié?'}
                    </Link>
                  </div>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 text-white pr-10 focus:border-orange-500"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 mt-6"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('auth.loggingIn')}</span>
                    </div>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Demo Accounts Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <span className="text-xs text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {t('auth.demoTitle')}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          </div>

          <p className="text-center text-[11px] text-gray-400 mb-4">
            {t('auth.demoSubtitle')}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {demoAccounts.map((account) => (
              <button
                key={account.region}
                type="button"
                onClick={() => handleDemoLogin(account)}
                className="group relative rounded-xl p-[1px] bg-gradient-to-br from-amber-500/50 via-yellow-500/30 to-purple-600/50 hover:from-amber-400 hover:via-yellow-400 hover:to-purple-500 transition-all duration-300 cursor-pointer"
              >
                <div className="relative rounded-[11px] bg-[#070b14] hover:bg-[#0a0f1a] p-4 h-full transition-colors duration-300">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl leading-none drop-shadow-lg">{account.flag}</span>
                    <span className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
                      {t(account.labelKey)}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400/80 group-hover:text-amber-300 tracking-wider transition-colors">
                      {t(account.tagKey)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
