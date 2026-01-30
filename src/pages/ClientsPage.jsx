
import React from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import ClientManager from '@/components/ClientManager';
import { motion } from 'framer-motion';

const ClientsPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('clients.title')} - {t('app.name')}</title>
        <meta name="description" content="Manage your clients and contacts" />
      </Helmet>

      <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-green-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {t('clients.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">Manage your client relationships and contacts</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ClientManager />
          </motion.div>
      </div>
    </>
  );
};

export default ClientsPage;
