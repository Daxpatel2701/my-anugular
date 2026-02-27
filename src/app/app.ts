import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EnvironmentService } from './environment.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private environmentService = inject(EnvironmentService);
  private sanitizer = inject(DomSanitizer);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  token: string = '';
  
  showPatientIframe: boolean = false;
  showStaffIframe: boolean = false;
  patientIframeUrl!: SafeResourceUrl;
  staffIframeUrl!: SafeResourceUrl;
  patientUrl: string = 'https://fe-react-v1.practeaz.workers.dev/patient';
  staffUrl: string = 'https://fe-react-v1.practeaz.workers.dev/staff';

  ngOnInit(): void {
    this.updateIframeUrls();
    this.setupMessageListener();
  }

  setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Guard against non-object messages (Next.js HMR sends strings, etc.)
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'CLOSE_PATIENT_IFRAME') {
        console.log('Closing patient iframe');
        this.ngZone.run(() => {
          this.showPatientIframe = false;
          this.cdr.detectChanges();
        });
      }

      if (event.data.type === 'CLOSE_STAFF_IFRAME') {
        console.log('Closing staff iframe');
        this.ngZone.run(() => {
          this.showStaffIframe = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // No longer needed — keeping stub so togglePatientIframe/toggleStaffIframe compile
  setupIframeLoadListener(_type: 'patient' | 'staff'): void {}

  updateIframeUrls(): void {
    const token = this.environmentService.getToken();
    
    // Update patient iframe URL
    let patientUrl = this.patientUrl;
    if (token) {
      patientUrl = `${this.patientUrl}?token=${encodeURIComponent(token)}`;
    }
    this.patientIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(patientUrl);
    
    // Update staff iframe URL
    let staffUrl = this.staffUrl;
    if (token) {
      staffUrl = `${this.staffUrl}?token=${encodeURIComponent(token)}`;
    }
    this.staffIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(staffUrl);
  }

  togglePatientIframe(): void {
    this.showPatientIframe = !this.showPatientIframe;
    console.log('togglePatientIframe called - new state:', this.showPatientIframe);
    
    if (this.showPatientIframe) {
      this.updateIframeUrls();
      // Wait for Angular to render the iframe element, then attach listeners
      setTimeout(() => {
        this.sendTokenToIframe('patient');
        this.setupIframeLoadListener('patient');
      }, 500);
    }
  }

  toggleStaffIframe(): void {
    this.showStaffIframe = !this.showStaffIframe;
    console.log('toggleStaffIframe called - new state:', this.showStaffIframe);
    
    if (this.showStaffIframe) {
      this.updateIframeUrls();
      setTimeout(() => {
        this.sendTokenToIframe('staff');
        this.setupIframeLoadListener('staff');
      }, 500);
    }
  }

  sendTokenToIframe(type: 'patient' | 'staff'): void {
    const token = this.environmentService.getToken();
    if (token) {
      const className = type === 'patient' ? '.patient-iframe' : '.staff-iframe';
      const iframe = document.querySelector(className) as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'AUTH_TOKEN', token: token },
          'https://fe-react-v1.practeaz.workers.dev/'
        );
      }
    }
  }

  onLogin(): void {
    if (this.token) {
      // Set the exact token entered in the environment
      this.environmentService.setToken(this.token);
      
      alert(`Token set successfully!`);
      
      // Update both iframe URLs with the new token
      this.updateIframeUrls();
      
      // Clear form
      this.token = '';
    }
  }
}
