import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from './db.ts';
import { generateBacenPixPayload } from '../utils/pix.ts';

async function generateQrBase64(pixPayload: string): Promise<string> {
  if (!pixPayload) return '';
  try {
    const dataUrl = await QRCode.toDataURL(pixPayload.trim(), {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
    });
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } catch (err) {
    console.error('Erro ao gerar QR Code Base64:', err);
    return '';
  }
}

function getMpAccessToken(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
}

function getMpPublicKey(): string {
  return process.env.MERCADO_PAGO_PUBLIC_KEY || process.env.VITE_MERCADO_PAGO_PUBLIC_KEY || '';
}

function getAppUrl(): string {
  return process.env.APP_URL || '';
}

let knownCollectorPixKeyMissing = false;
let lastKeyCheckTimestamp = 0;

export function resetCollectorPixKeyCheck(): void {
  knownCollectorPixKeyMissing = false;
  lastKeyCheckTimestamp = 0;
}

export interface MercadoPagoStatus {
  active: boolean;
  configured: boolean;
  isProduction: boolean;
  mode: 'PRODUCAO' | 'SANDBOX';
  publicKeyAvailable: boolean;
  webhookUrl: string;
  maskedToken?: string;
  collectorPixKeyMissing?: boolean;
}

export function getMercadoPagoStatus(): MercadoPagoStatus {
  const token = getMpAccessToken();
  const settings = db.getSettings();
  const configured = Boolean(token);
  const isProduction = token.startsWith('APP_USR-') || settings.mercadoPagoMode === 'PRODUCAO';
  const maskedToken = token ? `${token.slice(0, 10)}...${token.slice(-4)}` : undefined;
  const url = getAppUrl();
  const webhookUrl = url ? `${url.replace(/\/$/, '')}/api/mercadopago/webhook` : '/api/mercadopago/webhook';
  const active = settings.mercadoPagoActive ?? true;

  return {
    active,
    configured,
    isProduction,
    mode: isProduction ? 'PRODUCAO' : 'SANDBOX',
    publicKeyAvailable: Boolean(getMpPublicKey()),
    webhookUrl,
    maskedToken,
    collectorPixKeyMissing: knownCollectorPixKeyMissing,
  };
}

export interface CreatePixParams {
  invoiceId: string;
  amount: number;
  payerEmail: string;
  payerName: string;
  payerCpf?: string;
  description?: string;
}

export interface CreateCardPaymentParams {
  invoiceId: string;
  amount: number;
  token?: string;
  installments: number;
  paymentMethodId: string;
  payerEmail: string;
  payerCpf?: string;
  cardHolderName?: string;
  description?: string;
}

export async function createMercadoPagoPixPayment(params: CreatePixParams) {
  const { invoiceId, amount, payerEmail, payerName, payerCpf, description } = params;
  const cleanCpf = (payerCpf || '12345678909').replace(/\D/g, '');
  const nameParts = (payerName || 'Cliente Campus').trim().split(' ');
  const firstName = nameParts[0] || 'Cliente';
  const lastName = nameParts.slice(1).join(' ') || 'Campus';

  // If live Access Token is provided, call real Mercado Pago API
  const token = getMpAccessToken();
  const url = getAppUrl();

  // If we already know the collector account has no Pix key configured in Mercado Pago,
  // serve the official Bacen Pix payload without making unnecessary failing requests.
  if (token && knownCollectorPixKeyMissing && (Date.now() - lastKeyCheckTimestamp < 10 * 60 * 1000)) {
    const invoice = db.getInvoices().find(i => i.id === invoiceId);
    const settings = db.getSettings();
    const fallbackPix = invoice?.pixCopyPasteCode || generateBacenPixPayload({
      pixKey: settings.pixKey,
      receiverName: settings.pixReceiverName,
      city: settings.pixCity,
      amount,
      txId: invoiceId
    });
    const fallbackBase64 = await generateQrBase64(fallbackPix);

    return {
      success: true,
      isLive: false,
      isCollectorKeyMissing: true,
      collectorNotice: 'Sua conta Mercado Pago ainda não tem Chave Pix habilitada no painel do Mercado Pago.',
      collectorHelp: 'Para gerar cobranças Pix via Mercado Pago, cadastre qualquer Chave Pix (CPF, CNPJ, e-mail ou aleatória) no app do Mercado Pago. Enquanto isso, o QR Code Pix oficial da instituição foi gerado e ativado abaixo para pagamento normal.',
      paymentId: `MP-PIX-FALLBACK-${invoiceId}-${Date.now().toString().slice(-4)}`,
      status: 'pending',
      statusDetail: 'collector_pix_key_missing',
      qrCode: fallbackPix,
      qrCodeBase64: fallbackBase64,
      invoiceId,
      amount,
    };
  }

  if (token) {
    try {
      const webhookUrl = url ? `${url.replace(/\/$/, '')}/api/mercadopago/webhook` : undefined;
      const idempotencyKey = `pix-${invoiceId}-${Date.now()}`;

      const payload: Record<string, any> = {
        transaction_amount: Number(amount.toFixed(2)),
        description: description || `Fatura ${invoiceId} - Lojinha do Campus`,
        payment_method_id: 'pix',
        external_reference: invoiceId,
        payer: {
          email: payerEmail || 'financeiro@campus.edu.br',
          first_name: firstName,
          last_name: lastName,
          identification: {
            type: 'CPF',
            number: cleanCpf || '12345678909',
          },
        },
      };

      if (webhookUrl) {
        payload.notification_url = webhookUrl;
      }

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = String(data?.message || data?.error || '');
        const causes = Array.isArray(data?.cause) ? data.cause : [];
        const isCollectorKeyMissing = 
          errMsg.includes('Collector user without key enabled') || 
          errMsg.includes('key enabled for QR render') ||
          causes.some((c: any) => c.code === 13253 || String(c.description || '').includes('Financial Identity'));

        if (isCollectorKeyMissing) {
          knownCollectorPixKeyMissing = true;
          lastKeyCheckTimestamp = Date.now();
          console.log(`[Mercado Pago] Aviso informativo: conta recebedora do Mercado Pago ainda sem Chave Pix cadastrada. Ativando QR Code Pix oficial da instituição para a fatura ${invoiceId}.`);
        } else {
          console.log(`[Mercado Pago] Resposta de criação Pix: status ${response.status} - ${errMsg || 'Detalhe não especificado'}`);
        }

        const invoice = db.getInvoices().find(i => i.id === invoiceId);
        const settings = db.getSettings();
        const fallbackPix = invoice?.pixCopyPasteCode || generateBacenPixPayload({
          pixKey: settings.pixKey,
          receiverName: settings.pixReceiverName,
          city: settings.pixCity,
          amount,
          txId: invoiceId
        });

        const fallbackBase64 = await generateQrBase64(fallbackPix);

        return {
          success: true,
          isLive: false,
          isCollectorKeyMissing,
          collectorNotice: isCollectorKeyMissing
            ? 'Sua conta Mercado Pago ainda não tem Chave Pix habilitada no painel do Mercado Pago.'
            : `Aviso Mercado Pago: ${errMsg}`,
          collectorHelp: isCollectorKeyMissing
            ? 'Para gerar cobranças Pix via Mercado Pago, cadastre qualquer Chave Pix (CPF, CNPJ, e-mail ou aleatória) no app do Mercado Pago. Enquanto isso, o QR Code Pix oficial da instituição foi gerado e ativado abaixo para pagamento normal.'
            : 'O QR Code Pix oficial da instituição está ativo para prosseguir com o pagamento.',
          paymentId: `MP-PIX-FALLBACK-${invoiceId}-${Date.now().toString().slice(-4)}`,
          status: 'pending',
          statusDetail: isCollectorKeyMissing ? 'collector_pix_key_missing' : 'mp_fallback',
          qrCode: fallbackPix,
          qrCodeBase64: fallbackBase64,
          invoiceId,
          amount,
        };
      }

      const pointOfInteraction = data.point_of_interaction?.transaction_data;
      const qrCode = pointOfInteraction?.qr_code;
      let qrCodeBase64 = pointOfInteraction?.qr_code_base64;
      const ticketUrl = pointOfInteraction?.ticket_url;

      // If Mercado Pago returned qr_code text but not qr_code_base64, generate it locally
      if (!qrCodeBase64 && qrCode) {
        qrCodeBase64 = await generateQrBase64(qrCode);
      }

      return {
        success: true,
        isLive: true,
        paymentId: String(data.id),
        status: data.status,
        statusDetail: data.status_detail,
        qrCode,
        qrCodeBase64,
        ticketUrl,
        invoiceId,
        amount,
        expirationDate: data.date_of_expiration,
      };
    } catch (err: any) {
      console.warn('Falha na requisição Pix do Mercado Pago, ativando fallback resiliente:', err.message);
      const invoice = db.getInvoices().find(i => i.id === invoiceId);
      const settings = db.getSettings();
      const fallbackPix = invoice?.pixCopyPasteCode || generateBacenPixPayload({
        pixKey: settings.pixKey,
        receiverName: settings.pixReceiverName,
        city: settings.pixCity,
        amount,
        txId: invoiceId
      });

      const fallbackBase64 = await generateQrBase64(fallbackPix);

      return {
        success: true,
        isLive: false,
        collectorNotice: `Erro na comunicação com Mercado Pago (${err.message}). QR Code oficial da instituição ativado.`,
        paymentId: `MP-ERR-FALLBACK-${invoiceId}-${Date.now().toString().slice(-4)}`,
        status: 'pending',
        statusDetail: 'network_fallback',
        qrCode: fallbackPix,
        qrCodeBase64: fallbackBase64,
        invoiceId,
        amount,
      };
    }
  }

  // Fallback Simulator when MERCADO_PAGO_ACCESS_TOKEN is not yet set in .env
  const mockId = `MP-${Date.now()}`;
  const settings = db.getSettings();
  const invoice = db.getInvoices().find(i => i.id === invoiceId);
  const mockPixPayload = invoice?.pixCopyPasteCode || generateBacenPixPayload({
    pixKey: settings.pixKey,
    receiverName: settings.pixReceiverName,
    city: settings.pixCity,
    amount,
    txId: invoiceId
  });

  const mockBase64 = await generateQrBase64(mockPixPayload);

  return {
    success: true,
    isLive: false,
    mockNotice: 'Credencial MERCADO_PAGO_ACCESS_TOKEN pendente. Operando em modo de pré-visualização transparente.',
    paymentId: mockId,
    status: 'pending',
    statusDetail: 'waiting_transfer',
    qrCode: mockPixPayload,
    qrCodeBase64: mockBase64,
    invoiceId,
    amount,
  };
}

export async function createMercadoPagoCardPayment(params: CreateCardPaymentParams) {
  const { invoiceId, amount, token, installments, paymentMethodId, payerEmail, payerCpf, description } = params;
  const cleanCpf = (payerCpf || '12345678909').replace(/\D/g, '');

  const accessToken = getMpAccessToken();
  const url = getAppUrl();

  if (accessToken && token) {
    try {
      const webhookUrl = url ? `${url.replace(/\/$/, '')}/api/mercadopago/webhook` : undefined;
      const idempotencyKey = `card-${invoiceId}-${Date.now()}`;

      const payload: Record<string, any> = {
        transaction_amount: Number(amount.toFixed(2)),
        token,
        description: description || `Pagamento Fatura ${invoiceId}`,
        installments: Number(installments) || 1,
        payment_method_id: paymentMethodId || 'master',
        external_reference: invoiceId,
        payer: {
          email: payerEmail || 'financeiro@campus.edu.br',
          identification: {
            type: 'CPF',
            number: cleanCpf,
          },
        },
      };

      if (webhookUrl) {
        payload.notification_url = webhookUrl;
      }

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(`[Mercado Pago Cartão] Resposta ${response.status}: ${data?.message || data?.error || 'Cartão recusado'}`);
        throw new Error(data?.message || data?.error || 'Erro na API do Mercado Pago ao processar cartão.');
      }

      return {
        success: true,
        isLive: true,
        paymentId: String(data.id),
        status: data.status,
        statusDetail: data.status_detail,
        paymentMethodId: data.payment_method_id,
        invoiceId,
        amount,
      };
    } catch (err: any) {
      console.log(`[Mercado Pago Cartão] Falha na transação: ${err.message}`);
      throw err;
    }
  }

  // Simulated transparent card fulfillment
  const mockPaymentId = `MP-CARD-${Date.now()}`;
  return {
    success: true,
    isLive: false,
    mockNotice: 'Credencial MERCADO_PAGO_ACCESS_TOKEN pendente. Simulação de aprovação transparente.',
    paymentId: mockPaymentId,
    status: 'approved',
    statusDetail: 'accredited',
    paymentMethodId: paymentMethodId || 'master',
    invoiceId,
    amount,
  };
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const token = getMpAccessToken();
  if (!token) {
    return null;
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Erro ao consultar pagamento no Mercado Pago:', err);
    return null;
  }
}

export async function handleMercadoPagoWebhookEvent(body: any, query: any, headers?: Record<string, string>) {
  // Webhook payload from Mercado Pago can come in different formats:
  // 1. IPN: query.topic === 'payment' && query.id
  // 2. Webhook v2: body.type === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated', body.data?.id
  const paymentId = 
    body?.data?.id || 
    body?.id || 
    query?.id || 
    (query?.['data.id'] as string) || 
    (query?.topic === 'payment' ? query?.id : null);

  if (!paymentId) {
    return {
      received: true,
      message: 'Notificação recebida sem identificador de pagamento direto.',
    };
  }

  console.log(`[Mercado Pago Webhook] Processando notificação para o pagamento ID: ${paymentId}`);

  let paymentData: any = null;
  const token = getMpAccessToken();
  if (token) {
    paymentData = await fetchMercadoPagoPayment(String(paymentId));
  } else {
    paymentData = {
      id: paymentId,
      status: 'approved',
      external_reference: body?.external_reference || query?.external_reference,
      transaction_amount: body?.transaction_amount || 0,
      payment_type_id: 'bank_transfer',
    };
  }

  if (!paymentData) {
    return { received: true, error: 'Pagamento não encontrado na API do Mercado Pago' };
  }

  const invoiceId = paymentData.external_reference;
  const status = paymentData.status;

  if (invoiceId && status === 'approved') {
    const invoices = db.getInvoices();
    const invoice = invoices.find(i => i.id === invoiceId);

    if (invoice && invoice.status !== 'PAGA') {
      const amountPaid = Number(paymentData.transaction_amount || invoice.remainingBalance);

      // Register payment in Pix/Mercado Pago registry
      const registeredPayment = db.submitPixPayment({
        invoiceId: invoice.id,
        amount: amountPaid,
        transactionReference: `MP-${paymentId}`,
        receiptAttachment: `Comprovante_MercadoPago_${paymentId}.pdf`,
        receiptNotes: `Pagamento aprovado via Webhook Mercado Pago (ID: ${paymentId})`,
        user: {
          id: 'system-mercadopago',
          name: 'Mercado Pago Webhook',
          role: 'ADMIN',
        },
      });

      // Automatically approve and reconcile invoice
      db.reviewPixPayment({
        paymentId: registeredPayment.id,
        decision: 'APROVADO',
        reason: `Conciliação automática confirmada via Webhook Mercado Pago (${paymentData.payment_type_id || 'checkout'})`,
        reviewerUser: {
          id: 'system-mercadopago',
          name: 'Mercado Pago Webhook Automático',
          role: 'ADMIN',
        },
      });

      db.logAudit(
        'system-mercadopago',
        'Mercado Pago Webhook',
        'ADMIN',
        'WEBHOOK_PAGAMENTO_APROVADO',
        'PAGAMENTOS',
        `Fatura ${invoiceId} quitada automaticamente no valor de R$ ${amountPaid.toFixed(2)} via Webhook Mercado Pago (ID: ${paymentId}).`
      );

      console.log(`[Mercado Pago Webhook] Fatura ${invoiceId} conciliada e quitada com sucesso!`);
    }
  }

  return {
    received: true,
    paymentId,
    status: paymentData.status,
    invoiceId,
  };
}
