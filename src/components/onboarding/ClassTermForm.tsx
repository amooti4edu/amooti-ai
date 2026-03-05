import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ClassTermFormProps {
  role: 'student' | 'teacher' | 'school';
  onSubmit: (data: { class: string; term: string }) => void;
  isLoading?: boolean;
}

export default function ClassTermForm({ role, onSubmit, isLoading = false }: ClassTermFormProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  const classes = ['S1', 'S2', 'S3', 'S4'];
  const terms = ['1', '2', '3'];

  const handleSubmit = () => {
    if (selectedClass && selectedTerm) {
      onSubmit({ class: selectedClass, term: selectedTerm });
    }
  };

  const getDescription = () => {
    if (role === 'school') {
      return 'What classes are you managing? This helps organize curriculum for your school.';
    } else if (role === 'teacher') {
      return 'Which class are you teaching this term?';
    } else {
      return 'Let us know your current class and term so we can personalize your experience';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-2xl">Your Current Class</CardTitle>
          <CardDescription className="text-base mt-2">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Class Selection */}
          <div className="space-y-2">
            <Label htmlFor="class-select" className="text-base">
              Class
            </Label>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isLoading}>
              <SelectTrigger
                id="class-select"
                className="border-slate-600 bg-slate-700 text-white"
              >
                <SelectValue placeholder="Select your class" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls} className="text-white">
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term Selection */}
          <div className="space-y-2">
            <Label htmlFor="term-select" className="text-base">
              Term
            </Label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm} disabled={isLoading}>
              <SelectTrigger
                id="term-select"
                className="border-slate-600 bg-slate-700 text-white"
              >
                <SelectValue placeholder="Select your term" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {terms.map((term) => (
                  <SelectItem key={term} value={term} className="text-white">
                    Term {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info Text */}
          <p className="text-xs text-slate-400">
            💡 You can update this anytime from your profile. Students and teachers move to new
            classes and terms regularly!
          </p>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedClass || !selectedTerm || isLoading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
