import { Injectable } from '@angular/core';
import { EnvironmentService } from './environment.service';

export type HospitalBranch = {
  hospitalBranchId: number;
  hospitalId?: number;
  hospitalBranchGuid?: string;
  hospitalBranchName?: string;
  hospitalSiteAddress1?: string;
  cityName?: string;
  stateName?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
};

export type Doctor = {
  doctorId: number;
  doctorguid?: string;
  doctorfirstname?: string;
  doctorlastname?: string;
  doctorFirstName?: string;
  doctorLastName?: string;
  UserId?: number;
  userId?: number;
};

type BranchListResponse = {
  bIsSuccess?: boolean;
  oData?: {
    oHospitalList?: HospitalBranch[];
  };
  sMessage?: string;
};

@Injectable({ providedIn: 'root' })
export class DoctorBranchService {
  private readonly apiBaseUrl = 'https://testpracteaz.azurewebsites.net/api';

  constructor(private readonly environmentService: EnvironmentService) {}

  async getBranches(userId: number): Promise<HospitalBranch[]> {
    const response = await this.request<BranchListResponse>(
      `/Appointment/getHospitalBranchList/${encodeURIComponent(userId)}`
    );

    if (response?.bIsSuccess === false) {
      throw new Error(response.sMessage || 'Unable to load hospital branches.');
    }

    const branches = response?.oData?.oHospitalList;
    if (!Array.isArray(branches)) {
      throw new Error('The backend returned an invalid hospital branch response.');
    }

    return branches.filter((branch) => Number(branch?.hospitalBranchId) > 0);
  }

  async getDoctors(branchId: number): Promise<Doctor[]> {
    const doctors = await this.request<Doctor[]>(
      `/DoctorHospital/GetDoctorListByHospitalId/${encodeURIComponent(branchId)}`
    );

    if (!Array.isArray(doctors)) {
      throw new Error('The backend returned an invalid doctor response.');
    }

    return doctors.filter((doctor) => Number(doctor?.doctorId) > 0);
  }

  private async request<T>(path: string): Promise<T> {
    const token = this.environmentService.getToken();
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const body = (await response.json().catch(() => null)) as T | { message?: string } | null;
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
      throw new Error(message || `Backend request failed with status ${response.status}.`);
    }

    return body as T;
  }
}
