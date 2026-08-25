import { Component, inject, OnInit, NgZone, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EnvironmentService } from './environment.service';
import { Doctor, DoctorBranchService, HospitalBranch } from './doctor-branch.service';

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
const IFRAME_MESSAGE_DOCTOR_BRANCH_SELECTION = 'DOCTOR_BRANCH_SELECTION';
const IFRAME_MESSAGE_REQUEST_DOCTOR_BRANCH_SELECTION = 'REQUEST_DOCTOR_BRANCH_SELECTION';
const IFRAME_AUTH_MESSAGE = 'AUTH_TOKEN';
const SELECTED_HOSPITAL_KEY = 'SelectedHospital';
const HOSPITAL_ID_KEY = 'hospitalId';
const HOSPITAL_BRANCH_GUID_KEY = 'sSelectedHospitalBranchGuid';
const HOSPITAL_BRANCH_NAME_KEY = 'sHospitalBranchName';
const HOSPITAL_ADDRESS_KEY = 'hospitalSiteAddress';
const SELECTED_DOCTOR_KEY = 'SelectedDoctor';
const SELECTED_DOCTOR_NAME_KEY = 'SelectedDoctorName';
const SELECTED_DOCTOR_GUID_KEY = 'SelectedDoctorGuid';
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

function readNumericValue(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function getUserIdFromToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='))) as Record<string, unknown>;
    return readNumericValue(payload, [
      'UserId',
      'userId',
      'userID',
      'user_id',
      'ID',
      'id',
      'nameid',
      'sub',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
    ]);
  } catch {
    return null;
  }
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
  private doctorBranchService = inject(DoctorBranchService);
  private sanitizer = inject(DomSanitizer);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  token = '';
  isAuthenticated = false;

  showPatientIframe = false;
  showStaffIframe = false;
  patientIframeUrl!: SafeResourceUrl;
  staffIframeUrl!: SafeResourceUrl;
  patientUrl = 'http://localhost:3000/patient';
  staffUrl = 'http://localhost:3000/doctor';

  isPatientSearchDialogOpen = false;
  patientSearchForm: PatientSearchForm = { ...INITIAL_PATIENT_SEARCH_FORM };
  patientSearchResults: PatientSearchRecord[] = [];
  selectedPatient: PatientSearchRecord | null = null;
  isSearchingPatients = false;
  patientSearchError = '';
  readonly patientSearchBranchId = DEFAULT_BRANCH_ID;

  // Doctor/branch workspace context used by the .NET-backed swap flow.
  hospitalBranches: HospitalBranch[] = [];
  doctors: Doctor[] = [];
  selectedBranchId: number | null = null;
  selectedDoctorId: number | null = null;
  backendUserId = '';
  isContextLoading = false;
  contextError = '';
  contextNotice = '';
  contextLoaded = false;
  private doctorRequestId = 0;
  private contextRequestId = 0;

  ngOnInit(): void {
    this.updateIframeUrls();
    if (this.isBrowser()) {
      this.setupMessageListener();
    }

    const storedToken = this.environmentService.getToken();
    if (storedToken) {
      this.token = storedToken;
      this.isAuthenticated = true;
      void this.loadDoctorBranchContext();
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

      if (
        event.data.type === IFRAME_MESSAGE_REQUEST_DOCTOR_BRANCH_SELECTION &&
        this.isMessageFromStaffIframe(event)
      ) {
        this.replyWithDoctorBranchSelection(event.source, event.origin);
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
          this.sendDoctorBranchToIframe(true);
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
        this.sendDoctorBranchToIframe(true);
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

    const previousToken = this.environmentService.getToken();
    const tokenChanged = previousToken !== trimmedToken;
    if (tokenChanged) {
      this.clearDoctorBranchContext();
    }

    this.environmentService.setToken(trimmedToken);
    this.isAuthenticated = true;
    this.updateIframeUrls();
    this.token = '';
    this.contextNotice = '';
    void this.loadDoctorBranchContext();

    if (this.showPatientIframe || this.showStaffIframe) {
      setTimeout(() => {
        if (this.showPatientIframe) {
          this.sendTokenToIframe('patient');
        }
        if (this.showStaffIframe) {
          this.sendTokenToIframe('staff');
          this.sendSelectedPatientToIframe();
          this.sendDoctorBranchToIframe(true);
        }
      }, 250);
    }
  }

  async loadDoctorBranchContext(manualUserId?: string): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const token = this.environmentService.getToken();
    if (!token) {
      this.contextError = 'Enter an authentication token before loading doctor and branch data.';
      return;
    }

    const parsedUserId = Number(manualUserId || this.backendUserId) || getUserIdFromToken(token);
    if (!parsedUserId) {
      this.contextError = 'The token does not contain a numeric user ID. Enter the backend user ID and try again.';
      return;
    }

    this.backendUserId = String(parsedUserId);
    const requestId = ++this.contextRequestId;
    this.isContextLoading = true;
    this.contextError = '';
    this.contextNotice = '';

    try {
      const branches = await this.doctorBranchService.getBranches(parsedUserId);
      if (requestId !== this.contextRequestId) {
        return;
      }
      this.hospitalBranches = branches;
      if (branches.length === 0) {
        throw new Error('No hospital branches are associated with this user.');
      }

      const storedBranchId = this.readStoredNumber(SELECTED_HOSPITAL_KEY);
      const storedUserId = this.readStoredNumber('UserId');
      const hasSameUserContext = storedUserId === parsedUserId;
      const selectedBranch =
        (hasSameUserContext
          ? branches.find((branch) => Number(branch.hospitalBranchId) === storedBranchId)
          : undefined) ||
        branches.find((branch) => branch.isPrimary || branch.isDefault) ||
        branches[0];
      this.selectedBranchId = Number(selectedBranch.hospitalBranchId);

      const storedDoctorId = hasSameUserContext ? this.readStoredNumber(SELECTED_DOCTOR_KEY) : null;
      await this.loadDoctorsForBranch(this.selectedBranchId, storedDoctorId, true);
      if (requestId !== this.contextRequestId) {
        return;
      }
      this.contextLoaded = true;
    } catch (error) {
      if (requestId !== this.contextRequestId) {
        return;
      }
      this.contextLoaded = false;
      this.contextError = error instanceof Error ? error.message : 'Unable to load doctor and branch data.';
    } finally {
      if (requestId === this.contextRequestId) {
        this.isContextLoading = false;
      }
    }
  }

  onBranchChange(value: number | string | null): void {
    const branchId = Number(value);
    this.selectedBranchId = Number.isFinite(branchId) && branchId > 0 ? branchId : null;
    this.selectedDoctorId = null;
    this.doctors = [];
    this.contextNotice = '';
    this.contextError = '';

    if (this.selectedBranchId) {
      void this.loadDoctorsForBranch(this.selectedBranchId, null, false);
    }
  }

  onDoctorChange(value: number | string | null): void {
    const doctorId = Number(value);
    this.selectedDoctorId = Number.isFinite(doctorId) && doctorId > 0 ? doctorId : null;
    this.contextNotice = '';
  }

  applyDoctorBranchSwap(): void {
    const branch = this.selectedBranch;
    const doctor = this.selectedDoctor;
    if (!branch || !doctor) {
      this.contextError = 'Select both a branch and a doctor before applying the swap.';
      return;
    }

    this.persistDoctorBranchContext(branch, doctor);
    this.contextNotice = `Active context: ${this.doctorName(doctor)} at ${this.branchName(branch)}.`;
    this.contextError = '';
    this.sendDoctorBranchToIframe(true);
  }

  get selectedBranch(): HospitalBranch | null {
    return this.hospitalBranches.find((branch) => Number(branch.hospitalBranchId) === this.selectedBranchId) || null;
  }

  get selectedDoctor(): Doctor | null {
    return this.doctors.find((doctor) => Number(doctor.doctorId) === this.selectedDoctorId) || null;
  }

  branchName(branch: HospitalBranch): string {
    return branch.hospitalBranchName || `Branch ${branch.hospitalBranchId}`;
  }

  doctorName(doctor: Doctor): string {
    const first = doctor.doctorfirstname || doctor.doctorFirstName || '';
    const last = doctor.doctorlastname || doctor.doctorLastName || '';
    return `Dr. ${[first, last].filter(Boolean).join(' ').trim() || doctor.doctorId}`;
  }

  private async loadDoctorsForBranch(
    branchId: number,
    preferredDoctorId: number | null,
    persistSelection: boolean
  ): Promise<void> {
    const requestId = ++this.doctorRequestId;
    this.isContextLoading = true;
    this.contextError = '';

    try {
      const doctors = await this.doctorBranchService.getDoctors(branchId);
      if (requestId !== this.doctorRequestId) {
        return;
      }

      this.doctors = doctors;
      const preferredDoctor =
        doctors.find((doctor) => Number(doctor.doctorId) === preferredDoctorId) ||
        doctors.find((doctor) => Number(doctor.UserId || doctor.userId) === Number(this.backendUserId));
      this.selectedDoctorId = Number(preferredDoctor?.doctorId || doctors[0]?.doctorId) || null;

      if (!this.selectedDoctorId) {
        this.contextError = 'No active doctors were found for the selected branch.';
        return;
      }

      if (persistSelection) {
        const branch = this.selectedBranch;
        const doctor = this.selectedDoctor;
        if (branch && doctor) {
          this.persistDoctorBranchContext(branch, doctor);
          this.sendDoctorBranchToIframe(true);
        }
      }
    } catch (error) {
      if (requestId !== this.doctorRequestId) {
        return;
      }
      this.doctors = [];
      this.selectedDoctorId = null;
      this.contextError = error instanceof Error ? error.message : 'Unable to load doctors for this branch.';
    } finally {
      if (requestId === this.doctorRequestId) {
        this.isContextLoading = false;
      }
    }
  }

  private persistDoctorBranchContext(branch: HospitalBranch, doctor: Doctor): void {
    if (!this.isBrowser()) {
      return;
    }

    const first = doctor.doctorfirstname || doctor.doctorFirstName || '';
    const last = doctor.doctorlastname || doctor.doctorLastName || '';
    const doctorDisplayName = [first, last].filter(Boolean).join(' ').trim();
    const doctorGuid = doctor.doctorguid || '';
    const branchId = Number(branch.hospitalBranchId);
    const doctorId = Number(doctor.doctorId);
    const address = [branch.hospitalSiteAddress1, branch.cityName, branch.stateName]
      .filter(Boolean)
      .join(' ');

    sessionStorage.setItem(SELECTED_HOSPITAL_KEY, String(branchId));
    sessionStorage.setItem(HOSPITAL_ID_KEY, String(branch.hospitalId || ''));
    sessionStorage.setItem(HOSPITAL_BRANCH_GUID_KEY, branch.hospitalBranchGuid || '');
    sessionStorage.setItem(HOSPITAL_BRANCH_NAME_KEY, this.branchName(branch));
    sessionStorage.setItem(HOSPITAL_ADDRESS_KEY, address);
    sessionStorage.setItem(SELECTED_DOCTOR_KEY, String(doctorId));
    sessionStorage.setItem(SELECTED_DOCTOR_NAME_KEY, doctorDisplayName);
    sessionStorage.setItem(SELECTED_DOCTOR_GUID_KEY, doctorGuid);
    sessionStorage.setItem('UserId', this.backendUserId);
  }

  private clearDoctorBranchContext(): void {
    if (this.isBrowser()) {
      [
        SELECTED_HOSPITAL_KEY,
        HOSPITAL_ID_KEY,
        HOSPITAL_BRANCH_GUID_KEY,
        HOSPITAL_BRANCH_NAME_KEY,
        HOSPITAL_ADDRESS_KEY,
        SELECTED_DOCTOR_KEY,
        SELECTED_DOCTOR_NAME_KEY,
        SELECTED_DOCTOR_GUID_KEY,
        'UserId'
      ].forEach((key) => sessionStorage.removeItem(key));
    }

    this.contextRequestId++;
    this.doctorRequestId++;
    this.backendUserId = '';
    this.hospitalBranches = [];
    this.doctors = [];
    this.selectedBranchId = null;
    this.selectedDoctorId = null;
    this.contextLoaded = false;
    this.contextError = '';
    this.contextNotice = '';
  }

  private readStoredNumber(key: string): number | null {
    if (!this.isBrowser()) {
      return null;
    }

    const value = Number(sessionStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private sendDoctorBranchToIframe(force = false): void {
    if (!this.isBrowser() || !this.showStaffIframe || !this.selectedBranch) {
      return;
    }

    const iframe = this.getIframeElement('staff');
    const targetOrigin = this.getIframeTargetOrigin('staff');
    if (!iframe?.contentWindow) {
      return;
    }

    const doctor = this.selectedDoctor;
    const selection = {
      branchId: Number(this.selectedBranch.hospitalBranchId),
      hospitalBranchId: Number(this.selectedBranch.hospitalBranchId),
      branchGuid: this.selectedBranch.hospitalBranchGuid || '',
      hospitalBranchGuid: this.selectedBranch.hospitalBranchGuid || '',
      branchName: this.branchName(this.selectedBranch),
      hospitalBranchName: this.branchName(this.selectedBranch),
      hospitalId: Number(this.selectedBranch.hospitalId) || null,
      doctorId: doctor ? Number(doctor.doctorId) : null,
      doctorName: doctor ? this.doctorName(doctor) : '',
      doctorGuid: doctor?.doctorguid || '',
      selectedAt: new Date().toISOString()
    };

    if (force || this.showStaffIframe) {
      iframe.contentWindow.postMessage(
        { type: IFRAME_MESSAGE_DOCTOR_BRANCH_SELECTION, selection },
        targetOrigin
      );
    }
  }

  private replyWithDoctorBranchSelection(source: MessageEventSource | null, origin: string): void {
    if (!source || typeof source === 'function') {
      return;
    }

    try {
      const targetWindow = source as WindowProxy;
      targetWindow.postMessage(
        { type: IFRAME_MESSAGE_DOCTOR_BRANCH_SELECTION, selection: this.buildDoctorBranchSelection() },
        origin
      );
    } catch {
      this.sendDoctorBranchToIframe(true);
    }
  }

  private buildDoctorBranchSelection(): Record<string, number | string | null> {
    const branch = this.selectedBranch;
    const doctor = this.selectedDoctor;
    return {
      branchId: branch ? Number(branch.hospitalBranchId) : 0,
      hospitalBranchId: branch ? Number(branch.hospitalBranchId) : 0,
      branchGuid: branch?.hospitalBranchGuid || '',
      hospitalBranchGuid: branch?.hospitalBranchGuid || '',
      branchName: branch ? this.branchName(branch) : '',
      hospitalBranchName: branch ? this.branchName(branch) : '',
      hospitalId: branch ? Number(branch.hospitalId) || null : null,
      doctorId: doctor ? Number(doctor.doctorId) : null,
      doctorName: doctor ? this.doctorName(doctor) : '',
      doctorGuid: doctor?.doctorguid || '',
      selectedAt: new Date().toISOString()
    };
  }

  private isMessageFromStaffIframe(event: MessageEvent): boolean {
    if (event.origin !== this.getIframeTargetOrigin('staff')) {
      return false;
    }

    const iframe = this.getIframeElement('staff');
    return Boolean(iframe?.contentWindow && iframe.contentWindow === event.source);
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
      return 'http://localhost:3000';
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
