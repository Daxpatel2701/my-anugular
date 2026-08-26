import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { EnvironmentService } from './environment.service';

class MockEnvironmentService {
  private token: string | null = null;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  removeToken(): void {
    this.token = null;
  }

  hasToken(): boolean {
    return !!this.token;
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        { provide: EnvironmentService, useClass: MockEnvironmentService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render login heading', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Login');
  });

  it('should accept an authentication message from the trusted parent window', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const environmentService = TestBed.inject(EnvironmentService) as unknown as MockEnvironmentService;
    fixture.detectChanges();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'AUTH_TOKEN', token: 'token-from-parent' },
        origin: 'http://localhost:4200',
        source: window
      })
    );

    expect(app.isAuthenticated).toBeTrue();
    expect(environmentService.getToken()).toBe('token-from-parent');
  });
});
