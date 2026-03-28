import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Download, FileText, FileSignature, Copy } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const QuoteDialogs = ({
  // Preview
  viewingQuote,
  setViewingQuote,
  quotePreviewDocument,
  onExportPDF,
  onExportHTML,
  // Create
  isDialogOpen,
  setIsDialogOpen,
  formData,
  setFormData,
  submitting,
  handleSubmit,
  handleItemChange,
  addItem,
  removeItem,
  clients,
  totalHT,
  totalTax,
  totalTTC,
  // Signature
  signatureDialogOpen,
  setSignatureDialogOpen,
  signerEmail,
  setSignerEmail,
  signatureLink,
  setSignatureLink,
  signatureSubmitting,
  handleSendSignatureRequest,
  handleCopyGeneratedLink,
  // Loss reason
  lossDialogOpen,
  setLossDialogOpen,
  lossReasonCategory,
  setLossReasonCategory,
  lossReasonDetails,
  setLossReasonDetails,
  lossSubmitting,
  handleSaveLossReason,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Quote Preview Dialog */}
      <Dialog open={!!viewingQuote} onOpenChange={() => setViewingQuote(null)}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-5xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">
              {t('quotesPage.quoteDetails') || 'Details du devis'}
            </DialogTitle>
          </DialogHeader>
          {viewingQuote && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportPDF(viewingQuote)}
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20"
                  title={t('quotesPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_QUOTE })}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportHTML(viewingQuote)}
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20"
                  title={t('quotesPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  HTML
                </Button>
              </div>
              <iframe
                title={viewingQuote.quote_number || 'Quote preview'}
                srcDoc={quotePreviewDocument(viewingQuote)}
                className="w-full h-[70vh] bg-white rounded-md border border-gray-700"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Quote Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('quotesPage.create')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client & Dates */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.client')} *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={t('invoices.selectClient')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">{t('quotesPage.date')}</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('invoices.dueDate')}</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.lineItems')}</Label>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <Input
                      placeholder={t('invoices.description')}
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.quantity')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.unitPrice')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.taxRate')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(index, 'tax_rate', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length <= 1}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('quotesPage.addLine')}
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{t('quotesPage.subtotal')}</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('quotesPage.vat')}</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-gradient font-bold text-base border-t border-gray-700 pt-2">
                <span>{t('quotesPage.totalInclVat')}</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('timesheets.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('quotesPage.notesPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitting || !formData.client_id}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('quotesPage.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Signature Dialog */}
      <Dialog
        open={signatureDialogOpen}
        onOpenChange={(open) => {
          setSignatureDialogOpen(open);
          if (!open) {
            setSignatureLink('');
            setSignerEmail('');
          }
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('quotesPage.requestSignature')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.signerEmail')}</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="client@example.com"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            {signatureLink && (
              <div className="space-y-2">
                <Label className="text-gray-300">{t('quotesPage.signatureLink')}</Label>
                <div className="flex gap-2">
                  <Input value={signatureLink} readOnly className="bg-gray-800 border-gray-700 text-gray-300 text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyGeneratedLink}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignatureDialogOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={signatureSubmitting}
              onClick={handleSendSignatureRequest}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {signatureSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSignature className="w-4 h-4 mr-2" />
              )}
              {t('quotesPage.sendSignatureRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss Reason Dialog */}
      <Dialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (!open) {
            setLossReasonCategory('');
            setLossReasonDetails('');
          }
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('quotesPage.captureLossReason')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.lossReasonCategory')} *</Label>
              <Select value={lossReasonCategory} onValueChange={setLossReasonCategory}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={t('quotesPage.lossReasonCategory')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="budget" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.budget')}
                  </SelectItem>
                  <SelectItem value="timing" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.timing')}
                  </SelectItem>
                  <SelectItem value="competition" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.competition')}
                  </SelectItem>
                  <SelectItem value="scope" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.scope')}
                  </SelectItem>
                  <SelectItem value="no_response" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.no_response')}
                  </SelectItem>
                  <SelectItem value="other" className="text-white hover:bg-gray-700">
                    {t('quotesPage.lossReasonCategories.other')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.lossReasonDetails')}</Label>
              <Textarea
                value={lossReasonDetails}
                onChange={(event) => setLossReasonDetails(event.target.value)}
                placeholder={t('quotesPage.notesPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLossDialogOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={lossSubmitting}
              onClick={handleSaveLossReason}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {lossSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuoteDialogs;
