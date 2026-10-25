import React, { useState } from 'react';
import {
  Briefcase,
  Lock,
  User,
  Phone,
  FileText,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Tv,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  resellerLogin,
  resellerRegister,
  isValidCpfOrCnpj,
  formatCpfCnpj,
  formatPhone
} from '../../services/resellerService';

export default function ResellerAuth({ initialMode = 'login', onAuthSuccess, onNavigateToTv }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Troca de modo com atualização suave de URL
  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
    const targetPath = newMode === 'register' ? '/revenda/cadastro' : '/revenda/login';
    window.history.pushState({}, '', targetPath);
  };

  const handleCpfCnpjChange = (e) => {
    const formatted = formatCpfCnpj(e.target.value);
    setCpfCnpj(formatted);
  };

  const handleTelefoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setTelefone(formatted);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Informe o CPF/CNPJ e sua senha cadastrada.');
      return;
    }

    setLoading(true);
    try {
      const data = await resellerLogin({
        identifier: loginIdentifier.trim(),
        senha: loginPassword
      });

      // Salva token e usuário
      if (data.token) {
        localStorage.setItem('cinestream_token', data.token);
        localStorage.setItem('cinestream_user', JSON.stringify(data.user));
        if (data.sessionId) localStorage.setItem('cinestream_session_id', data.sessionId);
        window.dispatchEvent(new CustomEvent('cinestream_auth_changed', { detail: { user: data.user } }));
      }

      setSuccessMsg('Login realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    const cleanTel = telefone.replace(/\D/g, '');

    if (!cleanCpf) {
      setErrorMsg('O CPF ou CNPJ é obrigatório.');
      return;
    }

    if (!isValidCpfOrCnpj(cleanCpf)) {
      setErrorMsg('CPF ou CNPJ inválido. Confira se digitou corretamente.');
      return;
    }

    if (!cleanTel || cleanTel.length < 10) {
      setErrorMsg('Informe um número de Telefone/WhatsApp válido com DDD.');
      return;
    }

    if (!senha || senha.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setErrorMsg('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    setLoading(true);
    try {
      const data = await resellerRegister({
        nome: nome.trim(),
        cpfCnpj: cleanCpf,
        telefone: cleanTel,
        senha,
        confirmarSenha
      });

      if (data.token) {
        localStorage.setItem('cinestream_token', data.token);
        localStorage.setItem('cinestream_user', JSON.stringify(data.user));
        if (data.sessionId) localStorage.setItem('cinestream_session_id', data.sessionId);
        window.dispatchEvent(new CustomEvent('cinestream_auth_changed', { detail: { user: data.user } }));
      }

      setSuccessMsg('Cadastro realizado com sucesso! Sua carteira de créditos foi inicializada.');
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(data.user);
      }, 700);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao cadastrar revendedor.');
    } finally {
      setLoading(false);
    }
  };

  const isCpfValid = cpfCnpj.replace(/\D/g, '').length >= 11 && isValidCpfOrCnpj(cpfCnpj);

  return (
    <div className="reseller-portal-container">
      {/* Top Header */}
      <header className="reseller-topbar">
        <div className="reseller-logo">
          <span className="reseller-logo-badge">B2B</span>
          <span className="reseller-logo-text">
            CineStream <span style={{ color: '#f59e0b' }}>Revenda</span>
          </span>
        </div>
      </header>

      {/* Auth Card Center */}
      <div className="reseller-auth-wrapper">
        <div className="reseller-auth-card">
          <div className="reseller-auth-header">
            <div className="reseller-auth-icon">
              <Briefcase size={28} />
            </div>
            <h1 className="reseller-auth-title">
              {mode === 'login' ? 'Portal do Lojista' : 'Criar Conta de Revenda'}
            </h1>
            <p className="reseller-auth-subtitle">
              {mode === 'login'
                ? 'Acesse com seu CPF ou CNPJ para gerenciar clientes e créditos'
                : 'Torne-se um parceiro credenciado e comercialize telas do CineStream'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="reseller-tabs-switch">
            <button
              type="button"
              className={`reseller-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Entrar como Lojista
            </button>
            <button
              type="button"
              className={`reseller-tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Criar Conta B2B
            </button>
          </div>

          {errorMsg && (
            <div className="reseller-alert error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="reseller-alert success">
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form de Login */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>CPF ou CNPJ</span>
                </label>
                <div className="reseller-input-wrapper">
                  <FileText size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Digite seu CPF ou CNPJ"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Senha de Acesso</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Lock size={18} className="reseller-input-icon" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="reseller-input"
                    placeholder="Sua senha cadastrada"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="reseller-input-action"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    title={showLoginPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="reseller-btn-primary" disabled={loading}>
                {loading ? 'Entrando no painel...' : 'Acessar Painel B2B'}
                <ArrowRight size={18} />
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                Novo revendedor?{' '}
                <span
                  style={{ color: '#f59e0b', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => switchMode('register')}
                >
                  Cadastre-se gratuitamente
                </span>
              </div>
            </form>
          ) : (
            /* Form de Cadastro */
            <form onSubmit={handleRegisterSubmit}>
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Nome do Lojista ou Razão Social</span>
                </label>
                <div className="reseller-input-wrapper">
                  <User size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Ex: Eletrônicos Silva ou João Carlos"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>CPF ou CNPJ (Obrigatório)</span>
                  {cpfCnpj && (
                    <span style={{ fontSize: '0.75rem', color: isCpfValid ? '#4ade80' : '#f87171' }}>
                      {isCpfValid ? '✓ Documento válido' : '✗ Inválido'}
                    </span>
                  )}
                </label>
                <div className="reseller-input-wrapper">
                  <FileText size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={cpfCnpj}
                    onChange={handleCpfCnpjChange}
                    maxLength={18}
                    required
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Telefone / WhatsApp Comercial</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Phone size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="(00) 90000-0000"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Senha (mínimo 6 caracteres)</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Lock size={18} className="reseller-input-icon" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    className="reseller-input"
                    placeholder="Crie uma senha segura"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="reseller-input-action"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    title={showRegisterPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Confirmação de Senha</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Lock size={18} className="reseller-input-icon" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    className="reseller-input"
                    placeholder="Repita a senha digitada"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="reseller-btn-primary" disabled={loading}>
                {loading ? 'Cadastrando lojista...' : 'Finalizar Cadastro de Lojista'}
                <ShieldCheck size={18} />
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                Já possui conta cadastrada?{' '}
                <span
                  style={{ color: '#f59e0b', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => switchMode('login')}
                >
                  Fazer login
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
