import { Helmet } from 'react-helmet';
import AdminMcpToolsManager from '@/components/admin/AdminMcpToolsManager';

const AdminMcpToolsPage = () => {
  return (
    <>
      <Helmet>
        <title>Administration MCP Tools - CashPilot</title>
      </Helmet>
      <div className="container mx-auto px-4 py-6 md:px-8 min-h-screen text-white">
        <AdminMcpToolsManager />
      </div>
    </>
  );
};

export default AdminMcpToolsPage;
