import crypto from 'node:crypto';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';

// QR code em base64 para modo de teste / mock
const MOCK_QR_CODE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAIIAAACCCAIAAAAFYYeqAAADAUlEQVR4nO2WMWIbMRAD/f9PJ006yTGE7ILDHKa1Z0UAzX19HeXXUc5mB9EZEHQGBJ0BQWdA0Bm+JRl777do7/n7b3UGRPbOgMjeGRDZOwMie2dAZJdmePNPAmdjK3Cymyc2npKHk908sfGUPJzs5omNp+ThZDdPbDwlDye7eWLjKXk42c0TG0/Jw8lunth4Sh5OdvPExlPycLKbJzaekoeT3Tyx8ZQ8nOzmiY2n5OFkN09sPCUPJ7t5YuMpeTjZzRMbT8nDyW6e2HhKHk5288TGU/JwspsnNp6Sh5NdOpGMnYSTvTMgsncGRPbOgMjeGRDZOwMi+5sZknjV7P3PQ+kMCDoDgs6AoDMg6Ax/eH1cydMZEHQGBJ0BQWdA0BkQRGeY+k7z7pCtzoCwOgPC6gwIqzMgrM6AsC74YCXXN2YpwlkuK7QzXGwpwlkuK7QzXGwpwlkuK5Q/g/Lcy+obsjoDwuoMCKszIKzOgLA6A8K64IP1FU59U1ZnQFidAWF1BoTVGRBWZ0BYuA/Wh1qKMMVl1XSGx1mKMMVl1XSGx1mKMMVl1fyvMyhcVt+Q1RkQVmdAWJ0BYXUGhNUZENbrX6MoAcj1TVlDdbookU5Vk7SG6nRRIp2qJmkN1emiRDpVTdIaqtNFiXSqmqQ1VKeLEulUNUlrrJqNxz3N6gwIqzMgrM6AsDoDwuoMCOuHEz8I/3CHVsQpy6xPwQvAqSZpmfUpeAE41SQtsz4FLwCnmqRl1qfgBeBUk7TM+hS8AJxqkpZZn8JUgEwRZy2zPoWpSFN3yJZZn8JUpKk7ZMusT2Eq0tQdsmXWpzAVaeoO2TLrU5iKNHWHbJn1KdxVBMH6uD4FWki+9XF9CrSQfOvj+hRoIfnWx/Up0ELyrY/rU6CF5Fsfn/DoVN9ZnQFhdQaE1RkQVmdAWJ0BYb2ZIYkSgFzflDVUp4sS6VQ1SWuoThcl0qlqktZQnS5KpFPVJK2hOl2USKeqSVpDdbookU5Vk7TGqtl43NOszoCwOgPC6gyHrd8djxjTCJp0UwAAAABJRU5ErkJggg==";

export class MercadoPagoService {
  isMock() {
    return !MP_ACCESS_TOKEN || 
      MP_ACCESS_TOKEN.includes('TEST-XXXXXXXX') || 
      MP_ACCESS_TOKEN.includes('placeholder') || 
      MP_ACCESS_TOKEN.trim().length === 0;
  }

  /**
   * Gera uma cobrança Pix no Mercado Pago
   */
  async criarPagamentoPix(user, plano) {
    if (this.isMock()) {
      console.log('⚠️ MERCADOPAGO_ACCESS_TOKEN não configurado. Gerando Pix Mock para testes.');
      const mockId = '999' + Math.floor(Date.now() / 1000);
      return {
        id: mockId,
        status: 'pending',
        point_of_interaction: {
          transaction_data: {
            qr_code: `00020101021226870014br.gov.bcb.pix2565pix.mercadopago.com/transfer/receiver/f2f/TEST-PIX-MOCK-ONINHA-${user.id}`,
            qr_code_base64: MOCK_QR_CODE_BASE64
          }
        }
      };
    }

    const url = 'https://api.mercadopago.com/v1/payments';

    const nomeParts = (user.nome || 'Cliente Oninha').trim().split(' ');
    const firstName = nomeParts[0] || 'Cliente';
    const lastName = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : firstName;

    const email = user.email || `${firstName.toLowerCase()}@cliente.oninha.tv`;
    const cpf = user.cpf ? user.cpf.replace(/\D/g, '') : '12345678909';

    const body = {
      transaction_amount: Number(plano.valor.toFixed(2)),
      description: `Assinatura Oninha TV - ${plano.nome}`,
      payment_method_id: 'pix',
      external_reference: user.id,
      payer: {
        email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: 'CPF',
          number: cpf
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Erro Mercado Pago (${res.status}): ${JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * Consulta o status de um pagamento no Mercado Pago
   */
  async consultarStatusPagamento(mercadoPagoId) {
    // Se for Pix mock
    if (mercadoPagoId && String(mercadoPagoId).startsWith('999')) {
      // Simula que após 10 segundos da criação o mock é aprovado para facilitar testes
      const createdTimestamp = parseInt(String(mercadoPagoId).slice(3), 10);
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const isApproved = (nowTimestamp - createdTimestamp) > 10;
      return {
        id: mercadoPagoId,
        status: isApproved ? 'approved' : 'pending'
      };
    }

    if (this.isMock()) {
      return { id: mercadoPagoId, status: 'pending' };
    }

    const url = `https://api.mercadopago.com/v1/payments/${mercadoPagoId}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Falha ao consultar pagamento ${mercadoPagoId}: ${err}`);
    }

    return await res.json();
  }
}

export const mercadoPagoService = new MercadoPagoService();
