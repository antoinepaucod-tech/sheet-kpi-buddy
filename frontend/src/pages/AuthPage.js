import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { useTranslations } from "../hooks/useTranslations";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { t, lang } = useTranslations();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [form, setForm] = useState({
    email: "",
    password: "",
    clubName: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.email || !form.password) {
      toast({
        title: lang === "fr" ? "Erreur" : "Error",
        description: lang === "fr" ? "Remplissez tous les champs" : "Fill all fields",
        variant: "destructive",
      });
      return;
    }
    
    if (!isLogin && !form.clubName) {
      toast({
        title: lang === "fr" ? "Erreur" : "Error",
        description: lang === "fr" ? "Nom du club requis" : "Club name required",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        toast({
          title: lang === "fr" ? "Bienvenue !" : "Welcome!",
          description: lang === "fr" ? "Connexion réussie" : "Login successful",
        });
      } else {
        await register(form.email, form.password, form.clubName);
        toast({
          title: lang === "fr" ? "Compte créé !" : "Account created!",
          description: lang === "fr" ? "Bienvenue sur Transform" : "Welcome to Transform",
        });
      }
      navigate("/");
    } catch (error) {
      const message = error.response?.data?.detail || 
        (lang === "fr" ? "Une erreur est survenue" : "An error occurred");
      toast({
        title: lang === "fr" ? "Erreur" : "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4">
      <Toaster />
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-5xl font-extrabold text-white uppercase tracking-tight">
            Transform
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {lang === "fr" 
              ? "Pilotage financier pour clubs de sport"
              : "Financial management for sports clubs"}
          </p>
        </div>
        
        {/* Auth Card */}
        <div className="bg-[#121214] border border-white/10 rounded-sm p-6">
          {/* Tab Switcher */}
          <div className="flex mb-6 bg-[#121214] rounded-sm p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-sm transition-colors ${
                isLogin 
                  ? "bg-rose-600 text-white" 
                  : "text-white/50 hover:text-white"
              }`}
              data-testid="tab-login"
            >
              {lang === "fr" ? "Connexion" : "Login"}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-sm transition-colors ${
                !isLogin 
                  ? "bg-rose-600 text-white" 
                  : "text-white/50 hover:text-white"
              }`}
              data-testid="tab-register"
            >
              {lang === "fr" ? "Inscription" : "Register"}
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-[#121214] border-white/10 text-white"
                placeholder="club@example.com"
                data-testid="input-email"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {lang === "fr" ? "Mot de passe" : "Password"}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white pr-10"
                  placeholder="••••••••"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            {!isLogin && (
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">
                  {lang === "fr" ? "Nom du club" : "Club Name"}
                </Label>
                <Input
                  type="text"
                  value={form.clubName}
                  onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white"
                  placeholder={lang === "fr" ? "CrossFit Example" : "CrossFit Example"}
                  data-testid="input-club-name"
                />
              </div>
            )}
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider h-11 mt-6"
              data-testid="submit-btn"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn size={16} className="mr-2" />
                  {lang === "fr" ? "Se connecter" : "Login"}
                </>
              ) : (
                <>
                  <UserPlus size={16} className="mr-2" />
                  {lang === "fr" ? "Créer mon compte" : "Create account"}
                </>
              )}
            </Button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-6 font-mono">
          TRANSFORM v2.0
        </p>
      </div>
    </div>
  );
}
