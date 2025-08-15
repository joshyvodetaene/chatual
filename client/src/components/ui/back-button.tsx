import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface BackButtonProps {
  to?: string;
  className?: string;
}

export function BackButton({ to = '/', className }: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    setLocation(to);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={className}
      data-testid="button-back"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
}