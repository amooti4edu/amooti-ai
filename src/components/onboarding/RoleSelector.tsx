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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-2xl">Amooti</CardTitle>
          <CardDescription className="text-base mt-2">
            Let's get started! What's your role?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Card */}
          <div
            onClick={() => !isLoading && setSelectedRole('student')}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedRole === 'student'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">📚</div>
              <div>
                <h3 className="font-semibold text-white">Student</h3>
                <p className="text-sm text-slate-300">
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
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">👨‍🏫</div>
              <div>
                <h3 className="font-semibold text-white">Teacher</h3>
                <p className="text-sm text-slate-300">
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
                ? 'border-green-500 bg-green-500/10'
                : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏫</div>
              <div>
                <h3 className="font-semibold text-white">School (Enterprise)</h3>
                <p className="text-sm text-slate-300">
                  Shared account for multiple teachers and students
                </p>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!selectedRole || isLoading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
