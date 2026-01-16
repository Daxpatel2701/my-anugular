# Angular Floating Button with Iframe Integration Guide

This guide explains how to implement floating buttons with embedded iframes and token authentication in an Angular application.

## Table of Contents
1. [Overview](#overview)
2. [Token Lifecycle & Flow](#token-lifecycle--flow)
3. [Prerequisites](#prerequisites)
4. [Implementation Steps](#implementation-steps)
5. [Token Passing Methods](#token-passing-methods)
6. [Code Reference](#code-reference)

---

## Overview

This implementation provides:
- **Floating action buttons** fixed at the bottom-right of the screen
- **Popup iframes** that appear when buttons are clicked
- **Token authentication** passed to iframe content
- **Smooth animations** for showing/hiding iframes
- **Responsive design** for mobile devices

---

## Token Lifecycle & Flow

This section explains the complete journey of the authentication token from its source to the iframe.

### 🔑 Token Name

**Cookie Name**: `authToken`  
**Key Constant**: `TOKEN_KEY = 'authToken'` (defined in `EnvironmentService`)

### 📍 Where the Token Comes From

The token can originate from various sources:

1. **User Login Form**: User enters token manually through a login form
2. **API Response**: Backend authentication endpoint returns token after login
3. **OAuth/SSO Provider**: Token received from third-party authentication service
4. **External System**: Token provided by another application or service

In this implementation, the token is:
- **Entered by the user** through a login form input field
- **Stored in browser cookies** for persistence across page reloads
- **Valid for 30 days** from the time it's set

### 🔄 Token Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TOKEN SOURCE                                             │
│    • User enters token in login form                        │
│    • OR: API returns token after authentication             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TOKEN STORAGE (EnvironmentService)                       │
│    • setToken() stores in browser cookie                    │
│    • Cookie name: "authToken"                               │
│    • Expiration: 30 days                                    │
│    • Path: "/" (available to all pages)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. TOKEN RETRIEVAL                                          │
│    • getToken() reads from cookie                           │
│    • Returns string or null                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. TOKEN TRANSMISSION TO IFRAME (Dual Method)               │
│    ┌──────────────────────┬──────────────────────┐         │
│    │ Method A:            │ Method B:            │         │
│    │ URL Parameter        │ postMessage API      │         │
│    │ ?token=xxxxx         │ {type, token}        │         │
│    └──────────────────────┴──────────────────────┘         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. IFRAME RECEIVES TOKEN                                    │
│    • Reads URL parameter: URLSearchParams                   │
│    • Listens to postMessage: window.addEventListener        │
└─────────────────────────────────────────────────────────────┘
```

### 📝 How to Set the Token

**Step 1**: Obtain token from your authentication source
```typescript
// Example: After successful login API call
const token = 'your-jwt-token-here-abc123xyz789';
```

**Step 2**: Store token using `EnvironmentService`
```typescript
import { EnvironmentService } from './environment.service';

export class LoginComponent {
  private environmentService = inject(EnvironmentService);
  
  onLogin(): void {
    const token = this.token; // From form input or API response
    
    // Store token in cookie
    this.environmentService.setToken(token);
    
    console.log('Token stored successfully!');
  }
}
```

**Step 3**: Token is now automatically available to iframe components
```typescript
// Token is retrieved and passed to iframe automatically
const token = this.environmentService.getToken(); // Reads from cookie
```

### 🚀 How Token is Passed to Iframe

Once stored, the token is sent to the iframe using **two methods simultaneously**:

#### Method A: URL Query Parameter
```typescript
// In updateIframeUrls()
const token = this.environmentService.getToken(); // Get from cookie
let iframeUrl = `http://localhost:3000/patient?token=${encodeURIComponent(token)}`;
```

The iframe URL becomes: `http://localhost:3000/patient?token=abc123xyz789`

#### Method B: PostMessage API
```typescript
// In sendTokenToIframe()
iframe.contentWindow.postMessage(
  { 
    type: 'AUTH_TOKEN',  // Message identifier
    token: token         // The actual token value
  },
  'http://localhost:3000' // Target origin for security
);
```

### 📥 How Iframe Receives the Token

The iframe application must implement **both receivers**:

**Receiver A: Read from URL**
```javascript
// Inside iframe application
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token'); // Key name: 'token'
console.log('Token from URL:', token);
```

**Receiver B: Listen to postMessage**
```javascript
// Inside iframe application
window.addEventListener('message', (event) => {
  // Verify sender origin
  if (event.origin !== 'http://localhost:4200') return;
  
  // Check message type
  if (event.data.type === 'AUTH_TOKEN') {
    const token = event.data.token;
    console.log('Token from postMessage:', token);
    
    // Use token for API calls, store locally, etc.
    localStorage.setItem('authToken', token);
  }
});
```

### 🔒 Token Storage Location

**In Angular App (Parent Window)**:
- **Location**: Browser Cookie
- **Name**: `authToken`
- **Lifetime**: 30 days
- **Scope**: All pages in the same domain
- **Access**: Via `EnvironmentService.getToken()`

**In Iframe (Child Window)**:
- **Location**: Recommended to use `localStorage` or `sessionStorage`
- **Name**: Your choice (e.g., `authToken`)
- **Lifetime**: Depends on your implementation
- **Access**: Direct access via `localStorage.getItem('authToken')`

### ⚡ Quick Reference

| Aspect | Details |
|--------|--------|
| **Token Name** | `authToken` |
| **Storage Type** | Browser Cookie |
| **Expiration** | 30 days |
| **Set Token** | `environmentService.setToken(token)` |
| **Get Token** | `environmentService.getToken()` |
| **Remove Token** | `environmentService.removeToken()` |
| **Pass Method 1** | URL parameter: `?token=xxxxx` |
| **Pass Method 2** | postMessage: `{type: 'AUTH_TOKEN', token}` |
| **Iframe Receives 1** | `URLSearchParams.get('token')` |
| **Iframe Receives 2** | `event.data.token` in message listener |

---

## Prerequisites

Before implementing, ensure your Angular project has:

```json
{
  "dependencies": {
    "@angular/common": "^20.0.0",
    "@angular/core": "^20.0.0",
    "@angular/forms": "^20.0.0",
    "@angular/platform-browser": "^20.0.0"
  }
}
```

---

## Implementation Steps

### Step 1: Create Token Management Service

Create `src/app/environment.service.ts`:

**Purpose**: Manages the authentication token lifecycle - storing, retrieving, and removing tokens.

**Token Details**:
- **Cookie Name**: `authToken` (defined by `TOKEN_KEY` constant)
- **Storage**: Browser cookies (accessible across all pages)
- **Expiration**: 30 days from the time token is set

```typescript
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  // Token is stored in cookie with this name
  private readonly TOKEN_KEY = 'authToken';

  /**
   * Stores the authentication token in a browser cookie
   * @param token - The authentication token string to store
   * Cookie name: 'authToken'
   * Expiration: 30 days from now
   */
  setToken(token: string): void {
    // Set cookie with 30 days expiration
    const expires = new Date();
    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
    document.cookie = `${this.TOKEN_KEY}=${token}; expires=${expires.toUTCString()}; path=/`;
  }

  /**
   * Retrieves the authentication token from browser cookie
   * @returns The token string if found, null otherwise
   * Reads from cookie named: 'authToken'
   */
  getToken(): string | null {
    const name = this.TOKEN_KEY + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let i = 0; i < cookieArray.length; i++) {
      let cookie = cookieArray[i].trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return null;
  }

  removeToken(): void {
    document.cookie = `${this.TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}
```

**Purpose**: Manages authentication tokens using browser cookies.

---

### Step 2: Add Component TypeScript Logic

Update your component file (e.g., `src/app/app.ts`):

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EnvironmentService } from './environment.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private environmentService = inject(EnvironmentService);
  private sanitizer = inject(DomSanitizer);
  
  // State management
  showPatientIframe: boolean = false;
  showStaffIframe: boolean = false;
  patientIframeUrl!: SafeResourceUrl;
  staffIframeUrl!: SafeResourceUrl;
  
  // Configure your iframe URLs here
  patientUrl: string = 'http://localhost:3000/patient';
  staffUrl: string = 'http://localhost:3000/staff';

  ngOnInit(): void {
    this.updateIframeUrls();
  }

  /**
   * Updates iframe URLs with authentication token from cookie
   * 
   * Flow:
   * 1. Retrieves token from cookie (name: 'authToken')
   * 2. Appends token as URL query parameter: ?token=xxxxx
   * 3. Sanitizes URL for Angular security
   */
  updateIframeUrls(): void {
    // Get token from cookie storage
    const token = this.environmentService.getToken();
    
    // Add token as URL parameter
    let patientUrl = this.patientUrl;
    if (token) {
      patientUrl = `${this.patientUrl}?token=${encodeURIComponent(token)}`;
    }
    this.patientIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(patientUrl);
    
    let staffUrl = this.staffUrl;
    if (token) {
      staffUrl = `${this.staffUrl}?token=${encodeURIComponent(token)}`;
    }
    this.staffIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(staffUrl);
  }

  /**
   * Toggles patient iframe visibility
   */
  togglePatientIframe(): void {
    this.showPatientIframe = !this.showPatientIframe;
    
    if (this.showPatientIframe) {
      this.updateIframeUrls();
      // Send token via postMessage after iframe loads
      setTimeout(() => this.sendTokenToIframe('patient'), 500);
    }
  }

  /**
   * Toggles staff iframe visibility
   */
  toggleStaffIframe(): void {
    this.showStaffIframe = !this.showStaffIframe;
    
    if (this.showStaffIframe) {
      this.updateIframeUrls();
      // Send token via postMessage after iframe loads
      setTimeout(() => this.sendTokenToIframe('staff'), 500);
    }
  }

  /**
   * Sends authentication token to iframe using postMessage API
   * 
   * @param type - Type of iframe ('patient' or 'staff')
   * 
   * Process:
   * 1. Retrieves token from cookie (name: 'authToken')
   * 2. Finds iframe element in DOM
   * 3. Sends message with structure: { type: 'AUTH_TOKEN', token: 'xxx' }
   * 4. Target origin must match iframe URL for security
   */
  sendTokenToIframe(type: 'patient' | 'staff'): void {
    // Get token from cookie storage
    const token = this.environmentService.getToken();
    if (token) {
      const className = type === 'patient' ? '.patient-iframe' : '.staff-iframe';
      const iframe = document.querySelector(className) as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { 
            type: 'AUTH_TOKEN',  // Message identifier for iframe to recognize
            token: token         // The actual token value from 'authToken' cookie
          },
          'http://localhost:3000' // Target origin - MUST match iframe URL
        );
      }
    }
  }
}
```

**Key Points**:
- `DomSanitizer` is required to bypass Angular's security for external URLs
- `setTimeout` gives iframe time to load before sending postMessage
- `encodeURIComponent` prevents special characters from breaking the URL

---

### Step 3: Add HTML Template

Add to your template file (e.g., `src/app/app.html`):

```html
<!-- Floating Button for Patient -->
<button class="chat-button patient-button" (click)="togglePatientIframe()">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.93 6 15.5 7.57 15.5 9.5C15.5 11.43 13.93 13 12 13C10.07 13 8.5 11.43 8.5 9.5C8.5 7.57 10.07 6 12 6ZM12 20C9.97 20 8.11 19.16 6.74 17.82C8.47 16.42 10.63 15.5 13 15.5C15.37 15.5 17.53 16.42 19.26 17.82C17.89 19.16 16.03 20 12 20Z" fill="currentColor"/>
  </svg>
</button>

<!-- Floating Button for Staff -->
<button class="chat-button staff-button" (click)="toggleStaffIframe()">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM13.5 13C13.5 11.62 12.88 10.38 11.88 9.63C12.57 9.09 13.45 8.75 14.42 8.75C16.46 8.75 18.08 10.37 18.08 12.42C18.08 13.39 17.74 14.27 17.2 14.96C15.96 13.96 14.43 13.36 12.75 13.15C13.21 12.82 13.5 12.45 13.5 13ZM9 12C10.66 12 12 10.66 12 9C12 7.34 10.66 6 9 6C7.34 6 6 7.34 6 9C6 10.66 7.34 12 9 12ZM9 14C6.67 14 2 15.17 2 17.5V19H16V17.5C16 15.17 11.33 14 9 14Z" fill="currentColor"/>
  </svg>
</button>

<!-- Patient Iframe Popup -->
<div class="chatbox-popup patient-popup" [class.show]="showPatientIframe">
  <button class="close-button" (click)="togglePatientIframe()">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
  <iframe [src]="patientIframeUrl" frameborder="0" class="patient-iframe"></iframe>
</div>

<!-- Staff Iframe Popup -->
<div class="chatbox-popup staff-popup" [class.show]="showStaffIframe">
  <button class="close-button" (click)="toggleStaffIframe()">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
  <iframe [src]="staffIframeUrl" frameborder="0" class="staff-iframe"></iframe>
</div>
```

**Template Features**:
- `[class.show]` conditionally applies CSS class for visibility
- `[src]` binds sanitized URL to iframe
- Close button with X icon to hide iframe

---

### Step 4: Add CSS Styling

Add to your styles file (e.g., `src/app/app.css`):

```css
/* Floating Action Buttons */
.chat-button {
  position: fixed;
  bottom: 20px;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.patient-button {
  right: 100px; /* Position for first button */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.staff-button {
  right: 20px; /* Position for second button */
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.chat-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
}

/* Iframe Popup Container */
.chatbox-popup {
  position: fixed;
  bottom: 90px; /* Positioned above the button */
  width: 950px;
  height: 600px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  transform: translateY(20px) scale(0.95); /* Initial state for animation */
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 999;
  overflow: hidden;
}

.patient-popup {
  right: 100px; /* Aligns with patient button */
}

.staff-popup {
  right: 20px; /* Aligns with staff button */
}

/* Show state - triggered by [class.show] binding */
.chatbox-popup.show {
  transform: translateY(0) scale(1);
  opacity: 1;
  visibility: visible;
}

/* Close Button */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1001; /* Above iframe */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.close-button:active {
  transform: scale(0.95);
}

/* Iframe Styling */
.patient-iframe,
.staff-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .chatbox-popup {
    width: calc(100vw - 40px); /* Full width with margins */
    height: 70vh;
    bottom: 90px;
    right: 20px;
    left: 20px;
  }
  
  .patient-popup,
  .staff-popup {
    right: 20px;
  }
}
```

**CSS Architecture**:
- `position: fixed` keeps buttons always visible
- `transform` and `opacity` create smooth show/hide animations
- `z-index` layering ensures proper stacking order
- Media queries handle mobile responsiveness

---

## Token Passing Methods

This implementation uses **BOTH** methods for maximum compatibility:

### Method 1: URL Query Parameter

**Token Source**: Retrieved from browser cookie named `authToken` via `environmentService.getToken()`

**How it works**:
```typescript
// Token is fetched from cookie and added to URL
const token = this.environmentService.getToken(); // From 'authToken' cookie
patientUrl = `${this.patientUrl}?token=${encodeURIComponent(token)}`;
// Result: http://localhost:3000/patient?token=abc123xyz789
```

**Receiving side (inside iframe)**:
```javascript
// Parse token from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token'); // Get value of 'token' parameter
console.log('Token from URL:', token);

// Store for later use
localStorage.setItem('authToken', token);
```

**Pros**:
- ✅ Token available immediately when iframe loads
- ✅ Simple to implement
- ✅ Works with static pages

**Cons**:
- ❌ Token visible in browser URL/history
- ❌ Less secure (appears in logs)
- ❌ Cannot update token without reloading iframe

---

### Method 2: PostMessage API

**Token Source**: Retrieved from browser cookie named `authToken` via `environmentService.getToken()`

**How it works**:
```typescript
// Token is fetched from cookie and sent via postMessage
const token = this.environmentService.getToken(); // From 'authToken' cookie
iframe.contentWindow.postMessage(
  { 
    type: 'AUTH_TOKEN',  // Message type identifier
    token: token         // Token value from cookie
  },
  'http://localhost:3000' // Must match iframe origin
);
```

**Message Structure**:
```javascript
{
  type: 'AUTH_TOKEN',        // Identifies this as an auth token message
  token: 'abc123xyz789...'   // The actual JWT or token string
}
```

**Receiving side (inside iframe)**:
```javascript
// Listen for messages from parent window
window.addEventListener('message', (event) => {
  // Security: Verify the origin (parent window URL)
  if (event.origin !== 'http://localhost:4200') {
    console.warn('Rejected message from unauthorized origin:', event.origin);
    return; // Reject messages from unknown sources
  }
  
  // Check message type identifier
  if (event.data.type === 'AUTH_TOKEN') {
    const token = event.data.token; // Extract token from message
    console.log('Token from postMessage:', token);
    
    // Store token in localStorage, sessionStorage, or use directly
    localStorage.setItem('authToken', token);
  }
});
```

**Pros**:
- ✅ More secure (not visible in URL)
- ✅ Can update token dynamically without reload
- ✅ Better for sensitive data

**Cons**:
- ❌ Requires iframe to be loaded first (hence the `setTimeout`)
- ❌ More complex to implement
- ❌ Requires message listener in iframe

---

## Security Considerations

### 1. Origin Validation
Always validate the message origin in your iframe:

```javascript
window.addEventListener('message', (event) => {
  // CRITICAL: Verify sender's origin
  if (event.origin !== 'http://localhost:4200') {
    console.warn('Rejected message from:', event.origin);
    return;
  }
  // Process message...
});
```

### 2. Content Security Policy (CSP)
Add CSP headers to restrict iframe sources:

```html
<!-- In index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="frame-src http://localhost:3000;">
```

### 3. Token Storage
- Use **httpOnly cookies** for production (requires server-side handling)
- Avoid storing sensitive tokens in localStorage (vulnerable to XSS)
- Consider token expiration and refresh mechanisms

---

## Customization Guide

### Change Button Position
```css
.chat-button {
  bottom: 20px;  /* Distance from bottom */
  right: 20px;   /* Distance from right */
}
```

### Change Popup Size
```css
.chatbox-popup {
  width: 950px;  /* Popup width */
  height: 600px; /* Popup height */
}
```

### Change Animation Duration
```css
.chatbox-popup {
  transition: all 0.3s ease; /* Change 0.3s to your preference */
}
```

### Modify Button Icons
Replace the SVG content inside the button elements with your custom icons.

---

## Troubleshooting

### Issue: Iframe not loading
**Solution**: Check browser console for CORS errors. Ensure iframe URL is accessible and allows embedding.

### Issue: postMessage not working
**Solution**: 
1. Verify the target origin matches exactly
2. Ensure iframe has finished loading (increase `setTimeout` delay if needed)
3. Check iframe's message listener is set up correctly

### Issue: Token not received in iframe
**Solution**:
1. Verify token exists in cookies (check `EnvironmentService.getToken()`)
2. Check browser console for errors
3. Use browser DevTools to inspect postMessage events

### Issue: Iframe shows "Refused to frame" error
**Solution**: The target site has `X-Frame-Options` header set. Contact the iframe site owner to allow your domain.

---

## Production Checklist

Before deploying to production:

- [ ] Replace `http://localhost:3000` with production URLs
- [ ] Update `http://localhost:4200` origin validation
- [ ] Implement proper SSL/TLS (use `https://`)
- [ ] Add error handling for failed token retrieval
- [ ] Test on multiple browsers and devices
- [ ] Implement token refresh mechanism
- [ ] Add loading state for iframes
- [ ] Set up proper logging and monitoring
- [ ] Review and test security policies

---

## Complete File Structure

```
src/
├── app/
│   ├── app.ts                    # Component logic
│   ├── app.html                  # Template with buttons and iframes
│   ├── app.css                   # Styling
│   └── environment.service.ts    # Token management service
```

---

## Additional Resources

- [Angular DomSanitizer Documentation](https://angular.io/api/platform-browser/DomSanitizer)
- [Window.postMessage() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Content Security Policy - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Same-Origin Policy - MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)

---

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify all URLs and origins match your environment
4. Test postMessage communication independently

---

**Last Updated**: December 30, 2025  
**Angular Version**: 20.3.0  
**Author**: Implementation Guide
