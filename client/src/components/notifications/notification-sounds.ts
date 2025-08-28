// Notification sound management
export class NotificationSounds {
  private static instance: NotificationSounds;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  
  private constructor() {
    this.initializeSounds();
  }
  
  static getInstance(): NotificationSounds {
    if (!NotificationSounds.instance) {
      NotificationSounds.instance = new NotificationSounds();
    }
    return NotificationSounds.instance;
  }
  
  private initializeSounds() {
    // Create audio elements for different notification types
    const soundConfigs = [
      { type: 'message', url: this.generateTone(800, 0.3, 0.2) },
      { type: 'mention', url: this.generateTone(1000, 0.5, 0.3) },
      { type: 'reaction', url: this.generateTone(600, 0.2, 0.15) },
      { type: 'system', url: this.generateTone(400, 0.4, 0.25) },
      { type: 'urgent', url: this.generateTone(1200, 0.7, 0.4) },
    ];
    
    soundConfigs.forEach(({ type, url }) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.6;
      this.sounds.set(type, audio);
    });
  }
  
  private generateTone(frequency: number, volume: number, duration: number): string {
    // Generate a simple tone using Web Audio API and convert to data URL
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const numSamples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      // Create a simple sine wave with fade out
      const fadeOut = 1 - (time / duration);
      data[i] = Math.sin(2 * Math.PI * frequency * time) * volume * fadeOut;
    }
    
    // Convert buffer to WAV data URL (simplified implementation)
    return this.bufferToWav(buffer);
  }
  
  private bufferToWav(buffer: AudioBuffer): string {
    // Simplified WAV generation - in a real app you'd use a proper library
    // For now, return a simple beep sound data URL
    return "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DqzG1ACSl+0PLseDIGLYXJ8tiOOgkZZrTm4aMQDVKm5O2rbCEGNIjQ8diKOAkZYq7n3ZZOCg==";
  }
  
  async playSound(type: string, settings?: { volume?: number; enabled?: boolean }) {
    if (settings?.enabled === false) {
      return;
    }
    
    const audio = this.sounds.get(type) || this.sounds.get('message');
    if (!audio) {
      return;
    }
    
    try {
      // Reset audio to beginning
      audio.currentTime = 0;
      
      // Set volume
      if (settings?.volume !== undefined) {
        audio.volume = Math.max(0, Math.min(1, settings.volume / 100));
      }
      
      // Play the sound
      await audio.play();
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
      // Ignore errors - some browsers block autoplay
    }
  }
  
  setVolume(type: string, volume: number) {
    const audio = this.sounds.get(type);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }
  
  setGlobalVolume(volume: number) {
    const normalizedVolume = Math.max(0, Math.min(1, volume / 100));
    this.sounds.forEach(audio => {
      audio.volume = normalizedVolume;
    });
  }
  
  // Test a notification sound
  testSound(type: string) {
    this.playSound(type, { enabled: true, volume: 60 });
  }
}