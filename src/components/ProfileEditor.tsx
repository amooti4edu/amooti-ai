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
import { Settings, Check, Lock, Building2, Zap, Star, Sparkles } from 'lucide-react';
import type { Tier } from '@/types/chat';

// ── Tier definitions ────────────────────────────────────────────────────────
const TIERS: {
  id: Tier;
  label: string;
  price: string;
  questions: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  badge: string;
}[] = [
  {
    id: 'free',
    label: 'Free',
    price: 'UGX 0',
    questions: '5 questions / day',
    description: 'Get started — no payment needed.',
    icon: <Zap className="h-4 w-4" />,
    color: 'text-slate-300',
    border: 'border-slate-600',
    badge: 'bg-slate-700 text-slate-300',
  },
  {
    id: 'basic',
    label: 'Basic',
    price: 'UGX 7,000 / mo',
    questions: '10 questions / day',
    description: 'For students who need a little more.',
    icon: <Star className="h-4 w-4" />,
    color: 'text-blue-300',
    border: 'border-blue-600',
    badge: 'bg-blue-900/50 text-blue-300',
  },
  {
    id: 'premium',
    label: 'Premium',
    price: 'UGX 15,000 / mo',
    questions: '20 questions / day',
    description: 'Full access including Teacher mode.',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'text-amber-300',
    border: 'border-amber-500',
    badge: 'bg-amber-900/50 text-amber-300',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 'Contact us',
    questions: 'Unlimited',
    description: 'For schools — custom pricing & setup.',
    icon: <Building2 className="h-4 w-4" />,
    color: 'text-purple-300',
    border: 'border-purple-600',
    badge: 'bg-purple-900/50 text-purple-300',
  },
];

// ── Types ───────────────────────────────────────────────────────────────────
interface FormData {
  display_name: string;
  class: string;
  term: string;
  phone_number: string;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ProfileEditor() {
  const { session, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen]       = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [formData, setFormData]   = useState<FormData>({
    display_name: '',
    class: 'none',
    term: 'none',
    phone_number: '',
  });

  // ── Sync form when profile loads or dialog opens ─────────────────────────
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: (profile as any).display_name ?? '',
        class:        (profile as any).class        ?? 'none',
        term:         (profile as any).term         ?? 'none',
        phone_number: (profile as any).phone_number ?? '',
      });
    }
  }, [profile, isOpen]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const userId      = session?.user.id;
  const currentTier = ((profile as any)?.tier ?? 'free') as Tier;
  const tierExpiry  = (profile as any)?.tier_expires_at as string | null;

  const field = (key: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // ── Save profile info ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name || null,
          class:        formData.class  === 'none' ? null : formData.class,
          term:         formData.term   === 'none' ? null : formData.term,
          phone_number: formData.phone_number || null,
        })
        .eq('id', userId);          // ← schema uses `id`, not `user_id`

      if (error) throw error;

      await refreshProfile();

      toast({ title: 'Profile saved', description: 'Your information has been updated.' });
      setIsOpen(false);
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err.message ?? 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Tier card click ───────────────────────────────────────────────────────
  const handleTierClick = (tierId: Tier) => {
    if (tierId === currentTier) return;          // already on this tier

    if (tierId === 'enterprise') {
      toast({
        title: 'Enterprise plan',
        description: 'Please contact us to set up your school account.',
      });
      return;
    }

    // Payment not yet wired — placeholder
    toast({
      title: 'Payment coming soon',
      description: 'Mobile money payment will be available shortly. Check back soon!',
    });
  };

  // ── Tier expiry label ─────────────────────────────────────────────────────
  const expiryLabel = tierExpiry
    ? `Renews ${new Date(tierExpiry).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : null;

  const CLASSES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const TERMS   = ['1', '2', '3'];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Edit profile" className="h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="border-slate-700 bg-slate-800 max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Profile & Plan</DialogTitle>
          <DialogDescription className="text-slate-400">
            Update your information and manage your subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Personal info ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Your Info
            </h3>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-slate-300">Display Name</Label>
              <Input
                id="display-name"
                value={formData.display_name}
                onChange={(e) => field('display_name')(e.target.value)}
                placeholder="Your name"
                className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                disabled={isSaving}
              />
            </div>

            {/* Phone number */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-300">
                Phone Number
                <span className="ml-1 text-xs text-slate-500">(for mobile money payments)</span>
              </Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => field('phone_number')(e.target.value)}
                placeholder="e.g. 0771234567"
                className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                disabled={isSaving}
              />
            </div>

            {/* Class + Term — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="class-select" className="text-slate-300">Class</Label>
                <Select
                  value={formData.class}
                  onValueChange={field('class')}
                  disabled={isSaving}
                >
                  <SelectTrigger id="class-select" className="border-slate-600 bg-slate-700 text-white">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="none" className="text-slate-400">Not set</SelectItem>
                    {CLASSES.map((c) => (
                      <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="term-select" className="text-slate-300">Term</Label>
                <Select
                  value={formData.term}
                  onValueChange={field('term')}
                  disabled={isSaving}
                >
                  <SelectTrigger id="term-select" className="border-slate-600 bg-slate-700 text-white">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="none" className="text-slate-400">Not set</SelectItem>
                    {TERMS.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">Term {t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Subscription plan ─────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Subscription Plan
            </h3>

            {expiryLabel && (
              <p className="text-xs text-slate-400">{expiryLabel}</p>
            )}

            <div className="space-y-2">
              {TIERS.map((tier) => {
                const isActive  = tier.id === currentTier;
                const isLower   =
                  TIERS.findIndex((t) => t.id === tier.id) <
                  TIERS.findIndex((t) => t.id === currentTier);

                return (
                  <button
                    key={tier.id}
                    onClick={() => handleTierClick(tier.id)}
                    disabled={isActive || isLower}
                    className={[
                      'w-full rounded-lg border px-4 py-3 text-left transition-all duration-150',
                      'flex items-center justify-between gap-3',
                      isActive
                        ? `${tier.border} bg-slate-700/80 opacity-100 cursor-default`
                        : isLower
                        ? 'border-slate-700 bg-slate-800/50 opacity-40 cursor-not-allowed'
                        : `border-slate-700 bg-slate-800 hover:${tier.border} hover:bg-slate-700/60 cursor-pointer`,
                    ].join(' ')}
                  >
                    {/* Left: icon + text */}
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-0.5 shrink-0 ${tier.color}`}>{tier.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${tier.color}`}>
                            {tier.label}
                          </span>
                          {isActive && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tier.badge}`}>
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{tier.description}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{tier.questions}</p>
                      </div>
                    </div>

                    {/* Right: price + lock/check */}
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-medium ${tier.color}`}>{tier.price}</p>
                      {isActive ? (
                        <Check className="ml-auto mt-1 h-3.5 w-3.5 text-green-400" />
                      ) : !isLower ? (
                        <Lock className="ml-auto mt-1 h-3 w-3 text-slate-500" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-600 text-center">
              Mobile money payments coming soon
            </p>
          </section>

          {/* ── Save button ───────────────────────────────────────────── */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
