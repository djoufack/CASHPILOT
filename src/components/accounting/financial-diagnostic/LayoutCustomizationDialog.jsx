import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoveDown, MoveUp } from 'lucide-react';
import { CARD_DEFINITIONS } from './diagnosticConstants';

const LayoutCustomizationDialog = ({
  open,
  onOpenChange,
  orderedIds,
  hiddenCardIds,
  onToggleCardVisibility,
  onMoveCard,
  onReset,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-950 border border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle>{t('financial_diagnostic.customize_gallery')}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('financial_diagnostic.customize_gallery_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {orderedIds.map((cardId, index) => {
            const rawCard = CARD_DEFINITIONS.find((item) => item.id === cardId);
            if (!rawCard) return null;
            const cardTitle = t(`financial_diagnostic.cards.${rawCard.i18nKey}.title`);
            const isVisible = !hiddenCardIds.includes(rawCard.id);

            return (
              <div
                key={rawCard.id}
                className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 flex items-center gap-3"
              >
                <Checkbox
                  checked={isVisible}
                  onCheckedChange={(checked) => onToggleCardVisibility(rawCard.id, Boolean(checked))}
                  aria-label={t('financial_diagnostic.show_card_aria', { title: cardTitle })}
                  className="h-5 w-5 border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">{cardTitle}</p>
                  <p className="text-xs text-gray-500">{rawCard.section}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('financial_diagnostic.move_up_aria', { title: cardTitle })}
                    disabled={index === 0}
                    onClick={() => onMoveCard(rawCard.id, 'up')}
                    className="h-8 w-8 border-gray-700 text-gray-200"
                  >
                    <MoveUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('financial_diagnostic.move_down_aria', { title: cardTitle })}
                    disabled={index === orderedIds.length - 1}
                    onClick={() => onMoveCard(rawCard.id, 'down')}
                    className="h-8 w-8 border-gray-700 text-gray-200"
                  >
                    <MoveDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onReset();
            }}
            className="border-gray-700 text-gray-200"
          >
            {t('financial_diagnostic.reset')}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('financial_diagnostic.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LayoutCustomizationDialog;
