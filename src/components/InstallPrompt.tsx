import { useEffect, useState } from 'react';
import { Icon } from './ui';

interface InstallPromptProps {
  onDismiss?: () => void;
}

export function InstallPrompt({ onDismiss }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
    } catch (e) {
      // matchMedia not supported
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after 3 seconds
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    const appInstalledHandler = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
    } catch (error) {
      console.error('Install error:', error);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onDismiss?.();
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="panel border border-line rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-line bg-raise">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="antenna" size={20} className="text-acc" />
              <h3 className="font-disp text-[14px] font-semibold tracking-wide text-txt">
                Install WiFiSense Lab
              </h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-faint hover:text-txt transition-colors"
              aria-label="Dismiss"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-[12.5px] leading-relaxed text-dim">
            Install WiFiSense Lab on your device for quick access and offline support.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-acc" />
              <span className="text-[11.5px] text-faint">Fast, native-like experience</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-acc" />
              <span className="text-[11.5px] text-faint">Works offline with cached data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-acc" />
              <span className="text-[11.5px] text-faint">Access from home screen</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="btn btn-acc flex-1"
            >
              <Icon name="download" size={14} />
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="btn px-4"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
