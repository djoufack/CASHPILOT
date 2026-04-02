import { useToast } from '@/components/ui/use-toast';
import { runDataEntryGuard } from '@/utils/dataEntryGuard';

const composeIssueMessage = (entry) => {
  if (!entry) return 'Controle de saisie invalide.';
  if (!entry.howToFix) return entry.message;
  return `${entry.message} ${entry.howToFix}`;
};

export const useDataEntryGuard = () => {
  const { toast } = useToast();

  const guardInput = ({
    entity,
    operation = 'upsert',
    payload = {},
    items = [],
    referencePayload = null,
    options = {},
  }) => {
    const report = runDataEntryGuard({
      entity,
      operation,
      payload,
      items,
      referencePayload,
      options,
    });

    if (report.blockingIssues.length > 0) {
      const firstIssue = report.blockingIssues[0];
      const message = composeIssueMessage(firstIssue);
      toast({
        title: 'Saisie bloquee',
        description: message,
        variant: 'destructive',
        duration: 10000,
      });
      const error = new Error(message);
      error.guardReport = report;
      throw error;
    }

    const firstCorrection = report.corrections[0]?.message;
    const firstWarning = report.warnings[0] ? composeIssueMessage(report.warnings[0]) : null;
    const shouldNotify = Boolean(firstCorrection || firstWarning);

    if (shouldNotify) {
      const notification = [firstCorrection, firstWarning].filter(Boolean).join(' ');
      toast({
        title: 'Controle de saisie',
        description: notification,
        duration: 7000,
      });
    }

    return {
      payload: report.sanitizedPayload,
      items: report.sanitizedItems,
      report,
    };
  };

  return { guardInput };
};
