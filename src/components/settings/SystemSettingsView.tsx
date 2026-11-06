import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  AlertCircle,
  Calendar, 
  Clock, 
  QrCode, 
  ShieldCheck, 
  Store,
  Layers,
  Database,
  CreditCard,
  Link2,
  Copy,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  FileCode
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface SystemSettingsViewProps {
  settings: SystemSettings | null;
  onSettingsSaved: (settings: SystemSettings) => void;
  onResetData: () => void;
}

export function SystemSettingsView({ 
  settings, 
  onSettingsSaved, 
  onResetData 
}: SystemSettingsViewProps) {
  const { user, isAdmin } = useAuth();

  const [formData, setFormData] = useState<Partial<SystemSettings>>({
    institutionName: settings?.institutionName || 'Campus University School',
    storeName: settings?.storeName || 'Lojinha do Campus',
    cnpj: settings?.cnpj || '18.423.891/0001-44',
    closingDay: settings?.closingDay || 'LAST_DAY',
    closingHour: settings?.closingHour || '23:59',
    dueDayOffset: settings?.dueDayOffset || 10,
    allowDirectCashPayment: settings?.allowDirectCashPayment ?? false,
    stockControlActive: settings?.stockControlActive ?? true,
    blockSaleWithoutStock: settings?.blockSaleWithoutStock ?? true,
    pixKey: settings?.pixKey || 'financeiro@campus.edu.br',
    pixKeyType: settings?.pixKeyType || 'EMAIL',
    pixReceiverName: settings?.pixReceiverName || 'CAMPUS EDUCACIONAL',
    pixCity: settings?.pixCity || 'SAO PAULO',
    whatsappAutoEnabled: settings?.whatsappAutoEnabled ?? true,
    mercadoPagoActive: settings?.mercadoPagoActive ?? true,
    mercadoPagoMode: settings?.mercadoPagoMode || 'PRODUCAO',
    supabaseActive: settings?.supabaseActive ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [mpStatus, setMpStatus] = useState<{
    configured: boolean;
    isProduction: boolean;
    publicKeyAvailable: boolean;
    webhookUrl: string;
    maskedToken?: string;
  } | null>(null);

  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    urlProvided: boolean;
    keyProvided: boolean;
    maskedUrl?: string;
    connected?: boolean;
    error?: string;
  } | null>(null);

  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    loadIntegrationsStatus();
  }, []);

  const loadIntegrationsStatus = async () => {
    try {
      const [mp, sb] = await Promise.all([
        api.getMercadoPagoStatus().catch(() => null),
        api.getSupabaseStatus().catch(() => null)
      ]);
      setMpStatus(mp);
      setSupabaseStatus(sb);
    } catch (e) {
      // ignore
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    try {
      const res = await api.getSupabaseStatus();
      setSupabaseStatus(res);
      if (res.connected) {
        alert('Conexão com o Supabase testada com sucesso!');
      } else {
        alert(`Status: ${res.error || 'Aguardando configuração de SUPABASE_URL e SUPABASE_ANON_KEY no painel de Secrets / .env'}`);
      }
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await api.updateSettings(formData);
      onSettingsSaved(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Atenção: Deseja restaurar todos os dados para o estado semente inicial? Isso reiniciará o estoque, as vendas e as faturas de teste.')) {
      return;
    }

    setIsResetting(true);
    try {
      await api.resetData();
      onResetData();
      alert('Dados restaurados com sucesso para os valores padrão de teste!');
    } catch (err: any) {
      alert(`Erro ao resetar: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-[#1B1B1B] rounded-2xl p-6 border border-[#282828] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#8B7CFF]" />
            <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">
              Configurações Operacionais da Lojinha
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Parâmetros globais: dia de corte do faturamento, vencimento de faturas, chave Pix e regras de estoque.
          </p>
        </div>

        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            Configurações Salvas
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* 1. Identificação da Loja & Instituição */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#242424] pb-3">
            <Store className="w-4 h-4 text-[#8B7CFF]" />
            <h3 className="font-semibold text-[#F5F5F5] text-sm">
              1. Identificação da Loja e Instituição
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Nome da Lojinha</label>
              <input
                type="text"
                value={formData.storeName || ''}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Instituição de Ensino / Campus</label>
              <input
                type="text"
                value={formData.institutionName || ''}
                onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Fechamento Mensal e Vencimento */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#242424] pb-3">
            <Calendar className="w-4 h-4 text-[#8B7CFF]" />
            <h3 className="font-semibold text-[#F5F5F5] text-sm">
              2. Fechamento Mensal & Vencimento de Faturas
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Dia do Fechamento Mensal</label>
              <select
                value={formData.closingDay}
                onChange={(e) => setFormData({ ...formData, closingDay: e.target.value as any })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
              >
                <option value="LAST_DAY">Último dia de cada mês (Padrão)</option>
                <option value="25">Dia 25 de cada mês</option>
                <option value="28">Dia 28 de cada mês</option>
              </select>
              <p className="text-[10px] text-[#A1A1AA] mt-1">Consolida consumo e lançamentos até esta data.</p>
            </div>

            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Horário de Fechamento</label>
              <input
                type="text"
                value={formData.closingHour || '23:59'}
                onChange={(e) => setFormData({ ...formData, closingHour: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] font-mono focus:border-[#8B7CFF] focus:outline-none"
              />
              <p className="text-[10px] text-[#A1A1AA] mt-1">Horário limite do corte mensal.</p>
            </div>

            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Dia de Vencimento no Mês Subsequente</label>
              <input
                type="number"
                min="1"
                max="28"
                value={formData.dueDayOffset ?? 10}
                onChange={(e) => setFormData({ ...formData, dueDayOffset: parseInt(e.target.value, 10) || 10 })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] font-bold focus:border-[#8B7CFF] focus:outline-none"
              />
              <p className="text-[10px] text-[#A1A1AA] mt-1">Ex: Dia 10 (respeita calendário e meses menores).</p>
            </div>
          </div>
        </div>

        {/* 3. Regras de Consumo e Estoque */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#242424] pb-3">
            <Store className="w-4 h-4 text-[#8B7CFF]" />
            <h3 className="font-semibold text-[#F5F5F5] text-sm">
              3. Regras do Caixa e Controle de Estoque
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-[#151515] rounded-xl border border-[#282828]">
              <div>
                <span className="font-semibold text-[#F5F5F5] block">Consumo da Lojinha na Conta Mensal</span>
                <span className="text-[#A1A1AA] text-[11px]">
                  Toda venda para aluno no balcão entra diretamente na fatura mensal, sem exigir pagamento no ato.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40">
                Ativo Obrigatório
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#151515] rounded-xl border border-[#282828]">
              <div>
                <span className="font-semibold text-[#F5F5F5] block">Controle de Estoque Automático</span>
                <span className="text-[#A1A1AA] text-[11px]">
                  Vendas no PDV reduzem instantaneamente o estoque com geração de movimentação auditada.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.stockControlActive}
                  onChange={(e) => setFormData({ ...formData, stockControlActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[#282828] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B7CFF]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#151515] rounded-xl border border-[#282828]">
              <div>
                <span className="font-semibold text-[#F5F5F5] block">Bloqueio de Venda Sem Estoque</span>
                <span className="text-[#A1A1AA] text-[11px]">
                  Impede que produtos esgotados (estoque 0) sejam adicionados ao carrinho no caixa.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.blockSaleWithoutStock}
                  onChange={(e) => setFormData({ ...formData, blockSaleWithoutStock: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[#282828] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B7CFF]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 4. Dados Pix da Instituição */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#242424] pb-3">
            <QrCode className="w-4 h-4 text-[#8B7CFF]" />
            <h3 className="font-semibold text-[#F5F5F5] text-sm">
              4. Dados de Recebimento Pix
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Chave Pix Oficial da Instituição</label>
              <input
                type="text"
                value={formData.pixKey || ''}
                onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] font-mono focus:border-[#8B7CFF] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Nome do Favorecido (Razão Social)</label>
              <input
                type="text"
                value={formData.pixReceiverName || ''}
                onChange={(e) => setFormData({ ...formData, pixReceiverName: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">Cidade da Conta</label>
              <input
                type="text"
                value={formData.pixCity || ''}
                onChange={(e) => setFormData({ ...formData, pixCity: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-[#F5F5F5] mb-1">CNPJ da Instituição</label>
              <input
                type="text"
                value={formData.cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full p-2.5 bg-[#151515] border border-[#303030] rounded-xl font-mono text-[#F5F5F5] focus:border-[#8B7CFF] focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* 5. Gateway Mercado Pago (Checkout Transparente & Webhooks) */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242424] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#009EE3]/20 text-[#009EE3] flex items-center justify-center font-bold text-xs">
                MP
              </div>
              <div>
                <h3 className="font-semibold text-[#F5F5F5] text-sm">
                  5. Mercado Pago — Checkout Transparente & Webhook
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Processamento de Pix instantâneo, Cartão de Crédito e reconciliação automática
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mpStatus?.configured ? (
                <span className={`text-[11px] px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 ${
                  mpStatus.isProduction
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {mpStatus.isProduction ? 'Produção Ativa' : 'Ambiente Sandbox / Testes'}
                </span>
              ) : (
                <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Aguardando Access Token (.env)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Status & Credential Detection */}
            <div className="p-3.5 bg-[#151515] rounded-xl border border-[#2A2A2A] space-y-2">
              <span className="text-[#A1A1AA] text-[11px] block font-medium">Credencial de Produção (Access Token)</span>
              <div className="font-mono text-[#F5F5F5] bg-[#1E1E1E] p-2.5 rounded-lg border border-[#303030] flex items-center justify-between">
                <span>{mpStatus?.maskedToken || 'MERCADO_PAGO_ACCESS_TOKEN não detectado'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${mpStatus?.configured ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  {mpStatus?.configured ? 'OK' : 'PENDENTE'}
                </span>
              </div>
              <p className="text-[10px] text-[#808080]">
                Configure no painel de Segredos (Secrets) do AI Studio ou arquivo <code className="text-[#8B7CFF]">.env</code> com a chave <code className="text-white">APP_USR-...</code>
              </p>
              <div className="pt-1 text-[10px] text-amber-300/90 bg-amber-950/20 p-2 rounded-lg border border-amber-500/20 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Dica para Pix:</strong> Cadastre uma Chave Pix no app do Mercado Pago da conta titular desta chave para autorizar QR Code direto.
                </span>
              </div>
            </div>

            {/* Webhook Endpoint */}
            <div className="p-3.5 bg-[#151515] rounded-xl border border-[#2A2A2A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#A1A1AA] text-[11px] font-medium">URL do Webhook Mercado Pago</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Endpoint Ativo
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={mpStatus?.webhookUrl ? (mpStatus.webhookUrl.startsWith('http') ? mpStatus.webhookUrl : `${window.location.origin}${mpStatus.webhookUrl}`) : `${window.location.origin}/api/mercadopago/webhook`}
                  className="w-full p-2 text-[10px] font-mono bg-[#1E1E1E] border border-[#303030] rounded-lg text-[#F5F5F5] select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = mpStatus?.webhookUrl ? (mpStatus.webhookUrl.startsWith('http') ? mpStatus.webhookUrl : `${window.location.origin}${mpStatus.webhookUrl}`) : `${window.location.origin}/api/mercadopago/webhook`;
                    navigator.clipboard.writeText(url);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-[#009EE3] hover:bg-[#008CC9] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedWebhook ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-[#808080]">
                Cadastre esta URL em: <em>Mercado Pago Developers &gt; Suas Aplicações &gt; Webhooks &gt; Notificações de Pagamentos (IPN / Webhooks)</em>.
              </p>
            </div>

            {/* Activation and Mode Row */}
            <div className="col-span-1 md:col-span-2 p-3.5 bg-[#151515] rounded-xl border border-[#2A2A2A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.mercadoPagoActive ?? true}
                    onChange={(e) => setFormData({ ...formData, mercadoPagoActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-[#282828] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009EE3]"></div>
                </label>
                <div>
                  <span className="font-semibold text-white text-xs block">
                    Integração Mercado Pago {formData.mercadoPagoActive ? 'ATIVA' : 'DESATIVADA'}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Habilita o Checkout Transparente nos portais para pagamento imediato
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium">Ambiente:</span>
                <select
                  value={formData.mercadoPagoMode || 'PRODUCAO'}
                  onChange={(e) => setFormData({ ...formData, mercadoPagoMode: e.target.value as any })}
                  className="p-1.5 bg-[#1E1E1E] border border-[#303030] rounded-lg text-white text-xs font-semibold focus:border-[#009EE3] focus:outline-none"
                >
                  <option value="PRODUCAO">Produção (Ativo Oficial)</option>
                  <option value="SANDBOX">Sandbox (Testes)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Banco de Dados Supabase (PostgreSQL Externo) */}
        <div className="bg-[#1B1B1B] rounded-2xl border border-[#282828] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242424] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F5F5F5] text-sm">
                  6. Banco de Dados Supabase (PostgreSQL)
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Conexão com PostgreSQL, Realtime e sincronização de dados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {supabaseStatus?.connected ? (
                <span className="text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Conectado ao Supabase
                </span>
              ) : (
                <span className="text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5">
                  {supabaseStatus?.urlProvided ? 'Chave Incompleta' : 'Aguardando Credenciais'}
                </span>
              )}

              <button
                type="button"
                disabled={isTestingSupabase}
                onClick={handleTestSupabase}
                className="px-3 py-1 bg-[#282828] hover:bg-[#323232] text-[#F5F5F5] rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin text-[#8B7CFF]' : ''}`} />
                Testar Conexão
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Activation Row */}
            <div className="p-3.5 bg-[#151515] rounded-xl border border-[#2A2A2A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supabaseActive ?? true}
                    onChange={(e) => setFormData({ ...formData, supabaseActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-[#282828] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
                <div>
                  <span className="font-semibold text-white text-xs block">
                    Conexão e Sincronização Supabase {formData.supabaseActive ? 'ATIVA' : 'DESATIVADA'}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Habilita o envio e persistência no banco de dados relacional PostgreSQL
                  </span>
                </div>
              </div>
            </div>

            {/* Supabase Environment Variables Summary */}
            <div className="p-4 bg-[#151515] rounded-xl border border-[#2A2A2A] space-y-2.5">
              <span className="font-semibold text-[#F5F5F5] block text-xs">
                Variáveis de Conexão Necessárias (.env / Secrets Panel):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
                <div className="p-2.5 bg-[#1E1E1E] rounded-lg border border-[#303030]">
                  <span className="text-[#A1A1AA] block text-[10px]">SUPABASE_URL</span>
                  <span className="text-white font-semibold truncate block">
                    {supabaseStatus?.maskedUrl || 'https://seu-id.supabase.co'}
                  </span>
                </div>
                <div className="p-2.5 bg-[#1E1E1E] rounded-lg border border-[#303030]">
                  <span className="text-[#A1A1AA] block text-[10px]">SUPABASE_ANON_KEY</span>
                  <span className="text-white font-semibold truncate block">
                    {supabaseStatus?.keyProvided ? '••••••••••••••••' : 'Não configurada'}
                  </span>
                </div>
                <div className="p-2.5 bg-[#1E1E1E] rounded-lg border border-[#303030]">
                  <span className="text-[#A1A1AA] block text-[10px]">SUPABASE_SERVICE_ROLE_KEY</span>
                  <span className="text-white font-semibold truncate block">
                    {supabaseStatus?.keyProvided ? '••••••••••••••••' : 'Opcional (Server Admin)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Supabase Schema Script helper */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-950/30 to-[#151515] rounded-xl border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                  <FileCode className="w-4 h-4" />
                  <span>Script SQL das Tabelas (supabase_schema.sql)</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Arquivo completo pronto com todas as 12 tabelas (alunos, responsáveis, produtos, estoque, faturas, pagamentos, auditoria).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  fetch('/supabase_schema.sql')
                    .then(res => res.text())
                    .then(sql => {
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    })
                    .catch(() => alert('Script gerado na raiz do projeto como supabase_schema.sql'));
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-sm"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'SQL Copiado!' : 'Copiar Script SQL'}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {isAdmin && (
            <button
              type="button"
              disabled={isResetting}
              onClick={handleReset}
              className="px-4 py-2.5 bg-[#222222] border border-[#303030] text-red-400 hover:bg-[#2A2A2A] rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Dados Iniciais de Teste
            </button>
          )}

          {isAdmin && (
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#8B7CFF] hover:bg-[#7A6AE6] text-white rounded-xl text-xs font-semibold transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>

      </form>

    </div>
  );
}
