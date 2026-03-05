import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TierSelectorProps {
  onTierSelect: (tier: 'free' | 'basic' | 'premium') => void;
  isLoading?: boolean;
  isDevelopment?: boolean; // Skip payment flow in dev mode
}

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    description: 'Great for getting started',
    features: [
      '5 questions per day',
      'Access to query mode',
      'Basic AI responses',
      'Chat history saved',
    ],
    highlight: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '7,000',
    currency: 'UGX/month',
    description: 'For serious students',
    features: [
      '10 questions per day',
      'Query & Quiz modes',
      'Advanced AI reasoning',
      'Detailed explanations',
      'Progress tracking',
    ],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '15,000',
    currency: 'UGX/month',
    description: 'For educators',
    features: [
      '20 questions per day',
      'Query, Quiz & Teacher modes',
      'Best AI models',
      'Lesson plan generation',
      'Student progress analytics',
      'Priority support',
    ],
    highlight: false,
  },
];

export default function TierSelector({
  onTierSelect,
  isLoading = false,
  isDevelopment = false,
}: TierSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<'free' | 'basic' | 'premium'>('free');

  const handleSelect = async (tier: 'free' | 'basic' | 'premium') => {
    setSelectedTier(tier);

    if (isDevelopment) {
      // In dev mode, skip payment and proceed immediately
      setTimeout(() => onTierSelect(tier), 500);
    } else {
      // In production, would show payment modal
      // For now, just proceed (PesaPal integration to be added)
      onTierSelect(tier);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Choose Your Plan</h2>
          <p className="text-slate-300">
            Start free, upgrade anytime. All plans include AI-powered learning and questions.
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              onClick={() => !isLoading && handleSelect(tier.id as any)}
              className={`border-2 cursor-pointer transition-all relative ${
                selectedTier === tier.id
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              } ${tier.highlight ? 'md:ring-2 md:ring-blue-500 md:-translate-y-2' : ''} ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-600 border-blue-600 text-white">
                  Most Popular
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="text-slate-300">{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  <div className="text-3xl font-bold text-white">{tier.price}</div>
                  {tier.currency && (
                    <div className="text-sm text-slate-400">{tier.currency}</div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Select Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(tier.id as any);
                  }}
                  disabled={isLoading}
                  variant={selectedTier === tier.id ? 'default' : 'outline'}
                  className={`w-full ${
                    selectedTier === tier.id
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {selectedTier === tier.id ? 'Selected' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dev Mode Notice */}
        {isDevelopment && (
          <div className="bg-yellow-500/10 border border-yellow-600 rounded-lg p-4 text-center text-sm text-yellow-200 mb-6">
            ⚠️ Development Mode: Payment skipped. In production, clicking a tier will process payment via PesaPal.
          </div>
        )}

        {/* Continue Button */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => onTierSelect(selectedTier)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 px-8"
          >
            {isLoading ? 'Setting up...' : 'Continue with ' + selectedTier}
          </Button>
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>🔄 Subscription renews every 30 days. Cancel anytime from your profile settings.</p>
        </div>
      </div>
    </div>
  );
}
