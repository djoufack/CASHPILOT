
import React from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  Globe, 
  PieChart, 
  Settings, 
  FileSignature,
  LogOut,
  Briefcase,
  Menu
} from 'lucide-react';
import { motion } from 'framer-motion';

const Navigation = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const handleLogout = () => {
    logout()
      .then(() => {
        navigate('/login');
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      })
      .catch((error) => {
        console.error("Logout failed:", error);
        toast({
          title: "Error",
          description: "Failed to log out. Please try again.",
          variant: "destructive",
        });
      });
  };

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/clients', label: t('nav.clients'), icon: Users },
    { path: '/projects', label: 'Projects', icon: Briefcase },
    { path: '/timesheets', label: t('nav.timesheets'), icon: Clock },
    { path: '/invoices', label: t('nav.invoices'), icon: FileText },
    { path: '/quotes', label: t('nav.quotes'), icon: FileSignature },
    { path: '/analytics', label: t('nav.analytics'), icon: PieChart },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-yellow-600 via-blue-600 to-purple-600 shadow-xl px-4 md:px-6 lg:px-8">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="text-xl md:text-2xl font-bold text-white tracking-tight"
              >
                {t('app.name')}
              </motion.div>
            </Link>

            <div className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link key={item.path} to={item.path}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={`flex items-center space-x-2 h-9 px-3 ${
                          isActive 
                            ? 'bg-white/20 text-white shadow-lg' 
                            : 'text-white/90 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="inline">{item.label}</span>
                      </Button>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={toggleLanguage}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 flex items-center space-x-1"
              >
                <Globe className="w-4 h-4" />
                <span className="font-semibold text-xs hidden sm:inline">
                  {i18n.language.toUpperCase()}
                </span>
              </Button>
            </motion.div>

            <div className="hidden sm:block">
              <Link to="/settings">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <Button 
              onClick={handleLogout}
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10 text-red-200 hover:text-red-100"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            
            {/* Mobile Menu Button - for Navigation only context, usually handled by Sidebar now */}
            <div className="lg:hidden">
               <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="w-5 h-5" />
               </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
