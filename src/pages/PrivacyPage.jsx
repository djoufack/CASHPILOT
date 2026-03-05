import React from 'react';
import { Link } from 'react-router-dom';

const sectionTitle = 'text-xl font-semibold text-white mb-3';
const paragraph = 'text-gray-300 leading-relaxed';

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Politique de confidentialite</h1>
          <p className="text-gray-400">
            Version du 2026-03-05
          </p>
        </header>

        <section className="mb-8">
          <h2 className={sectionTitle}>1. Responsable du traitement</h2>
          <p className={paragraph}>
            CashPilot est un service edite par DMG Management. Pour toute question relative aux donnees personnelles:
            <a className="text-orange-400 ml-1" href="mailto:dpo@cashpilot.tech">dpo@cashpilot.tech</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>2. Donnees traitees</h2>
          <p className={paragraph}>
            Nous traitons notamment les donnees de compte, donnees societes, donnees clients/fournisseurs,
            documents comptables (factures, paiements), metadonnees techniques et journaux de securite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>3. Finalites</h2>
          <p className={paragraph}>
            Les traitements servent a fournir le logiciel de gestion comptable et financiere, a securiser la plateforme,
            a produire des indicateurs, et a executer les fonctionnalites IA activees par l&apos;utilisateur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>4. IA et transfert hors UE</h2>
          <p className={paragraph}>
            Certaines fonctionnalites IA (extraction et assistance) peuvent impliquer un traitement par Google Gemini.
            Cela peut entrainer un transfert de donnees hors de l&apos;Union europeenne (notamment vers les Etats-Unis),
            selon les options activees et la configuration technique.
          </p>
          <p className={`${paragraph} mt-3`}>
            CashPilot applique des mesures de minimisation et de securite, et encadre contractuellement ces traitements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>5. Base legale et conservation</h2>
          <p className={paragraph}>
            Les traitements reposent sur l&apos;execution du contrat, les obligations legales et, selon les cas, le consentement.
            Les donnees sont conservees pendant la duree necessaire a la finalite et aux obligations comptables/fiscales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>6. Vos droits</h2>
          <p className={paragraph}>
            Vous pouvez demander l&apos;acces, la rectification, l&apos;effacement, la limitation, l&apos;opposition et la portabilite
            de vos donnees, sous reserve des obligations legales. Contact: <a className="text-orange-400" href="mailto:dpo@cashpilot.tech">dpo@cashpilot.tech</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={sectionTitle}>7. Securite</h2>
          <p className={paragraph}>
            CashPilot met en oeuvre des mesures techniques et organisationnelles proportionnees (controle d&apos;acces, RLS,
            chiffrement en transit, journalisation et surveillance).
          </p>
        </section>

        <footer className="pt-6 border-t border-gray-800 text-sm text-gray-400">
          <p>
            Voir aussi les <Link to="/legal" className="text-orange-400">mentions legales</Link>.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPage;
