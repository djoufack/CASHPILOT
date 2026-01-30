
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

export const useSeedData = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState([]);
  const { toast } = useToast();

  const addLog = (message, status = 'info') => {
    setProgress(prev => [...prev, { message, status, timestamp: new Date() }]);
  };

  const createTestUsers = async () => {
    setLoading(true);
    setProgress([]);
    addLog('Starting user creation process...', 'info');

    const users = [
      { email: 'admin.test@cashpilot.cloud', password: 'AdminTest@123', role: 'admin', name: 'Admin User' },
      { email: 'scte.test@cashpilot.cloud', password: 'ScteTest@123', role: 'user', name: 'SCTE Manager' },
      { email: 'freelance.test@cashpilot.cloud', password: 'FreelanceTest@123', role: 'user', name: 'Freelance User' }
    ];

    try {
      for (const userData of users) {
        addLog(`Creating user: ${userData.email}...`, 'pending');
        
        // 1. Sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              full_name: userData.name,
              role: userData.role // Store role in metadata as backup
            }
          }
        });

        if (signUpError) {
          addLog(`Error creating ${userData.email}: ${signUpError.message}`, 'error');
          continue; // Skip to next user on error
        }

        if (authData?.user) {
          const userId = authData.user.id;
          addLog(`User ${userData.email} created (ID: ${userId}). Assigning role...`, 'pending');

          // 2. Assign role in user_roles table
          const { error: roleError } = await supabase
            .from('user_roles')
            .upsert({ user_id: userId, role: userData.role }, { onConflict: 'user_id' });

          if (roleError) {
            addLog(`Error assigning role to ${userData.email}: ${roleError.message}`, 'error');
          } else {
            addLog(`Role '${userData.role}' assigned to ${userData.email}.`, 'success');
          }

          // 3. Create profile entry (optional but recommended based on schema)
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: uuidv4(),
              user_id: userId,
              full_name: userData.name,
              role: userData.role,
              email: userData.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' }); // Assuming user_id might be unique or handle conflict appropriately

           if (profileError) {
             // It's possible profiles are auto-created by triggers, so this might be redundant or fail silently
             console.log('Profile creation note:', profileError.message);
           }
        }
      }
      
      addLog('User creation process completed.', 'success');
      toast({
        title: "User Creation Completed",
        description: "Check the log for details on each user.",
      });

    } catch (error) {
      addLog(`Unexpected error: ${error.message}`, 'error');
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during user creation.",
      });
    } finally {
      setLoading(false);
    }
  };

  const seedDatabase = async () => {
    setLoading(true);
    setProgress([]);
    addLog('Starting database seeding...', 'info');

    try {
      // Get the users we just created to link data to them
      // We'll fetch them by email to ensure we have the IDs
      const { data: users, error: userError } = await supabase
        .from('profiles') // Or fetch from auth if you have admin rights, but client-side restricted. 
        // NOTE: For client-side seeding without Service Role key, we can only insert data for the CURRENTLY logged in user usually due to RLS.
        // HOWEVER, if this is an Admin tool and RLS allows admins to write, or if we just seeded them and are logged in as admin...
        // Let's assume the current user (Admin) has permission to write data for others or we are just creating general data.
        // Actually, best practice for this "Test Data" button is often: "Seed data for ME (current user)" or "Seed system data".
        
        // Strategy: We will try to fetch the specific test users we created. 
        // If we can't see them due to RLS, we might be limited. 
        // Assuming Admin role has bypass or read all access on profiles.
        .select('user_id, email, full_name');
        
      if (userError) throw userError;

      const scteUser = users?.find(u => u.email === 'scte.test@cashpilot.cloud') || { user_id: (await supabase.auth.getUser()).data.user?.id }; 
      // Fallback to current user if specific test user not found/accessible
      
      const userId = scteUser.user_id;

      if (!userId) {
        throw new Error("Target user ID not found. Please create users first or log in.");
      }

      addLog(`Seeding data for user ID: ${userId} (${scteUser.email || 'Current'})`, 'info');

      // 1. Create Suppliers
      addLog('Creating suppliers...', 'pending');
      const suppliersData = [
        {
          id: uuidv4(),
          user_id: userId,
          company_name: 'Électronique Pro',
          contact_person: 'Jean Dupont',
          email: 'contact@electronique-pro.fr',
          phone: '+33 1 23 45 67 89',
          address: '123 Rue de la Paix, 75001 Paris',
          supplier_type: 'both',
          status: 'active',
          payment_terms: 'Net 30',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: uuidv4(),
          user_id: userId,
          company_name: 'Logistique Express',
          contact_person: 'Pierre Bernard',
          email: 'contact@logistique-express.fr',
          phone: '+33 3 45 67 89 01',
          address: '789 Boulevard de la Logistique, 75003 Paris',
          supplier_type: 'service',
          status: 'active',
          payment_terms: 'Net 15',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const { data: insertedSuppliers, error: supplierError } = await supabase
        .from('suppliers')
        .upsert(suppliersData)
        .select();

      if (supplierError) throw new Error(`Supplier creation failed: ${supplierError.message}`);
      addLog(`Created ${insertedSuppliers.length} suppliers.`, 'success');

      // 2. Create Product Categories
      addLog('Creating product categories...', 'pending');
      const categoriesData = [
        { id: uuidv4(), user_id: userId, name: 'Câbles', description: 'Câbles électriques' },
        { id: uuidv4(), user_id: userId, name: 'Composants', description: 'Composants électroniques divers' }
      ];
      
      const { data: insertedCategories, error: catError } = await supabase
        .from('supplier_product_categories')
        .upsert(categoriesData)
        .select();
        
      if (catError) throw new Error(`Category creation failed: ${catError.message}`);

      // 3. Create Products & Services
      addLog('Creating products and services...', 'pending');
      const supplier1 = insertedSuppliers[0];
      const category1 = insertedCategories[0];
      
      if (supplier1 && category1) {
        const productsData = [
            {
                id: uuidv4(),
                supplier_id: supplier1.id,
                category_id: category1.id,
                product_name: 'Câble électrique 2.5mm²',
                sku: 'CABLE-2.5-100',
                unit_price: 0.85,
                unit: 'mètre',
                stock_quantity: 500,
                min_stock_level: 100,
                created_at: new Date().toISOString()
            }
        ];
        
        const { error: prodError } = await supabase.from('supplier_products').upsert(productsData);
        if (prodError) throw new Error(`Product creation failed: ${prodError.message}`);

        const servicesData = [
            {
                id: uuidv4(),
                supplier_id: supplier1.id,
                service_name: 'Installation électrique',
                pricing_type: 'hourly',
                hourly_rate: 75,
                availability: 'Lundi-Vendredi 08:00-18:00',
                created_at: new Date().toISOString()
            }
        ];
        const { error: servError } = await supabase.from('supplier_services').upsert(servicesData);
        if (servError) throw new Error(`Service creation failed: ${servError.message}`);
      }

      // 4. Create Notifications
      addLog('Creating notifications...', 'pending');
      const notificationsData = [
        {
            id: uuidv4(),
            user_id: userId,
            type: 'system',
            message: 'Welcome to CashPilot! System seeded successfully.',
            read: false,
            created_at: new Date().toISOString()
        },
        {
            id: uuidv4(),
            user_id: userId,
            type: 'alert',
            message: 'Low stock warning: Câble électrique 2.5mm²',
            read: false,
            created_at: new Date().toISOString()
        }
      ];
      await supabase.from('notifications').upsert(notificationsData);

      // 5. Create Audit Log
      addLog('Creating audit logs...', 'pending');
      await supabase.from('audit_log').insert({
          id: uuidv4(),
          user_id: userId,
          action: 'SEED_DATA',
          details: { message: 'Database seeded with test data' },
          created_at: new Date().toISOString()
      });

      addLog('Database seeding completed successfully!', 'success');
      toast({
        title: "Seeding Completed",
        description: "Test data has been populated successfully.",
      });

    } catch (error) {
      addLog(`Seeding error: ${error.message}`, 'error');
      console.error(error);
      toast({
        variant: "destructive",
        title: "Seeding Failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    progress,
    createTestUsers,
    seedDatabase
  };
};
