import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleSelectorProps {
  onRoleSelect: (role: 'student' | 'teacher' | 'school') => void;
  isLoading?: boolean;
}

export default function RoleSelector({ onRoleSelect, isLoading = false }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | 'school' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: '#FAF8F4', fontFamily: "'EB Garamond', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
        .role-selector-container { font-family: 'EB Garamond', Georgia, serif; }
        .role-selector-title { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>
      <Card className="w-full max-w-md border-[#c8b99a] bg-white shadow-lg role-selector-container">
        <CardHeader>
          <CardTitle className="text-3xl role-selector-title" style={{ color: '#1a1814' }}>Amooti</CardTitle>
          <CardDescription className="text-base mt-2" style={{ color: '#6b5e48' }}>
            Let's get started! What's your role?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Card */}
          <div
            onClick={() => !isLoading && setSelectedRole('student')}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedRole === 'student'
                ? 'border-[#8a7a62] bg-[#f5f0e8]'
                : 'border-[#c8b99a] bg-white hover:border-[#8a7a62]'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">📚</div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1814' }}>Student</h3>
                <p className="text-sm" style={{ color: '#6b5e48' }}>
                  Learn with AI tutoring in different subjects
                </p>
              </div>
            </div>
          </div>

          {/* Teacher Card */}
          <div
            onClick={() => !isLoading && setSelectedRole('teacher')}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedRole === 'teacher'
                ? 'border-[#8a7a62] bg-[#f5f0e8]'
                : 'border-[#c8b99a] bg-white hover:border-[#8a7a62]'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">👨‍🏫</div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1814' }}>Teacher</h3>
                <p className="text-sm" style={{ color: '#6b5e48' }}>
                  Create lesson plans and materials for your class
                </p>
              </div>
            </div>
          </div>

          {/* School/Enterprise Card */}
          <div
            onClick={() => !isLoading && setSelectedRole('school')}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedRole === 'school'
                ? 'border-[#8a7a62] bg-[#f5f0e8]'
                : 'border-[#c8b99a] bg-white hover:border-[#8a7a62]'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏫</div>
              <div>
                <h3 className="font-semibold" style={{ color: '#1a1814' }}>School (Enterprise)</h3>
                <p className="text-sm" style={{ color: '#6b5e48' }}>
                  Shared account for multiple teachers and students
                </p>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!selectedRole || isLoading}
            className="w-full mt-6 disabled:opacity-50"
            style={{ backgroundColor: '#1a1814', color: '#FAF8F4' }}
          >
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
