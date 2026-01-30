import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';

const ONBOARDING_COMPLETED_KEY = 'listo_onboarding_completed';

export function useOnboardingState() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load state from Preferences on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const { value } = await Preferences.get({ key: ONBOARDING_COMPLETED_KEY });
        setHasCompletedOnboarding(value === 'true');
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
        setHasCompletedOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, []);

  // Mark onboarding as completed
  const completeOnboarding = useCallback(async () => {
    try {
      await Preferences.set({
        key: ONBOARDING_COMPLETED_KEY,
        value: 'true',
      });
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, []);

  // Reset onboarding (for testing/debugging)
  const resetOnboarding = useCallback(async () => {
    try {
      await Preferences.remove({ key: ONBOARDING_COMPLETED_KEY });
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
  }, []);

  return {
    hasCompletedOnboarding,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  };
}
