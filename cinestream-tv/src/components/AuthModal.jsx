import React, { useState, useEffect } from 'react';
import { X, Lock, User, Eye, EyeOff, Sparkles, AlertCircle, Phone, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ipTrialInfo, setIpTrialInfo] = useState({ checked: false, canTrial: true, hasUsedTest: false });

  // Checa elegibilidade do IP para o teste de 2 horas
  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/check-ip-trial')
        .then(r => r.json())
        .then(data => {
          setIpTrialInfo({ checked: true, canTrial: data.canTrial, hasUsedTest: data.hasUsedTest });
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Sincroniza o modo e reseta campos sempre que a modal for aberta
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login');
      setErrorMsg('');
      setSenha('');
      setConfirmarSenha('');
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // Formatação automática do telefone brasileiro: (XX) XXXXX-XXXX
  const handleTelefoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 2 && raw.length <= 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    } else if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length > 0) {
      formatted = `(${raw}`;
    }
    setTelefone(formatted);
  };

  // Sanitização do nome de usuário: letras, números, traço, ponto e sublinhado (sem espaços)
  const handleUsernameChange = (e) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    setUsername(clean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();

    if (!cleanUser) {
      setErrorMsg('Por favor, informe seu nome de usuário.');
      return;
    }

    if (mode === 'register') {
      if (cleanUser.length < 3) {
        setErrorMsg('O nome de usuário deve conter no mínimo 3 caracteres.');
        return;
      }

      const digitsOnly = telefone.replace(/\D/g, '');
      if (!digitsOnly || digitsOnly.length < 10) {
        setErrorMsg('Por favor, informe um telefone válido com DDD (ex: (11) 98765-4321).');
        return;
      }

      if (!senha || senha.length < 6) {
        setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
        return;
      }

      if (senha !== confirmarSenha) {
        setErrorMsg('As senhas não coincidem. Digite a mesma senha na confirmação.');
        return;
      }
    } else {
      if (!senha) {
        setErrorMsg('Por favor, informe sua senha.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await loginUser({ username: cleanUser, senha });
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else {
        const data = await registerUser({ 
          username: cleanUser, 
          telefone: telefone.trim(), 
          senha, 
          confirmarSenha 
        });
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ocorreu um erro ao processar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSenha('');
    setConfirmarSenha('');
  };

  const passwordsMatch = confirmarSenha.length > 0 && senha === confirmarSenha;
  const passwordsMismatch = confirmarSenha.length > 0 && senha !== confirmarSenha;

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div 
        className="auth-modal-card glass-card scale-up" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className="auth-logo-badge">
            <Sparkles size={24} className="text-primary pulse-glow" />
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login' 
              ? 'Acesse seus canais, filmes e séries favoritos'
              : 'Cadastro rápido com usuário único e acesso imediato'}
          </p>
        </div>

        {/* Seletor de Modo (Entrar / Criar Conta) */}
        <div className="auth-tabs">
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Entrar
          </button>
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Criar Conta
          </button>
        </div>

        {mode === 'register' && ipTrialInfo.checked && (
          ipTrialInfo.canTrial ? (
            <div className="auth-trial-banner fade-in">
              <Sparkles size={16} className="text-emerald" />
              <span>🎁 <strong>Teste Grátis de 2 Horas</strong> disponível para este dispositivo!</span>
            </div>
          ) : (
            <div className="auth-trial-warn-banner fade-in">
              <AlertCircle size={16} className="text-warning" />
              <span>⚠️ Este IP já utilizou o teste gratuito de 2h. Para assistir, será cobrada assinatura.</span>
            </div>
          )
        )}

        {errorMsg && (
          <div className="auth-error-banner shake">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Campo Nome de Usuário (Único) */}
          <div className="form-group">
            <label className="form-label" htmlFor="auth-username">
              Nome de Usuário {mode === 'register' && <span className="label-unique">(único)</span>}
            </label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input 
                id="auth-username"
                type="text"
                className="auth-input"
                placeholder={mode === 'register' ? 'ex: joaosilva' : 'Seu nome de usuário'}
                value={username}
                onChange={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
            </div>
            {mode === 'register' && (
              <span className="form-helper-text">Identificador exclusivo sem espaços (ex: joao123).</span>
            )}
          </div>

          {/* Campo Telefone / WhatsApp (Apenas no cadastro) */}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-telefone">Telefone / WhatsApp</label>
              <div className="input-with-icon">
                <Phone size={18} className="input-icon" />
                <input 
                  id="auth-telefone"
                  type="tel"
                  className="auth-input"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={handleTelefoneChange}
                  maxLength={15}
                  required
                />
              </div>
            </div>
          )}

          {/* Campo Senha */}
          <div className="form-group">
            <label className="form-label" htmlFor="auth-senha">Senha</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input 
                id="auth-senha"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={mode === 'register' ? 'Mínimo de 6 caracteres' : 'Sua senha'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="btn-toggle-password"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Campo Confirmação de Senha (Apenas no cadastro) */}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-confirm-senha">
                Confirmação de Senha
              </label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  id="auth-confirm-senha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`auth-input ${passwordsMatch ? 'input-success' : ''} ${passwordsMismatch ? 'input-error' : ''}`}
                  placeholder="Repita sua senha"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="btn-toggle-password"
                  onClick={() => setShowConfirmPassword(p => !p)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordsMatch && (
                <span className="password-match-hint success">
                  <CheckCircle2 size={13} /> As senhas coincidem
                </span>
              )}
              {passwordsMismatch && (
                <span className="password-match-hint error">
                  ✕ As senhas não conferem
                </span>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-sm" />
            ) : mode === 'login' ? (
              'Entrar na Plataforma'
            ) : (
              'Cadastrar e Continuar'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' ? (
            <p>
              Ainda não tem conta?{' '}
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => switchMode('register')}
              >
                Cadastre-se agora
              </button>
            </p>
          ) : (
            <p>
              Já possui uma conta?{' '}
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => switchMode('login')}
              >
                Fazer login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
