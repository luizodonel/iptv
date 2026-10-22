import React, { useState } from 'react';
import { X, Mail, Lock, User, ShieldCheck, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cpf, setCpf] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await loginUser({ email, senha });
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else {
        const data = await registerUser({ nome, email, senha, cpf });
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
  };

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
              : 'Assista em até 2 telas simultâneas com qualidade máxima'}
          </p>
        </div>

        {/* Tab Selector */}
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

        {errorMsg && (
          <div className="auth-error-banner shake">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-nome">Nome Completo</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  id="auth-nome"
                  type="text"
                  className="auth-input"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">E-mail</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input 
                id="auth-email"
                type="email"
                className="auth-input"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-senha">Senha</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input 
                id="auth-senha"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Mínimo de 6 caracteres"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="btn-toggle-password"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-cpf">
                CPF <span className="label-optional">(opcional para agilizar Pix)</span>
              </label>
              <div className="input-with-icon">
                <ShieldCheck size={18} className="input-icon" />
                <input 
                  id="auth-cpf"
                  type="text"
                  className="auth-input"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                />
              </div>
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
