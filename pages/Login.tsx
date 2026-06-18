
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';

type LoginView = 'LOGIN' | 'FORGOT_PASSWORD';

interface LoginProps {
  onGuestLogin?: () => void;
}

const Login: React.FC<LoginProps> = ({ onGuestLogin }) => {
  const [currentView, setCurrentView] = useState<LoginView>('LOGIN');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      // Não precisamos chamar nada manual aqui. 
      // O App.tsx detectará a mudança de sessão via onAuthStateChange.
      
    } catch (error: any) {
      setErrorMsg('Email ou senha inválidos.');
      console.error('Erro no login:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/reset-password', 
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      alert('Erro ao enviar email de recuperação: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleBackToLogin = () => {
    setCurrentView('LOGIN');
    setResetSent(false);
    setResetEmail('');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg transition-colors duration-200 px-4">
      <div className="w-full max-w-md bg-white dark:bg-dark-card p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-dark-border animate-in fade-in zoom-in duration-300">
        
        {currentView === 'LOGIN' ? (
          <>
            <div className="text-center mb-8 flex flex-col items-center">
              <Logo className="w-16 h-16 mb-4" textClassName="text-3xl" />
              <p className="text-xl font-semibold text-slate-800 dark:text-white">Bem-vindo de volta!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Faça login para continuar no dashboard.</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1" htmlFor="email">Email</label>
                <div className="relative">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">mail_outline</span>
                  <input
                    type="email"
                    id="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1" htmlFor="password">Senha</label>
                <div className="relative">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">lock_outline</span>
                  <input
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button 
                  type="button"
                  onClick={() => setCurrentView('FORGOT_PASSWORD')} 
                  className="text-sm font-medium text-primary-500 hover:text-primary-600 focus:outline-none"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-lg shadow-primary-500/30 flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-icons-outlined animate-spin text-lg">refresh</span>
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>

              {onGuestLogin && (
                <div className="space-y-4 pt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-100 dark:border-dark-border"></div>
                    <span className="flex-shrink mx-4 text-xs text-slate-400 dark:text-slate-500">ou</span>
                    <div className="flex-grow border-t border-gray-100 dark:border-dark-border"></div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={onGuestLogin}
                    className="w-full bg-slate-50 border border-slate-200/60 hover:bg-slate-100 dark:bg-slate-800 dark:border-dark-border dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex justify-center items-center gap-2 shadow-sm"
                  >
                    <span className="material-icons-outlined text-lg">no_accounts</span>
                    Acessar sem Login (Convidado)
                  </button>
                </div>
              )}
            </form>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-outlined text-3xl text-primary-500">lock_reset</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Recuperar Senha</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {resetSent 
                  ? 'Verifique sua caixa de entrada.' 
                  : 'Digite seu email para receber as instruções de redefinição.'}
              </p>
            </div>

            {resetSent ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                  <span className="material-icons-outlined text-green-600 dark:text-green-400 mt-0.5">check_circle</span>
                  <div>
                    <h4 className="font-semibold text-green-800 dark:text-green-300">Email Enviado!</h4>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      Enviamos um link de recuperação para <strong>{resetEmail}</strong>. Verifique sua pasta de spam se não encontrar.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleBackToLogin}
                  className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1" htmlFor="reset-email">Email Cadastrado</label>
                  <div className="relative">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">email</span>
                    <input
                      type="email"
                      id="reset-email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <span className="animate-spin material-icons-outlined text-xl">refresh</span>
                      Enviando...
                    </>
                  ) : (
                    'Enviar Link de Recuperação'
                  )}
                </button>

                <div className="text-center">
                  <button 
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-icons-outlined text-sm">arrow_back</span>
                    Voltar para Login
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
