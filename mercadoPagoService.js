import './env.js';
import crypto from 'node:crypto';

// Token de acesso do Mercado Pago obtido estritamente via variável de ambiente (.env)
function getAccessToken() {
  const envToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (envToken && !envToken.includes('TEST-XXXXXXXX') && !envToken.includes('placeholder') && !envToken.includes('seu_token')) {
    return envToken.trim();
  }
  return '';
}

export class MercadoPagoService {
  isMock() {
    const token = getAccessToken();
    return !token || token.length < 20;
  }

  /**
   * Gera uma cobrança Pix real no Mercado Pago
   */
  async criarPagamentoPix(user, plano) {
    const token = getAccessToken();

    if (this.isMock()) {
      throw new Error('Chave do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) não configurada.');
    }

    const url = 'https://api.mercadopago.com/v1/payments';

    const rawName = (user.nome || user.username || 'Cliente Top Canais').trim();
    const nomeParts = rawName.split(' ');
    const firstName = nomeParts[0] || 'Cliente';
    const lastName = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : 'TV';

    // Formata o e-mail do pagador
    let email = user.email ? user.email.trim() : '';
    if (!email || !email.includes('@') || email.endsWith('@oninha.tv') || email.endsWith('@topcanais.tv')) {
      const cleanUser = (user.username || firstName).toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${cleanUser || 'cliente'}@gmail.com`;
    }

    const payer = {
      email,
      first_name: firstName,
      last_name: lastName
    };

    // Adiciona CPF apenas se informado e válido (11 dígitos numéricos)
    if (user.cpf) {
      const cleanCpf = user.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        payer.identification = {
          type: 'CPF',
          number: cleanCpf
        };
      }
    }

    const body = {
      transaction_amount: Number(plano.valor.toFixed(2)),
      description: `Assinatura Top Canais - ${plano.nome}`,
      payment_method_id: 'pix',
      external_reference: String(user.id),
      payer
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Erro na chamada Mercado Pago:', res.status, data);
      throw new Error(`Erro Mercado Pago (${res.status}): ${data.message || JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * Gera uma cobrança Pix para compra de pacote de créditos de revenda
   */
  async criarPagamentoCreditosPix(reseller, planoKey, quantidade, valorTotal) {
    const token = getAccessToken();

    const rawName = (reseller.nome || reseller.username || 'Revendedor CineStream').trim();
    const nomeParts = rawName.split(' ');
    const firstName = nomeParts[0] || 'Lojista';
    const lastName = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : 'Revenda';

    let email = reseller.email ? reseller.email.trim() : '';
    if (!email || !email.includes('@') || email.endsWith('@revenda.cinestream.tv')) {
      const cleanUser = (reseller.username || firstName).toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${cleanUser || 'lojista'}@gmail.com`;
    }

    const payer = {
      email,
      first_name: firstName,
      last_name: lastName
    };

    if (reseller.cpf) {
      const cleanCpf = reseller.cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11 || cleanCpf.length === 14) {
        payer.identification = {
          type: cleanCpf.length === 14 ? 'CNPJ' : 'CPF',
          number: cleanCpf
        };
      }
    }

    if (this.isMock()) {
      throw new Error('Chave do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) não configurada.');
    }

    const url = 'https://api.mercadopago.com/v1/payments';
    const body = {
      transaction_amount: Number(valorTotal.toFixed(2)),
      description: `Créditos Revenda - ${quantidade}x ${planoKey} (CineStream)`,
      payment_method_id: 'pix',
      external_reference: `reseller_order_${reseller.id}_${Date.now()}`,
      payer
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Mercado Pago API retornou erro:', res.status, data);
      const errMsg = data.message || (data.cause && data.cause[0]?.description) || JSON.stringify(data);
      throw new Error(`Erro Mercado Pago (${res.status}): ${errMsg}`);
    }

    return data;
  }

  /**
   * Consulta o status real do pagamento diretamente no Mercado Pago.
   * NUNCA aprova automaticamente sem a confirmação oficial da API.
   */
  async consultarStatusPagamento(mercadoPagoId) {
    if (!mercadoPagoId) {
      return { id: null, status: 'pending' };
    }

    const token = getAccessToken();
    if (this.isMock() || String(mercadoPagoId).startsWith('999')) {
      // Mock antigo: permanece pendente, nunca auto-aprova
      return { id: mercadoPagoId, status: 'pending' };
    }

    const url = `https://api.mercadopago.com/v1/payments/${mercadoPagoId}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`Falha ao consultar pagamento ${mercadoPagoId}:`, err);
      return { id: mercadoPagoId, status: 'pending' };
    }

    return await res.json();
  }
}

export const mercadoPagoService = new MercadoPagoService();
