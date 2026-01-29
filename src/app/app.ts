import { Component, inject, OnInit } from '@angular/core';
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
  
  token: string = '';
  
  showPatientIframe: boolean = false;
  showStaffIframe: boolean = false;
  patientIframeUrl!: SafeResourceUrl;
  staffIframeUrl!: SafeResourceUrl;
  patientUrl: string = 'http://localhost:3000/patient';
  staffUrl: string = 'http://localhost:3000/staff';

  ngOnInit(): void {
    this.updateIframeUrls();
  }

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
    
    // Update iframe URL and send token when iframe is shown
    if (this.showPatientIframe) {
      this.updateIframeUrls();
      setTimeout(() => this.sendTokenToIframe('patient'), 500);
    }
  }

  toggleStaffIframe(): void {
    this.showStaffIframe = !this.showStaffIframe;
    
    // Update iframe URL and send token when iframe is shown
    if (this.showStaffIframe) {
      this.updateIframeUrls();
      setTimeout(() => this.sendTokenToIframe('staff'), 500);
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
          'http://localhost:3000/'
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
