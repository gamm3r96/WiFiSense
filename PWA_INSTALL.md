# 📱 PWA Install Feature - WiFiSense Lab

## Overview

WiFiSense Lab is now a **Progressive Web App (PWA)** that can be installed on desktop and mobile devices. Users will see an install prompt popup that allows them to install the app for a native-like experience.

## ✨ Features

### Install Popup
- **Smart Display**: Shows automatically after 3 seconds if the app is installable
- **Non-intrusive**: Can be dismissed and won't show again if already installed
- **Mobile Optimized**: Responsive design works on all screen sizes
- **Clear Benefits**: Explains why users should install the app

### PWA Capabilities
- ✅ **Installable**: Add to home screen on mobile and desktop
- ✅ **Offline Support**: Service worker caches essential files
- ✅ **Fast Loading**: Cached resources load instantly
- ✅ **Native Feel**: Standalone mode without browser UI
- ✅ **App Shortcuts**: Quick access to Dashboard, Live CSI, and Sensors
- ✅ **Theme Integration**: Matches your device's theme colors

## 🎯 How It Works

### For Users

1. **Visit the app** in a supported browser (Chrome, Edge, Safari, Firefox)
2. **Wait 3 seconds** - the install popup appears automatically
3. **Click "Install Now"** to install the app
4. **Access from home screen** like a native app

### For Developers

The install prompt uses the browser's `beforeinstallprompt` event:

```typescript
// Listen for install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
  
  // Show popup after 3 seconds
  setTimeout(() => setShowPrompt(true), 3000);
});

// Handle install
const handleInstall = async () => {
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  // Handle user's choice
};
```

## 📦 PWA Files

### Manifest (`public/manifest.json`)
Defines app metadata, icons, and behavior:
- App name and description
- Theme colors
- Display mode (standalone)
- Icons for different sizes
- App shortcuts

### Service Worker (`public/sw.js`)
Handles offline caching:
- Caches essential files on install
- Serves cached content when offline
- Updates cache when new versions available
- Cleans up old caches

### Icons
- `public/icon.svg` - Vector icon (scalable)
- Referenced in manifest for different sizes

## 🚀 Installation Guide

### Desktop (Chrome/Edge)
1. Look for install icon in address bar
2. Or wait for the popup to appear
3. Click "Install"
4. App opens in standalone window

### Mobile (Android)
1. Open in Chrome
2. Tap "Install" in popup or menu
3. Confirm installation
4. App icon appears on home screen

### Mobile (iOS Safari)
1. Open in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Confirm addition
5. App icon appears on home screen

## 🔧 Configuration

### Customize Install Timing

Edit `src/components/InstallPrompt.tsx`:

```typescript
// Change delay before showing prompt (default: 3000ms)
const timer = setTimeout(() => {
  setShowPrompt(true);
}, 3000); // Change this value
```

### Customize Popup Content

Edit the JSX in `InstallPrompt.tsx`:

```typescript
<div className="p-4 space-y-4">
  <p className="text-sm text-dim">
    Your custom message here
  </p>
  {/* Add more content */}
</div>
```

### Update App Icons

1. Replace `public/icon.svg` with your icon
2. Update `public/manifest.json` with new icon paths
3. Add PNG versions for better compatibility:
   - `public/icon-192.png` (192x192)
   - `public/icon-512.png` (512x512)

## 🧪 Testing

### Test Install Prompt

1. Open DevTools (F12)
2. Go to Application tab
3. Clear storage (Application > Clear storage)
4. Reload the page
5. Wait 3 seconds for popup

### Test Offline Mode

1. Open DevTools
2. Go to Application tab
3. Check "Offline" checkbox
4. Reload the page
5. App should still work with cached data

### Test on Mobile

1. Deploy to a server (PWA requires HTTPS)
2. Open on mobile device
3. Install prompt should appear
4. Install and test from home screen

## 📊 Browser Support

| Browser | Install Support | Notes |
|---------|----------------|-------|
| Chrome | ✅ Full | Desktop & Android |
| Edge | ✅ Full | Desktop |
| Safari | ✅ Partial | iOS only, manual install |
| Firefox | ✅ Partial | Desktop only |
| Samsung Internet | ✅ Full | Android |

## 🔒 Security Requirements

PWA features require:
- ✅ **HTTPS** (except localhost for development)
- ✅ **Valid SSL certificate**
- ✅ **Service Worker support**

## 📝 Manifest Configuration

### Key Properties

```json
{
  "name": "WiFiSense Lab",           // Full app name
  "short_name": "WiFiSense",         // Home screen name
  "start_url": "/",                  // Launch URL
  "display": "standalone",           // App mode
  "background_color": "#0a0e14",     // Splash screen color
  "theme_color": "#3ce6a4"           // Status bar color
}
```

### Display Modes

- `standalone` - Looks like native app (recommended)
- `fullscreen` - Hides all browser UI
- `minimal-ui` - Minimal browser controls
- `browser` - Opens in browser tab

## 🎨 Customization

### Change Theme Color

Edit `public/manifest.json`:
```json
{
  "theme_color": "#your-color"
}
```

Also update `index.html`:
```html
<meta name="theme-color" content="#your-color" />
```

### Add Screenshots

Add screenshots to manifest for app stores:
```json
{
  "screenshots": [
    {
      "src": "/screenshot1.png",
      "sizes": "1280x720",
      "type": "image/png"
    }
  ]
}
```

## 🐛 Troubleshooting

### Install Prompt Not Showing

1. **Check HTTPS**: PWA requires secure context
2. **Clear Cache**: DevTools > Application > Clear storage
3. **Check Manifest**: Validate at https://manifest-validator.com
4. **Check Console**: Look for service worker errors

### Icons Not Displaying

1. **Verify Paths**: Icons must be accessible at specified paths
2. **Check Sizes**: Provide 192x192 and 512x512 versions
3. **Clear Cache**: Browser may cache old icons

### Service Worker Issues

```bash
# Unregister service worker in DevTools
# Application > Service Workers > Unregister

# Clear cache
# Application > Storage > Clear site data
```

## 📈 Best Practices

### Do's
- ✅ Test on multiple devices
- ✅ Provide clear install instructions
- ✅ Use high-quality icons
- ✅ Test offline functionality
- ✅ Update version in service worker when deploying

### Don'ts
- ❌ Don't force install (respect user choice)
- ❌ Don't show popup immediately (wait for engagement)
- ❌ Don't cache sensitive data
- ❌ Don't forget to update cache version

## 🔄 Updates

When you deploy updates:

1. **Update cache version** in `public/sw.js`:
```javascript
const CACHE_NAME = 'wifisense-lab-v1.2.0'; // Increment version
```

2. **Service worker will**:
   - Detect new version
   - Clean old caches
   - Cache new files
   - Activate new worker

## 📚 Additional Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web App Manifest](https://web.dev/add-manifest/)
- [Service Workers](https://developers.google.com/web/fundamentals/primers/service-workers)
- [PWA Builder](https://www.pwabuilder.com/) - Test your PWA

## 🎉 Success Metrics

Track PWA adoption:
- Install rate (accepted vs dismissed)
- Offline usage
- Time spent in app
- Return visits from home screen

---

**Status**: ✅ Production Ready  
**Version**: 1.1.0  
**PWA Features**: Install, Offline, Standalone Mode
