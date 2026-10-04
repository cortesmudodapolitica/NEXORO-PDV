import React from 'react';
import { CashierStationView } from '../../components/CashierStationView';

interface CaixaModuleProps {
  onBackToApp?: () => void;
  /** V9 PLUS ULTRA 07: abre direto em uma sub-aba (ex.: Placas QR via menu do ícone Caixa) */
  initialTab?: 'mesas' | 'delivery' | 'retirada' | 'movimentacoes' | 'qrcodes';
  onInitialTabConsumed?: () => void;
}

/**
 * MÓDULO 5: CAIXA / FECHAMENTO DE CONTA / SANGRIA / SUPRIMENTO
 * Ambiente financeiro e operacional com controle de turno, divisões de conta, PIX, cartões e emissão de cupom fiscal.
 * V9 PLUS ULTRA 07: Placas QR e ferramentas do Salão acessíveis pelo ícone do Caixa.
 */
export const CaixaModule: React.FC<CaixaModuleProps> = ({ onBackToApp, initialTab, onInitialTabConsumed }) => {
  return (
    // "h-full" apenas — sem min-h-screen (ver correção em CashierStationView).
    <div className="w-full h-full bg-[#07090E]">
      <CashierStationView
        onBackToApp={onBackToApp}
        initialTab={initialTab}
        onInitialTabConsumed={onInitialTabConsumed}
      />
    </div>
  );
};
