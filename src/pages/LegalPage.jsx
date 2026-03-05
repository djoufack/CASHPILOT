import React from 'react';
import { Link } from 'react-router-dom';

const sectionTitle = 'text-xl font-semibold text-white mb-3';
const paragraph = 'text-gray-300 leading-relaxed';

const LegalPage = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Mentions legales</h1>
          <p className="text-gray-400">Version du 2026-03-05</p>
        </header>

        <section className="mb-8">
          <h2 className={sectionTitle}>1. Editeur</h2>
          <p className={paragraph}>
            CashPilot est edite par DMG Management.
          </p>
          <p className={`${paragraph} mt-2`}>
            Contact: <a className="text-orange-400" href="mailto:info@dmgmanagement.tech">info@dmgmanagement.tech</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>2. Hebergement</h2>
          <p className={paragraph}>
            Application web hebergee sur une infrastructure cloud (frontend et services backend managés).
            Les fournisseurs techniques peuvent evoluer selon les exigences de securite et de disponibilite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>3. Propriete intellectuelle</h2>
          <p className={paragraph}>
            L&apos;ensemble du contenu de CashPilot (textes, interfaces, logos, composants logiciels) est protege.
            Toute reproduction ou exploitation non autorisee est interdite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>4. Responsabilite</h2>
          <p className={paragraph}>
            CashPilot fournit des outils d&apos;aide a la gestion et a l&apos;analyse. Les resultats ne remplacent pas
            l&apos;avis d&apos;un professionnel qualifie ni les obligations legales de l&apos;entreprise utilisatrice.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>5. Donnees personnelles</h2>
          <p className={paragraph}>
            Le traitement des donnees personnelles est detaille dans la politique de confidentialite.
            Pour les demandes RGPD: <a className="text-orange-400" href="mailto:dpo@cashpilot.tech">dpo@cashpilot.tech</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>6. Droit applicable</h2>
          <p className={paragraph}>
            Les presentes mentions sont soumises au droit applicable selon la juridiction contractuelle convenue
            avec l&apos;utilisateur professionnel.
          </p>
        </section>

        <footer className="pt-6 border-t border-gray-800 text-sm text-gray-400">
          <p>
            Voir aussi la <Link to="/privacy" className="text-orange-400">politique de confidentialite</Link>.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default LegalPage;
