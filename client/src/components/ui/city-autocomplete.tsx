import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, MapPin, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { validateCityWithGoogleMaps, getCitySuggestions, type CityValidationResult } from '@/lib/geocoding-maps';

interface CityAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  onValidationChange?: (result: CityValidationResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function CityAutocomplete({
  value,
  onValueChange,
  onValidationChange,
  placeholder = "Enter city name...",
  disabled = false,
  className,
  'data-testid': testId
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CityValidationResult | null>(null);
  const [showFreeTextInput, setShowFreeTextInput] = useState(false);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Get suggestions when input changes
  useEffect(() => {
    const getSuggestions = async () => {
      if (inputValue.length >= 2) {
        const results = await getCitySuggestions(inputValue);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  // Validate city when input stops changing
  useEffect(() => {
    const validateCity = async () => {
      if (inputValue.length >= 2) {
        setIsValidating(true);
        const result = await validateCityWithGoogleMaps(inputValue);
        setValidationResult(result);
        onValidationChange?.(result);
        setIsValidating(false);
      } else {
        setValidationResult(null);
        onValidationChange?.({ isValid: false });
      }
    };

    const timeoutId = setTimeout(validateCity, 1000); // Wait 1 second after user stops typing
    return () => clearTimeout(timeoutId);
  }, [inputValue, onValidationChange]);

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onValueChange(selectedValue);
    setOpen(false);
    setShowFreeTextInput(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onValueChange(newValue);
    
    // Show suggestions if we have them, otherwise show free text option
    if (newValue.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleFreeTextConfirm = () => {
    setOpen(false);
    setShowFreeTextInput(false);
  };

  const clearInput = () => {
    setInputValue('');
    onValueChange('');
    setValidationResult(null);
    onValidationChange?.({ isValid: false });
    setOpen(false);
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
    
    if (validationResult?.isValid) {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    
    if (validationResult && !validationResult.isValid && inputValue.length >= 2) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    return null;
  };

  const getValidationMessage = () => {
    if (isValidating) {
      return <span className="text-sm text-gray-500">Validating city...</span>;
    }
    
    if (validationResult?.isValid) {
      return (
        <span className="text-sm text-green-600">
          ✓ {validationResult.city}, {validationResult.country}
        </span>
      );
    }
    
    if (validationResult && !validationResult.isValid && inputValue.length >= 2) {
      return (
        <span className="text-sm text-red-600">
          {validationResult.error}
        </span>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn("pr-20", className)}
              data-testid={testId}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {getValidationIcon()}
              {inputValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-700"
                  onClick={clearInput}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-700"
                disabled={disabled}
              >
                <ChevronsUpDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search cities..."
              value={inputValue}
              onValueChange={handleInputChange}
            />
            <CommandList>
              {suggestions.length === 0 && inputValue.length >= 2 ? (
                <CommandEmpty>
                  <div className="py-4 text-center">
                    <div className="mb-2">
                      <MapPin className="h-8 w-8 mx-auto text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      No suggestions found for "{inputValue}"
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFreeTextConfirm}
                      className="text-xs"
                    >
                      Use "{inputValue}" anyway
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                      We'll validate this city for you
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <>
                  <CommandGroup heading="Suggested Cities">
                    {suggestions.map((city) => (
                      <CommandItem
                        key={city}
                        value={city}
                        onSelect={() => handleSelect(city)}
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        {city}
                        {city === inputValue && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {inputValue.length >= 2 && !suggestions.includes(inputValue) && (
                    <CommandGroup heading="Free Text Entry">
                      <CommandItem
                        value={inputValue}
                        onSelect={handleFreeTextConfirm}
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Use "{inputValue}"
                        <span className="ml-auto text-xs text-gray-500">
                          (will be validated)
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Validation message */}
      <div className="min-h-[20px]">
        {getValidationMessage()}
      </div>
    </div>
  );
}