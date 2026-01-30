
import React, { useState } from 'react';
import { useTeamSettings } from '@/hooks/useTeamSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ResponsiveTable from '@/components/ui/ResponsiveTable';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trash2, UserPlus, Shield, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const TeamSettings = () => {
  const { members, loading, addMember, updateMember, deleteMember } = useTeamSettings();
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const handleInvite = () => {
    if (!newMemberEmail) return;
    addMember(newMemberEmail, newMemberRole);
    setNewMemberEmail('');
    setIsInviteOpen(false);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'manager': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
             <CardTitle>Team Members</CardTitle>
             <CardDescription className="text-gray-400">Manage your team and their access permissions.</CardDescription>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                 <UserPlus size={16} className="mr-2" /> Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white">
              <DialogHeader><DialogTitle>Invite New Member</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                       placeholder="colleague@example.com" 
                       value={newMemberEmail}
                       onChange={(e) => setNewMemberEmail(e.target.value)}
                       className="bg-gray-800 border-gray-700 text-white"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                       <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                       <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          <SelectItem value="admin">Admin (Full Access)</SelectItem>
                          <SelectItem value="manager">Manager (Projects & Tasks)</SelectItem>
                          <SelectItem value="member">Member (Assigned Only)</SelectItem>
                          <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="border-gray-700 text-gray-300">Cancel</Button>
                 <Button onClick={handleInvite} className="bg-orange-500 hover:bg-orange-600">Send Invitation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
           <ResponsiveTable
             data={members}
             columns={[
               { header: 'Member', accessor: (member) => (
                 <div className="flex items-center gap-3">
                   <Avatar className="h-9 w-9 bg-gray-800">
                     <AvatarFallback className="bg-gray-800 text-gray-300 border border-gray-700">{member.name.charAt(0)}</AvatarFallback>
                   </Avatar>
                   <div>
                     <p className="font-medium text-gradient">{member.name}</p>
                     <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10}/> {member.email}</p>
                   </div>
                 </div>
               )},
               { header: 'Role', accessor: (member) => (
                 <Badge variant="outline" className={`capitalize ${getRoleBadgeColor(member.role)}`}>{member.role}</Badge>
               )},
               { header: 'Joined', accessor: (member) => <span className="text-gray-400 text-sm">{member.joined_at}</span> },
               { header: 'Actions', accessor: (member) => (
                 <div className="flex items-center justify-end gap-2">
                   <Select value={member.role} onValueChange={(val) => updateMember(member.id, { role: val })}>
                     <SelectTrigger className="w-[100px] h-8 bg-transparent border-gray-800 text-xs"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-gray-800 border-gray-700 text-white">
                       <SelectItem value="admin">Admin</SelectItem>
                       <SelectItem value="manager">Manager</SelectItem>
                       <SelectItem value="viewer">Viewer</SelectItem>
                     </SelectContent>
                   </Select>
                   <Button size="icon" variant="ghost" onClick={() => deleteMember(member.id)} className="h-8 w-8 hover:text-red-400">
                     <Trash2 size={16} />
                   </Button>
                 </div>
               ), className: 'text-right' }
             ]}
             renderCard={(member) => (
               <Card className="bg-gray-800 border-gray-700">
                 <CardContent className="p-4">
                   <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-3">
                       <Avatar className="h-10 w-10 bg-gray-800">
                         <AvatarFallback className="bg-gray-800 text-gray-300 border border-gray-700">{member.name.charAt(0)}</AvatarFallback>
                       </Avatar>
                       <div>
                         <p className="font-medium text-gradient">{member.name}</p>
                         <p className="text-xs text-gray-500">{member.email}</p>
                       </div>
                     </div>
                     <Badge variant="outline" className={`capitalize ${getRoleBadgeColor(member.role)}`}>{member.role}</Badge>
                   </div>
                   <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                     <span className="text-xs text-gray-500">Joined {member.joined_at}</span>
                     <div className="flex items-center gap-2">
                       <Select value={member.role} onValueChange={(val) => updateMember(member.id, { role: val })}>
                         <SelectTrigger className="w-[100px] h-8 bg-transparent border-gray-700 text-xs"><SelectValue /></SelectTrigger>
                         <SelectContent className="bg-gray-800 border-gray-700 text-white">
                           <SelectItem value="admin">Admin</SelectItem>
                           <SelectItem value="manager">Manager</SelectItem>
                           <SelectItem value="viewer">Viewer</SelectItem>
                         </SelectContent>
                       </Select>
                       <Button size="icon" variant="ghost" onClick={() => deleteMember(member.id)} className="h-8 w-8 hover:text-red-400">
                         <Trash2 size={16} />
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             )}
             loading={loading}
             emptyMessage="No team members found."
           />
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamSettings;
