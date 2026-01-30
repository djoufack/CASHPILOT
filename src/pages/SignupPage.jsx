
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/use-toast';

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('freelance');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!fullName.trim()) newErrors.fullName = "Full Name is required";
    if (!validateEmail(email)) newErrors.email = "Invalid email address";
    if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      await signUp(email, password, fullName, companyName, role);
      
      setSuccess(true);
      toast({
        title: "Supabase connecté ✅",
        description: "Compte créé ! Redirection...",
        className: "bg-green-500 border-none text-white"
      });
      
      setTimeout(() => {
         navigate('/');
      }, 1500);

    } catch (error) {
      console.error(error);
      let errorMessage = error.message;
      if (error.message.includes('User already registered')) {
        errorMessage = "Email is already registered. Please log in.";
      }
      setErrors({ form: errorMessage });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/20 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-1">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-yellow-500 via-amber-400 to-lime-500 opacity-50 pointer-events-none" />
          
          <div className="bg-gray-950/90 rounded-xl p-8 relative z-10 h-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gradient mb-2 tracking-tight">
                {t('app.name')}
              </h1>
              <p className="text-gray-400 text-sm">Start your journey today</p>
            </div>

            <div className="flex mb-8 relative bg-gray-900/50 rounded-lg p-1">
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-gray-400 hover:text-gray-200"
              >
                Se connecter
              </button>
              <button className="flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 text-white">
                S'inscrire
                <div className="absolute inset-0 bg-gray-800 rounded-md -z-10 shadow-sm" />
              </button>
            </div>

            {success ? (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex flex-col items-center justify-center py-8 space-y-4"
               >
                 <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse" />
                 <h3 className="text-xl font-bold text-white">Supabase connecté ✅</h3>
                 <p className="text-gray-400 text-sm">Inscription réussie, redirection...</p>
               </motion.div>
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
                  <Label htmlFor="fullName" className="text-gray-300">Full Name</Label>
                  <Input 
                    id="fullName" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-gray-900/50 border-gray-700 text-white"
                    placeholder="John Doe"
                  />
                  {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900/50 border-gray-700 text-white"
                    placeholder="name@company.com"
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-300">Password</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 text-white pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                  <Input 
                      id="confirmPassword" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 text-white"
                      placeholder="••••••••"
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 mt-6"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign Up'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
