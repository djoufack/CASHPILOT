
import React, { useState } from 'react';
import { useTeamSettings } from '@/hooks/useTeamSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      case 'manager': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
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
              <Button className="bg-blue-600 hover:bg-blue-700">
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
                 <Button onClick={handleInvite} className="bg-blue-600 hover:bg-blue-700">Send Invitation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
           <Table>
              <TableHeader>
                 <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Member</TableHead>
                    <TableHead className="text-gray-400">Role</TableHead>
                    <TableHead className="text-gray-400">Joined</TableHead>
                    <TableHead className="text-right text-gray-400">Actions</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {members.map(member => (
                    <TableRow key={member.id} className="border-gray-800 hover:bg-gray-800/50">
                       <TableCell className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 bg-gray-800">
                             <AvatarFallback className="bg-gray-800 text-gray-300 border border-gray-700">{member.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                             <p className="font-medium text-white">{member.name}</p>
                             <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10}/> {member.email}</p>
                          </div>
                       </TableCell>
                       <TableCell>
                          <Badge variant="outline" className={`capitalize ${getRoleBadgeColor(member.role)}`}>
                             {member.role}
                          </Badge>
                       </TableCell>
                       <TableCell className="text-gray-400 text-sm">{member.joined_at}</TableCell>
                       <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                             <Select 
                                value={member.role} 
                                onValueChange={(val) => updateMember(member.id, { role: val })}
                             >
                                <SelectTrigger className="w-[100px] h-8 bg-transparent border-gray-800 text-xs">
                                   <SelectValue />
                                </SelectTrigger>
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
                       </TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamSettings;
