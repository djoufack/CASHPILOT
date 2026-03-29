import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, Banknote, Plus, ArrowLeftRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { usePaymentInstruments } from '@/hooks/usePaymentInstruments';
import { InstrumentsList } from '@/components/financial-instruments/InstrumentsList';
import { BankAccountForm } from '@/components/financial-instruments/BankAccountForm';
import { CardGrid } from '@/components/financial-instruments/CardGrid';
import { CardForm } from '@/components/financial-instruments/CardForm';
import { CashRegisterPanel } from '@/components/financial-instruments/CashRegisterPanel';
import { CashForm } from '@/components/financial-instruments/CashForm';
import { TransferDialog } from '@/components/financial-instruments/TransferDialog';
import { InstrumentStatsPanel } from '@/components/financial-instruments/InstrumentStatsPanel';

const FinancialInstrumentsPage = () => {
  const { t } = useTranslation();
  const { instruments, loading, fetchInstruments, createInstrument, updateInstrument, deleteInstrument } = usePaymentInstruments();

  const [activeTab, setActiveTab] = useState('bank_accounts');
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);

  useEffect(() => {
    fetchInstruments();
  }, [fetchInstruments]);

  const bankAccounts = useMemo(
    () => instruments.filter((i) => i.instrument_type === 'bank_account'),
    [instruments],
  );
  const cards = useMemo(
    () => instruments.filter((i) => i.instrument_type === 'card'),
    [instruments],
  );
  const cashRegisters = useMemo(
    () => instruments.filter((i) => i.instrument_type === 'cash'),
    [instruments],
  );

  const handleAdd = () => {
    setEditingInstrument(null);
    if (activeTab === 'bank_accounts') setBankFormOpen(true);
    else if (activeTab === 'cards') setCardFormOpen(true);
    else if (activeTab === 'cash') setCashFormOpen(true);
  };

  const handleEdit = (instrument) => {
    setEditingInstrument(instrument);
    if (instrument.instrument_type === 'bank_account') setBankFormOpen(true);
    else if (instrument.instrument_type === 'card') setCardFormOpen(true);
    else if (instrument.instrument_type === 'cash') setCashFormOpen(true);
  };

  const handleBankSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'bank_account' });
    }
    setBankFormOpen(false);
    setEditingInstrument(null);
  };

  const handleCardSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'card' });
    }
    setCardFormOpen(false);
    setEditingInstrument(null);
  };

  const handleCashSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'cash' });
    }
    setCashFormOpen(false);
    setEditingInstrument(null);
  };

  const handleTransferSubmit = async (transferData) => {
    // Transfer is a debit on source + credit on destination via createInstrument-level logic
    // For now we delegate to the hook's transfer method or handle inline
    setTransferOpen(false);
  };

  const handleDelete = async (instrument) => {
    if (window.confirm(t('financialInstruments.confirmDelete', { label: instrument.label }))) {
      await deleteInstrument(instrument.id);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('financialInstruments.title', 'Instruments financiers')} - CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wallet className="h-7 w-7 text-amber-500" />
                {t('financialInstruments.title', 'Instruments financiers')}
              </h1>
              <p className="text-gray-400 mt-1 text-sm">
                {t('financialInstruments.subtitle', 'Gerez vos comptes bancaires, cartes et caisses')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                {t('financialInstruments.transfer', 'Virement')}
              </Button>
              {activeTab !== 'stats' && (
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                  onClick={handleAdd}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add', 'Ajouter')}
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-[#0f1528] border border-gray-800/50 mb-6">
              <TabsTrigger
                value="bank_accounts"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <Wallet className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.bankAccounts', 'Comptes bancaires')}
              </TabsTrigger>
              <TabsTrigger
                value="cards"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.cards', 'Cartes')}
              </TabsTrigger>
              <TabsTrigger
                value="cash"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <Banknote className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.cash', 'Caisses')}
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                {t('financialInstruments.tabs.stats', 'Statistiques')}
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                <TabsContent value="bank_accounts">
                  <InstrumentsList
                    instruments={bankAccounts}
                    type="bank_account"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </TabsContent>

                <TabsContent value="cards">
                  <CardGrid
                    cards={cards}
                    onEdit={handleEdit}
                    onAdd={() => {
                      setEditingInstrument(null);
                      setCardFormOpen(true);
                    }}
                  />
                </TabsContent>

                <TabsContent value="cash">
                  <CashRegisterPanel
                    instruments={cashRegisters}
                    onEdit={handleEdit}
                    onAdd={() => {
                      setEditingInstrument(null);
                      setCashFormOpen(true);
                    }}
                  />
                </TabsContent>

                <TabsContent value="stats">
                  <InstrumentStatsPanel instruments={instruments} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </motion.div>

        {/* Dialogs */}
        <BankAccountForm
          open={bankFormOpen}
          onOpenChange={setBankFormOpen}
          instrument={editingInstrument}
          onSubmit={handleBankSubmit}
        />

        <CardForm
          open={cardFormOpen}
          onOpenChange={setCardFormOpen}
          instrument={editingInstrument}
          onSubmit={handleCardSubmit}
        />

        <CashForm
          open={cashFormOpen}
          onOpenChange={setCashFormOpen}
          instrument={editingInstrument}
          onSubmit={handleCashSubmit}
        />

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          instruments={instruments}
          onSubmit={handleTransferSubmit}
        />
      </div>
    </>
  );
};

export default FinancialInstrumentsPage;
