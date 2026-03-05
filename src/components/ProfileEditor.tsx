import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Settings } from 'lucide-react';

export default function ProfileEditor() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    class: '',
    term: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        class: profile.class || '',
        term: profile.term || '',
      });
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          class: formData.class,
          term: formData.term,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const classes = ['S1', 'S2', 'S3', 'S4'];
  const terms = ['1', '2', '3'];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Edit profile">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-700 bg-slate-800">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription className="text-slate-400">
            Update your information. You can change this anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name" className="text-slate-300">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Your name"
              className="border-slate-600 bg-slate-700 text-white"
              disabled={isSaving}
            />
          </div>

          {/* Class */}
          <div className="space-y-2">
            <Label htmlFor="class-select" className="text-slate-300">
              Class
            </Label>
            <Select
              value={formData.class}
              onValueChange={(value) => setFormData({ ...formData, class: value })}
              disabled={isSaving}
            >
              <SelectTrigger
                id="class-select"
                className="border-slate-600 bg-slate-700 text-white"
              >
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="">Not set</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls} className="text-white">
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term */}
          <div className="space-y-2">
            <Label htmlFor="term-select" className="text-slate-300">
              Term
            </Label>
            <Select
              value={formData.term}
              onValueChange={(value) => setFormData({ ...formData, term: value })}
              disabled={isSaving}
            >
              <SelectTrigger
                id="term-select"
                className="border-slate-600 bg-slate-700 text-white"
              >
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="">Not set</SelectItem>
                {terms.map((term) => (
                  <SelectItem key={term} value={term} className="text-white">
                    Term {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Tier Info */}
          <div className="bg-blue-500/10 border border-blue-600 rounded-lg p-3 text-sm text-blue-200">
            <strong>Current Plan:</strong> {profile?.tier || 'free'} tier
            <br />
            <span className="text-xs text-blue-300">
              Manage subscriptions from your settings
            </span>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
