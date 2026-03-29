
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ClientDeleteConfirm = ({
  isOpen,
  onOpenChange,
  onConfirm,
  t: tProp,
}) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('clients.archiveClient', 'Archiver le client')}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            {t('clients.confirmArchive', 'Ce client sera archivé et n\'apparaîtra plus dans la liste. Vous pourrez le restaurer à tout moment depuis les clients archivés. Les factures et documents associés seront conservés.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
            {t('buttons.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
          >
            {t('buttons.archive', 'Archiver')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ClientDeleteConfirm;
