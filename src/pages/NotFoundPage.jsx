import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 px-4">
        <FileQuestion className="mx-auto h-24 w-24 text-muted-foreground/50" />
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
          <p className="text-lg text-muted-foreground">{t('errors.pageNotFound', 'This page could not be found.')}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="default"><Link to="/">{t('common.backToHome', 'Back to home')}</Link></Button>
          <Button asChild variant="outline"><Link to="/app/dashboard">{t('common.goToDashboard', 'Go to dashboard')}</Link></Button>
        </div>
      </div>
    </div>
  );
}
