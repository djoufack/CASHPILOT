
import React from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { LogOut, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ClientPortal = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            <Helmet>
                <title>Client Portal</title>
            </Helmet>
            <div className="min-h-screen bg-gray-950">
                <nav className="bg-gray-900 border-b border-gray-800 p-4">
                    <div className="container mx-auto flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gradient">Client Portal</h1>
                        <Button variant="ghost" onClick={handleLogout} className="text-gray-400 hover:text-white">
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </nav>

                <div className="container mx-auto px-4 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                            <h2 className="text-xl font-bold text-gradient mb-4 flex items-center">
                                <FileText className="mr-2 text-orange-400" /> Recent Invoices
                            </h2>
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-gradient font-medium">INV-2026-001</p>
                                        <p className="text-gray-400 text-sm">Jan 28, 2026</p>
                                    </div>
                                    <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs">Paid</span>
                                </div>
                                <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-gradient font-medium">INV-2026-002</p>
                                        <p className="text-gray-400 text-sm">Feb 15, 2026</p>
                                    </div>
                                    <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 rounded text-xs">Due</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                            <h2 className="text-xl font-bold text-gradient mb-4 flex items-center">
                                <CheckCircle className="mr-2 text-orange-400" /> Pending Approvals
                            </h2>
                            <div className="text-gray-400 text-center py-8">
                                No timesheets pending approval.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ClientPortal;
