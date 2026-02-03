
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useExpenses } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Receipt, Loader2, Trash2, List, CalendarDays, CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';

const ExpensesPage = () => {
  const { expenses, loading, createExpense } = useExpenses();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const emptyForm = {
    description: '',
    amount: '',
    category: 'general',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    supplier_name: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createExpense({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setIsDialogOpen(false);
      setFormData(emptyForm);
    } catch (err) {
      console.error('Error creating expense:', err);
    }
  };

  const filteredExpenses = expenses.filter(exp =>
    (exp.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exp.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const expenseCategoryColors = {
    general: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    office: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    travel: { bg: '#8b5cf6', border: '#7c3aed', text: '#fff' },
    software: { bg: '#06b6d4', border: '#0891b2', text: '#fff' },
    hardware: { bg: '#f97316', border: '#ea580c', text: '#fff' },
    marketing: { bg: '#ec4899', border: '#db2777', text: '#fff' },
    meals: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    telecom: { bg: '#14b8a6', border: '#0d9488', text: '#fff' },
    insurance: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
    other: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  };

  const expenseCalendarLegend = [
    { label: 'General', color: '#6b7280' },
    { label: 'Office', color: '#3b82f6' },
    { label: 'Travel', color: '#8b5cf6' },
    { label: 'Software', color: '#06b6d4' },
    { label: 'Marketing', color: '#ec4899' },
  ];

  const expenseCalendarEvents = filteredExpenses.map(exp => ({
    id: exp.id,
    title: exp.description || exp.category || 'Expense',
    date: exp.date,
    status: exp.category || 'general',
    resource: exp,
  }));

  const expenseAgendaItems = filteredExpenses.map(exp => ({
    id: exp.id,
    title: exp.description || 'Expense',
    subtitle: exp.supplier_name || exp.category || '',
    date: exp.date,
    status: exp.category || 'general',
    statusLabel: (exp.category || 'general').charAt(0).toUpperCase() + (exp.category || 'general').slice(1),
    statusColor: 'bg-orange-500/20 text-orange-400',
    amount: formatCurrency(exp.amount || 0),
  }));

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dépenses - CashPilot</title>
      </Helmet>

      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Dépenses</h1>
              <p className="text-gray-400 mt-1 text-sm">Gérez et suivez vos dépenses professionnelles.</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" /> Nouvelle dépense
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total des dépenses</p>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Nombre de dépenses</p>
            <p className="text-2xl font-bold text-gradient">{filteredExpenses.length}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Moyenne par dépense</p>
            <p className="text-2xl font-bold text-gradient">
              {filteredExpenses.length > 0 ? formatCurrency(totalExpenses / filteredExpenses.length) : formatCurrency(0)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une dépense..."
            className="pl-10 bg-gray-900 border-gray-800 text-white"
          />
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="bg-gray-800 border border-gray-700 mb-4">
            <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <List className="w-4 h-4 mr-2" /> Liste
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <CalendarDays className="w-4 h-4 mr-2" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="agenda" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <CalendarClock className="w-4 h-4 mr-2" /> Agenda
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-16">
                <Receipt className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                <p className="text-gray-500">Aucune dépense trouvée</p>
                <Button onClick={() => setIsDialogOpen(true)} className="mt-4 bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une dépense
                </Button>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Description</th>
                        <th className="text-left p-4 text-gray-400 font-medium hidden md:table-cell">Catégorie</th>
                        <th className="text-left p-4 text-gray-400 font-medium hidden lg:table-cell">Fournisseur</th>
                        <th className="text-right p-4 text-gray-400 font-medium">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-gray-400 text-sm">
                            {exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td className="p-4 text-gradient font-medium">{exp.description || '—'}</td>
                          <td className="p-4 text-gray-400 hidden md:table-cell capitalize">{exp.category || '—'}</td>
                          <td className="p-4 text-gray-400 hidden lg:table-cell">{exp.supplier_name || '—'}</td>
                          <td className="p-4 text-right text-gradient font-semibold">{formatCurrency(exp.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <GenericCalendarView
              events={expenseCalendarEvents}
              statusColors={expenseCategoryColors}
              legend={expenseCalendarLegend}
            />
          </TabsContent>

          <TabsContent value="agenda">
            <GenericAgendaView
              items={expenseAgendaItems}
              dateField="date"
              paidStatuses={[]}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Description *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Achat de fournitures..."
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Montant (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="office">Bureau</SelectItem>
                    <SelectItem value="travel">Déplacement</SelectItem>
                    <SelectItem value="software">Logiciels</SelectItem>
                    <SelectItem value="hardware">Matériel</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="meals">Repas</SelectItem>
                    <SelectItem value="telecom">Télécom</SelectItem>
                    <SelectItem value="insurance">Assurance</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="Nom du fournisseur"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  rows={2}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-600 text-gray-300">
                Annuler
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExpensesPage;
