
import React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Plus, FileSignature } from 'lucide-react';
import { motion } from 'framer-motion';

const QuotesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>Quotes - {t('app.name')}</title>
      </Helmet>
      
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
                        Quotes
                    </h1>
                    <p className="text-gray-400 text-sm md:text-base">Manage proposals and estimates</p>
                </div>
                <Button className="w-full md:w-auto bg-gradient-to-r from-yellow-500 via-blue-500 to-purple-500 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Create Quote
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Placeholder for no quotes */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="col-span-full bg-gray-900 border border-gray-800 rounded-xl p-8 md:p-12 text-center"
                >
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-gray-800 rounded-full">
                            <FileSignature className="w-12 h-12 text-blue-500" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No quotes yet</h3>
                    <p className="text-gray-400 mb-6">Create your first quote to send to a client.</p>
                    <Button variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
                        Create Quote
                    </Button>
                </motion.div>
            </div>
        </div>
    </>
  );
};

export default QuotesPage;
