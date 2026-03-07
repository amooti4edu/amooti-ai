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
    <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: '#FAF8F4', fontFamily: "'EB Garamond', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
        .class-form-container { font-family: 'EB Garamond', Georgia, serif; }
        .class-form-title { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>
      <Card className="w-full max-w-md border-[#c8b99a] bg-white shadow-lg class-form-container">
        <CardHeader>
          <CardTitle className="text-3xl class-form-title" style={{ color: '#1a1814' }}>Your Current Class</CardTitle>
          <CardDescription className="text-base mt-2" style={{ color: '#6b5e48' }}>
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Class Selection */}
          <div className="space-y-2">
            <Label htmlFor="class-select" className="text-base" style={{ color: '#1a1814' }}>
              Class
            </Label>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isLoading}>
              <SelectTrigger
                id="class-select"
                className="border-[#c8b99a] bg-white text-[#1a1814]"
              >
                <SelectValue placeholder="Select your class" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#c8b99a]">
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls} className="text-[#1a1814]">
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term Selection */}
          <div className="space-y-2">
            <Label htmlFor="term-select" className="text-base" style={{ color: '#1a1814' }}>
              Term
            </Label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm} disabled={isLoading}>
              <SelectTrigger
                id="term-select"
                className="border-[#c8b99a] bg-white text-[#1a1814]"
              >
                <SelectValue placeholder="Select your term" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#c8b99a]">
                {terms.map((term) => (
                  <SelectItem key={term} value={term} className="text-[#1a1814]">
                    Term {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info Text */}
          <p className="text-xs" style={{ color: '#8a7a62' }}>
            💡 You can update this anytime from your profile. Students and teachers move to new
            classes and terms regularly!
          </p>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedClass || !selectedTerm || isLoading}
            className="w-full mt-6 disabled:opacity-50"
            style={{ backgroundColor: '#1a1814', color: '#FAF8F4' }}
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
