import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import RoleSelector from './RoleSelector';
import ClassTermForm from './ClassTermForm';
import TierSelector from './TierSelector';
import { useToast } from '@/components/ui/use-toast';

type OnboardingStep = 'role' | 'class' | 'tier' | 'complete';

interface OnboardingState {
  role: 'student' | 'teacher' | 'school' | null;
  class: string | null;
  term: string | null;
  tier: 'free' | 'basic' | 'premium' | 'enterprise' | null;
}

interface OnboardingProps {
  onComplete: () => void;
  isDevelopment?: boolean;
}

export default function Onboarding({ onComplete, isDevelopment = false }: OnboardingProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<OnboardingStep>('role');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<OnboardingState>({
    role: (profile?.role === 'student' || profile?.role === 'teacher' || profile?.role === 'school') ? profile.role as 'student' | 'teacher' | 'school' : null,
    class: profile?.class || null,
    term: profile?.term || null,
    tier: profile?.tier === 'free' ? 'free' : null,
  });

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const handleRoleSelect = async (role: 'student' | 'teacher' | 'school') => {
    setIsLoading(true);
    try {
      // Update profile with role
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.id);

      if (error) throw error;

      setFormData({ ...formData, role });
      
      // Only go to class selection for students
      // Teachers and schools skip directly to tier selection
      if (role === 'student') {
        setStep('class');
      } else {
        setStep('tier');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save role',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassTermSubmit = async (data: { class: string; term: string }) => {
    setIsLoading(true);
    try {
      // Update profile with class and term
      const { error } = await supabase
        .from('profiles')
        .update({ class: data.class, term: data.term })
        .eq('id', user.id);

      if (error) throw error;

      setFormData({ ...formData, class: data.class, term: data.term });
      setStep('tier');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save class and term',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTierSelect = async (tier: 'free' | 'basic' | 'premium' | 'enterprise') => {
    setIsLoading(true);
    try {
      // Create subscription record
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const { error: subError } = await (supabase as any)
        .from('subscriptions')
        .insert({
          user_id: user.id,
          tier,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });

      if (subError) throw subError;

      // Update profile tier and mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          tier,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setFormData({ ...formData, tier });
      setStep('complete');

      // Small delay for visual feedback
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete onboarding',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  switch (step) {
    case 'role':
      return <RoleSelector onRoleSelect={handleRoleSelect} isLoading={isLoading} />;

    case 'class':
      return (
        <ClassTermForm
          role={formData.role || 'student'}
          onSubmit={handleClassTermSubmit}
          isLoading={isLoading}
        />
      );

    case 'tier':
      return (
        <TierSelector
          onTierSelect={handleTierSelect}
          isLoading={isLoading}
          isDevelopment={isDevelopment}
        />
      );

    case 'complete':
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-center">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome to Amooti!</h2>
            <p className="text-slate-300">Setting up your account...</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
