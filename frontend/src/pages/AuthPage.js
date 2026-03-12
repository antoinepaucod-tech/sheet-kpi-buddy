import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
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
          description: lang === "fr" ? "Connexion reussie" : "Login successful",
        });
      } else {
        await register(form.email, form.password, form.clubName);
        toast({
          title: lang === "fr" ? "Compte cree !" : "Account created!",
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg-primary)' }}>
      <Toaster />
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display" style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            Transform
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            {lang === "fr" 
              ? "Pilotage financier pour clubs de sport"
              : "Financial management for sports clubs"}
          </p>
        </div>
        
        {/* Auth Card */}
        <div className="tf-card">
          {/* Tab Switcher */}
          <div className="flex mb-6" style={{ background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-1)' }}>
            <button
              onClick={() => setIsLogin(true)}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition-fast)',
                background: isLogin ? 'var(--color-accent)' : 'transparent',
                color: isLogin ? '#fff' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
              data-testid="tab-login"
            >
              {lang === "fr" ? "Connexion" : "Login"}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition-fast)',
                background: !isLogin ? 'var(--color-accent)' : 'transparent',
                color: !isLogin ? '#fff' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
              data-testid="tab-register"
            >
              {lang === "fr" ? "Inscription" : "Register"}
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="tf-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="tf-input w-full"
                placeholder="club@example.com"
                data-testid="input-email"
              />
            </div>
            
            <div>
              <label className="tf-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                {lang === "fr" ? "Mot de passe" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="tf-input w-full"
                  style={{ paddingRight: '40px' }}
                  placeholder="--------"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            {!isLogin && (
              <div>
                <label className="tf-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                  {lang === "fr" ? "Nom du club" : "Club Name"}
                </label>
                <input
                  type="text"
                  value={form.clubName}
                  onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                  className="tf-input w-full"
                  placeholder={lang === "fr" ? "CrossFit Example" : "CrossFit Example"}
                  data-testid="input-club-name"
                />
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="tf-btn-primary w-full flex items-center justify-center gap-2"
              style={{ marginTop: 'var(--space-6)', height: '44px' }}
              data-testid="submit-btn"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn size={16} />
                  {lang === "fr" ? "Se connecter" : "Login"}
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  {lang === "fr" ? "Creer mon compte" : "Create account"}
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="text-center font-mono" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-6)' }}>
          TRANSFORM v2.0
        </p>
      </div>
    </div>
  );
}
