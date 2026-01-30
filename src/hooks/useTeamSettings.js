
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

const MOCK_MEMBERS = [
  { id: 1, name: 'Alice Admin', email: 'alice@example.com', role: 'admin', joined_at: '2023-01-15' },
  { id: 2, name: 'Bob Builder', email: 'bob@example.com', role: 'manager', joined_at: '2023-03-20' },
  { id: 3, name: 'Charlie Client', email: 'charlie@client.com', role: 'viewer', joined_at: '2023-06-10' }
];

export const useTeamSettings = () => {
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addMember = async (email, role) => {
    setLoading(true);
    setTimeout(() => {
      const newMember = {
        id: Date.now(),
        name: email.split('@')[0], // Placeholder name
        email,
        role,
        joined_at: new Date().toISOString().split('T')[0]
      };
      setMembers([...members, newMember]);
      setLoading(false);
      toast({ title: "Invitation Sent", description: `Invitation sent to ${email}` });
    }, 1000);
  };

  const updateMember = async (id, updates) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    toast({ title: "Member Updated", description: "Team member role updated." });
  };

  const deleteMember = async (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    toast({ title: "Member Removed", description: "User removed from the team." });
  };

  return {
    members,
    loading,
    addMember,
    updateMember,
    deleteMember
  };
};
