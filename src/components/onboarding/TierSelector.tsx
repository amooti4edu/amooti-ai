import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TierSelectorProps {
  onTierSelect: (tier: 'free' | 'basic' | 'premium' | 'enterprise') => void;
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
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    currency: 'Contact sales',
    description: 'For schools & institutions',
    features: [
      'Unlimited questions',
      'All modes & features included',
      'Custom AI models',
      'Advanced analytics',
      'Multi-class management',
      'Dedicated support',
      'Custom integrations',
    ],
    highlight: false,
  },
];

export default function TierSelector({
  onTierSelect,
  isLoading = false,
  isDevelopment = false,
}: TierSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<'free' | 'basic' | 'premium' | 'enterprise'>('free');

  const handleSelect = async (tier: 'free' | 'basic' | 'premium' | 'enterprise') => {
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
    <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: '#FAF8F4', fontFamily: "'EB Garamond', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
        .tier-selector-title { font-family: 'Playfair Display', Georgia, serif; }
        .tier-card-title { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold tier-selector-title mb-2" style={{ color: '#1a1814' }}>Choose Your Plan</h2>
          <p style={{ color: '#6b5e48' }}>
            Start free, upgrade anytime. All plans include AI-powered learning and questions.
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              onClick={() => !isLoading && handleSelect(tier.id as any)}
              className={`border-2 cursor-pointer transition-all relative ${
                selectedTier === tier.id
                  ? 'border-[#8a7a62] bg-[#f5f0e8]'
                  : 'border-[#c8b99a] bg-white hover:border-[#8a7a62]'
              } ${tier.highlight ? 'ring-2 ring-[#8a7a62] -translate-y-2' : ''} ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: '#1a1814', borderColor: '#1a1814', color: '#FAF8F4' }}>
                  Most Popular
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-xl tier-card-title" style={{ color: '#1a1814' }}>{tier.name}</CardTitle>
                <CardDescription style={{ color: '#6b5e48' }}>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  <div className="text-3xl font-bold tier-card-title" style={{ color: '#1a1814' }}>{tier.price}</div>
                  {tier.currency && (
                    <div className="text-sm" style={{ color: '#8a7a62' }}>{tier.currency}</div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#6b5e48' }}>
                      <span className="mt-0.5" style={{ color: '#8a7a62' }}>✓</span>
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
                  className={`w-full ${
                    selectedTier === tier.id
                      ? 'text-[#FAF8F4]'
                      : 'border-[#8a7a62] text-[#1a1814] hover:bg-[#f5f0e8]'
                  }`}
                  style={selectedTier === tier.id ? { backgroundColor: '#1a1814' } : {}}
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
