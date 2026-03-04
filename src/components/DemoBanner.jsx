import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const STORAGE_KEY = 'cashpilot_demo_banner_dismissed';

const DemoBanner = ({ onDismiss }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, 'true');
    onDismiss?.();
  };

  const handleClick = () => {
    navigate('/login');
  };

  const marqueeContent = (
    <>
      <span className="demo-marquee-item">
        <span className="demo-marquee-star">&#x2726;</span>
        <span className="demo-marquee-highlight">{t('auth.demoBannerText')}</span>
      </span>
      <span className="demo-marquee-separator">&#xb7;</span>
      <span className="demo-marquee-item">
        <span className="demo-marquee-flag">{'\u{1F1EB}\u{1F1F7}'}</span>
        {`${t('auth.demoRegionFR')} ${t('auth.demoTagFR')}`}
      </span>
      <span className="demo-marquee-separator">&#xb7;</span>
      <span className="demo-marquee-item">
        <span className="demo-marquee-flag">{'\u{1F1E7}\u{1F1EA}'}</span>
        {`${t('auth.demoRegionBE')} ${t('auth.demoTagBE')}`}
      </span>
      <span className="demo-marquee-separator">&#xb7;</span>
      <span className="demo-marquee-item">
        <span className="demo-marquee-flag">{'\u{1F30D}'}</span>
        {`${t('auth.demoRegionOHADA')} ${t('auth.demoTagOHADA')}`}
      </span>
      <span className="demo-marquee-separator">&#xb7;</span>
      <span className="demo-marquee-item">
        <span className="demo-marquee-star">&#x2726;</span>
        <span className="demo-marquee-accent">{t('auth.demoBannerAccess')}</span>
      </span>
      <span className="demo-marquee-separator">&#xb7;</span>
    </>
  );

  return (
    <div className="demo-banner" onClick={handleClick}>
      <div className="demo-banner-track">
        <div className="demo-banner-content">
          {marqueeContent}
          {marqueeContent}
        </div>
      </div>
      <button
        className="demo-banner-close"
        onClick={handleDismiss}
        aria-label={t('auth.demoBannerClose')}
      >
        <X size={14} />
      </button>
      <div className="demo-banner-border" />
    </div>
  );
};

export default DemoBanner;
