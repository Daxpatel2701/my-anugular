import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private readonly TOKEN_KEY = 'authToken';
  private platformId = inject(PLATFORM_ID);

  setToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      // Set cookie with 30 days expiration
      const expires = new Date();
      expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
      document.cookie = `${this.TOKEN_KEY}=${token}; expires=${expires.toUTCString()}; path=/`;
    }
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const name = this.TOKEN_KEY + "=";
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookieArray = decodedCookie.split(';');

      for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i].trim();
        if (cookie.indexOf(name) === 0) {
          return cookie.substring(name.length, cookie.length);
        }
      }
    }
    return null;
  }

  removeToken(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.cookie = `${this.TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    }
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}
