
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountingDashboard from '@/components/accounting/AccountingDashboard';
import ChartOfAccounts from '@/components/accounting/ChartOfAccounts';
import { FileText, Settings, BarChart3, Calculator } from 'lucide-react';

const AccountingIntegration = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          Accounting Integration
        </h1>
        <p className="text-gray-400 mt-2 text-sm sm:text-base">
          Manage your general ledger, chart of accounts, and financial reporting.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full bg-gray-900 border-gray-800 overflow-x-auto flex-nowrap justify-start h-auto p-1">
          <TabsTrigger value="dashboard" className="flex-1 min-w-[100px] data-[state=active]:bg-gray-800">
            <BarChart3 className="w-4 h-4 mr-2" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="coa" className="flex-1 min-w-[100px] data-[state=active]:bg-gray-800">
            <FileText className="w-4 h-4 mr-2" /> Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex-1 min-w-[100px] data-[state=active]:bg-gray-800">
            <Settings className="w-4 h-4 mr-2" /> Mappings
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex-1 min-w-[100px] data-[state=active]:bg-gray-800">
            <Calculator className="w-4 h-4 mr-2" /> Tax Rates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
           <AccountingDashboard />
        </TabsContent>
        
        <TabsContent value="coa" className="mt-6">
           <ChartOfAccounts />
        </TabsContent>
        
        <TabsContent value="mappings" className="mt-6">
           <div className="p-8 text-center bg-gray-900/50 border border-gray-800 rounded-lg text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-white">Mapping Configuration</h3>
              <p>Configure how invoices and payments map to your ledger accounts.</p>
              <p className="mt-4 text-xs">Module coming in next update.</p>
           </div>
        </TabsContent>

        <TabsContent value="tax" className="mt-6">
            <div className="p-8 text-center bg-gray-900/50 border border-gray-800 rounded-lg text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-white">Tax Rates</h3>
              <p>Manage tax rates and their associated liability accounts.</p>
              <p className="mt-4 text-xs">Module coming in next update.</p>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountingIntegration;
