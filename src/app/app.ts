import { Component, inject, OnInit, NgZone, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EnvironmentService } from './environment.service';

type PatientSearchForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  motherName: string;
  mobileNumber: string;
  patientId: string;
  exactMatch: boolean;
};

type PatientSearchRecord = {
  patientId: string;
  hospitalPatientId: string;
  patientGuid: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  mobileNumber: string;
  dob?: string;
  age?: string;
  gender?: string;
  displayLabel: string;
  raw: Record<string, unknown>;
};

type PatientSearchApiPayload = {
  exactMatch: boolean;
  nHospitalBranchId: number;
  sSearchPatientFirstName: string;
  sSearchPatientMiddleName: string;
  sSearchPatientLastName: string;
  sSearchPatientMotherName: string;
  sSearchMobileNumber: string;
  nSearchPatientId: string;
};

const PATIENT_SEARCH_API_URL =
  'https://testpracteaz.azurewebsites.net/api/Patient/AdvanceSearchPatientByFilterText';
const DEFAULT_BRANCH_ID = 20;
const IFRAME_MESSAGE_PATIENT_SELECTION = 'PATIENT_SELECTION';
const IFRAME_MESSAGE_REQUEST_PATIENT_SELECTION = 'REQUEST_PATIENT_SELECTION';
const IFRAME_AUTH_MESSAGE = 'AUTH_TOKEN';
const INITIAL_PATIENT_SEARCH_FORM: PatientSearchForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  motherName: '',
  mobileNumber: '',
  patientId: '',
  exactMatch: false
};

function firstNonEmptyString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) {
      continue;
    }
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function looksLikePatientRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Boolean(
    firstNonEmptyString(record, [
      'patientId',
      'patient_id',
      'PatientId',
      'patientFirstName',
      'patient_first_name',
      'patientLastName',
      'patient_last_name',
      'hospitalPatientId',
      'hospital_patient_id',
      'mobileNumber',
      'mobile_number'
    ])
  );
}

function collectPatientArrays(node: unknown, visited = new WeakSet<object>()): Record<string, unknown>[][] {
  if (!node) {
    return [];
  }

  if (Array.isArray(node)) {
    if (node.some((item) => looksLikePatientRecord(item))) {
      return [node.filter((item): item is Record<string, unknown> => looksLikePatientRecord(item))];
    }
    return node.flatMap((item) => collectPatientArrays(item, visited));
  }

  if (typeof node !== 'object') {
    return [];
  }

  if (visited.has(node as object)) {
    return [];
  }
  visited.add(node as object);

  const arrays: Record<string, unknown>[][] = [];
  for (const value of Object.values(node as Record<string, unknown>)) {
    arrays.push(...collectPatientArrays(value, visited));
  }
  return arrays;
}

function normalizePatientRecords(response: unknown): PatientSearchRecord[] {
  const rows = collectPatientArrays(response).flat();
  const seen = new Set<string>();
  const normalizedRecords: PatientSearchRecord[] = [];

  for (const record of rows) {
    const patientId = firstNonEmptyString(record, ['patientId', 'patient_id', 'PatientId', 'id']);
    const hospitalPatientId = firstNonEmptyString(record, [
      'hospitalPatientId',
      'hospital_patient_id',
      'hospitalPatientID',
      'hospital_patient_ID',
      'hospitalPatientNo'
    ]);
    const firstName = firstNonEmptyString(record, ['patientFirstName', 'patient_first_name', 'firstName']);
    const middleName = firstNonEmptyString(record, ['patientMiddleName', 'patient_middle_name', 'middleName']);
    const lastName = firstNonEmptyString(record, ['patientLastName', 'patient_last_name', 'lastName']);
    const mobileNumber = firstNonEmptyString(record, [
      'mobileNumber',
      'mobile_number',
      'sMobileNumber',
      'mobile',
      'phoneNumber'
    ]);
    const patientGuid = firstNonEmptyString(record, ['patientGuid', 'patient_guid']);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || 'Patient';
    const identity = hospitalPatientId || patientId || fullName;

    if (!identity) {
      continue;
    }

    const displayLabel = [
      fullName,
      mobileNumber ? `[${mobileNumber}]` : '',
      hospitalPatientId || patientId ? `[${hospitalPatientId || patientId}]` : ''
    ]
      .filter(Boolean)
      .join(' ');
    const key = hospitalPatientId || patientId || displayLabel;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedRecords.push({
      patientId: patientId || hospitalPatientId,
      hospitalPatientId: hospitalPatientId || patientId,
      patientGuid,
      firstName,
      middleName,
      lastName,
      fullName,
      mobileNumber,
      dob: normalizeOptionalText(
        firstNonEmptyString(record, ['dob', 'dateOfBirth', 'date_of_birth', 'patientDob', 'patient_dob'])
      ),
      age: normalizeOptionalText(firstNonEmptyString(record, ['age', 'patientAge', 'patient_age'])),
      gender: normalizeOptionalText(firstNonEmptyString(record, ['gender', 'Gender', 'sex', 'Sex', 'sGender'])),
      displayLabel,
      raw: record
    });
  }

  return normalizedRecords;
}

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
  private platformId = inject(PLATFORM_ID);

  token = '';

  showPatientIframe = false;
  showStaffIframe = false;
  patientIframeUrl!: SafeResourceUrl;
  staffIframeUrl!: SafeResourceUrl;
  patientUrl = 'https://vatsalyacare.ai/patient';
  staffUrl = 'https://vatsalyacare.ai/doctor';

  isPatientSearchDialogOpen = false;
  patientSearchForm: PatientSearchForm = { ...INITIAL_PATIENT_SEARCH_FORM };
  patientSearchResults: PatientSearchRecord[] = [];
  selectedPatient: PatientSearchRecord | null = null;
  isSearchingPatients = false;
  patientSearchError = '';
  readonly patientSearchBranchId = DEFAULT_BRANCH_ID;

  ngOnInit(): void {
    this.updateIframeUrls();
    if (this.isBrowser()) {
      this.setupMessageListener();
    }

    const storedToken = this.environmentService.getToken();
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setupMessageListener(): void {
    if (!this.isBrowser()) {
      return;
    }

    window.addEventListener('message', (event) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'CLOSE_PATIENT_IFRAME') {
        this.ngZone.run(() => {
          this.showPatientIframe = false;
          this.cdr.detectChanges();
        });
      }

      if (event.data.type === 'CLOSE_STAFF_IFRAME') {
        this.ngZone.run(() => {
          this.showStaffIframe = false;
          this.cdr.detectChanges();
        });
      }

      if (event.data.type === IFRAME_MESSAGE_REQUEST_PATIENT_SELECTION) {
        this.replyWithSelectedPatient(event.source, event.origin);
      }
    });
  }

  setupIframeLoadListener(type: 'patient' | 'staff'): void {
    if (!this.isBrowser()) {
      return;
    }

    const iframe = this.getIframeElement(type);
    if (!iframe) {
      return;
    }

    iframe.addEventListener(
      'load',
      () => {
        this.sendTokenToIframe(type);
        if (type === 'staff') {
          this.sendSelectedPatientToIframe();
        }
      },
      { once: true }
    );
  }

  updateIframeUrls(): void {
    const token = this.environmentService.getToken();

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

  togglePatientIframe(): void {
    this.showPatientIframe = !this.showPatientIframe;

    if (this.showPatientIframe) {
      this.updateIframeUrls();
      this.setupIframeLoadListener('patient');
      setTimeout(() => {
        this.sendTokenToIframe('patient');
      }, 500);
    }
  }

  toggleStaffIframe(): void {
    this.showStaffIframe = !this.showStaffIframe;

    if (this.showStaffIframe) {
      this.updateIframeUrls();
      this.setupIframeLoadListener('staff');
      setTimeout(() => {
        this.sendTokenToIframe('staff');
        this.sendSelectedPatientToIframe();
      }, 500);
    }
  }

  sendTokenToIframe(type: 'patient' | 'staff'): void {
    if (!this.isBrowser()) {
      return;
    }

    const token = this.environmentService.getToken();
    if (!token) {
      return;
    }

    const iframe = this.getIframeElement(type);
    const targetOrigin = this.getIframeTargetOrigin(type);
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: IFRAME_AUTH_MESSAGE, token }, targetOrigin);
    }
  }

  onLogin(): void {
    const trimmedToken = this.token.trim();
    if (!trimmedToken) {
      return;
    }

    this.environmentService.setToken(trimmedToken);
    this.updateIframeUrls();
    this.token = '';

    if (this.showPatientIframe || this.showStaffIframe) {
      setTimeout(() => {
        if (this.showPatientIframe) {
          this.sendTokenToIframe('patient');
        }
        if (this.showStaffIframe) {
          this.sendTokenToIframe('staff');
          this.sendSelectedPatientToIframe();
        }
      }, 250);
    }
  }

  openPatientSearchDialog(): void {
    this.patientSearchError = '';
    this.isPatientSearchDialogOpen = true;
  }

  closePatientSearchDialog(): void {
    this.isPatientSearchDialogOpen = false;
    this.patientSearchError = '';
  }

  clearPatientSearch(): void {
    this.patientSearchForm = { ...INITIAL_PATIENT_SEARCH_FORM };
    this.patientSearchResults = [];
    this.patientSearchError = '';
  }

  async searchPatients(): Promise<void> {
    this.patientSearchError = '';
    this.patientSearchResults = [];

    const payload = this.buildPatientSearchPayload();
    const hasSearchValue = [
      payload.sSearchPatientFirstName,
      payload.sSearchPatientMiddleName,
      payload.sSearchPatientLastName,
      payload.sSearchPatientMotherName,
      payload.sSearchMobileNumber,
      payload.nSearchPatientId
    ].some((value) => value.trim() !== '');

    if (!hasSearchValue) {
      this.patientSearchError = 'Enter at least one patient detail to search.';
      return;
    }

    this.isSearchingPatients = true;

    try {
      const response = await fetch(PATIENT_SEARCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Patient search failed with status ${response.status}.`);
      }

      const data = (await response.json()) as unknown;
      const normalizedResults = normalizePatientRecords(data);
      this.patientSearchResults = normalizedResults;

      if (normalizedResults.length === 0) {
        this.patientSearchError = 'No matching patients were found.';
      }
    } catch (error) {
      this.patientSearchError =
        error instanceof Error ? error.message : 'Unable to search patients right now.';
    } finally {
      this.isSearchingPatients = false;
      this.cdr.detectChanges();
    }
  }

  selectPatient(patient: PatientSearchRecord): void {
    this.selectedPatient = patient;
    this.closePatientSearchDialog();
    this.sendSelectedPatientToIframe();
  }

  trackPatient(_index: number, patient: PatientSearchRecord): string {
    return patient.hospitalPatientId || patient.patientId || patient.displayLabel;
  }

  private sendSelectedPatientToIframe(): void {
    if (!this.isBrowser() || !this.showStaffIframe || !this.selectedPatient) {
      return;
    }

    const iframe = this.getIframeElement('staff');
    const targetOrigin = this.getIframeTargetOrigin('staff');
    if (!iframe?.contentWindow) {
      return;
    }

    iframe.contentWindow.postMessage(this.buildSelectedPatientMessage(), targetOrigin);
  }

  private replyWithSelectedPatient(source: MessageEventSource | null, origin: string): void {
    if (!source || typeof source === 'function' || !this.selectedPatient) {
      return;
    }

    try {
      const targetWindow = source as WindowProxy;
      targetWindow.postMessage(this.buildSelectedPatientMessage(), origin);
    } catch {
      this.sendSelectedPatientToIframe();
    }
  }

  private buildSelectedPatientMessage(): { type: string; patient: Record<string, string> } {
    const patient = this.selectedPatient;
    if (!patient) {
      return { type: IFRAME_MESSAGE_PATIENT_SELECTION, patient: {} };
    }

    return {
      type: IFRAME_MESSAGE_PATIENT_SELECTION,
      patient: {
        patientId: patient.patientId,
        hospitalPatientId: patient.hospitalPatientId,
        patientGuid: patient.patientGuid,
        firstName: patient.firstName,
        middleName: patient.middleName,
        lastName: patient.lastName,
        mobileNumber: patient.mobileNumber,
        dob: patient.dob ?? '',
        age: patient.age ?? '',
        gender: patient.gender ?? '',
        fullName: patient.fullName,
        displayLabel: patient.displayLabel,
        selectedAt: new Date().toISOString()
      }
    };
  }

  private buildPatientSearchPayload(): PatientSearchApiPayload {
    return {
      exactMatch: this.patientSearchForm.exactMatch,
      nHospitalBranchId: this.patientSearchBranchId,
      sSearchPatientFirstName: this.patientSearchForm.firstName.trim(),
      sSearchPatientMiddleName: this.patientSearchForm.middleName.trim(),
      sSearchPatientLastName: this.patientSearchForm.lastName.trim(),
      sSearchPatientMotherName: this.patientSearchForm.motherName.trim(),
      sSearchMobileNumber: this.patientSearchForm.mobileNumber.trim(),
      nSearchPatientId: this.patientSearchForm.patientId.trim()
    };
  }

  private getIframeElement(type: 'patient' | 'staff'): HTMLIFrameElement | null {
    if (!this.isBrowser()) {
      return null;
    }

    const className = type === 'patient' ? '.patient-iframe' : '.staff-iframe';
    return document.querySelector(className) as HTMLIFrameElement | null;
  }

  private getIframeTargetOrigin(type: 'patient' | 'staff'): string {
    const baseUrl = type === 'patient' ? this.patientUrl : this.staffUrl;
    try {
      return new URL(baseUrl).origin;
    } catch {
      return 'https://vatsalyacare.ai';
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
