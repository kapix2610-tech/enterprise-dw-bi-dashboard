import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

test('renders the analytics dashboard', async () => {
  localStorage.clear();
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/api/health')) {
      return Promise.resolve({ ok: true, json: async () => ({ database: 'connected' }) });
    }
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve({ ok: true, json: async () => ({ user: { id: 'test-user', name: 'Test User', email: 'test@example.com' } }) });
    }
    if (url.includes('/api/sources')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (url.includes('/api/files')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({ ok: true, json: async () => ({ token: 'test-token', user: { id: 'test-user', name: 'Test User', email: 'test@example.com' } }) });
  });
  render(<App />);
  expect(await screen.findByText(/secure database connected/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/What should your dashboard help you understand/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
  expect(await screen.findByText(/your general business command center/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /＋ New/i }));
  fireEvent.click(screen.getByText('Hospital'));
  fireEvent.click(screen.getByText('＋ Customers / users'));
  fireEvent.click(screen.getByText('CSV or Excel files'));
  fireEvent.click(screen.getByRole('button', { name: /Build my workspace/i }));
  expect(await screen.findByText(/your hospital command center/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Customers \/ users/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Revenue \/ income/i })).not.toBeInTheDocument();

  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete Hospital workspace' }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Its datasets, chats, and reports will be kept'));
  expect(await screen.findByText(/your general business command center/i)).toBeInTheDocument();
  confirm.mockRestore();
});

test('rejects a cached token when the backend says the session is invalid', async () => {
  localStorage.setItem('datawise-token', 'stale-token');
  localStorage.setItem('datawise-user', JSON.stringify({ id: 'old-user', name: 'Old User' }));
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Session expired.' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ database: 'connected' }) });
  });

  render(<App />);
  expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem('datawise-token')).toBeNull());
});

test('confirms an emailed account link and starts its session', async () => {
  localStorage.clear();
  window.history.pushState({}, '', '/?verify=verified-link-token');
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/api/auth/verify-email')) {
      return Promise.resolve({ ok: true, json: async () => ({ token: 'verified-session', user: { id: 'verified-user', name: 'Verified User', email: 'verified@example.com' } }) });
    }
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve({ ok: true, json: async () => ({ user: { id: 'verified-user', name: 'Verified User', email: 'verified@example.com' } }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });

  render(<App />);
  expect(await screen.findByRole('heading', { name: /what should your dashboard help you understand/i })).toBeInTheDocument();
  expect(localStorage.getItem('datawise-user')).toContain('verified@example.com');
  expect(window.location.search).toBe('');
});

test('starts the laptop session after confirmation completes on another device', async () => {
  localStorage.clear();
  const originalCrypto = window.crypto;
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { getRandomValues: (bytes) => bytes.fill(7) },
  });
  let signupRequest;
  let claimRequest;
  let releaseClaim;
  const confirmedSession = {
    token: 'laptop-session',
    user: { id: 'new-user', name: 'New User', email: 'new@example.com' },
  };
  global.fetch = jest.fn((url, options = {}) => {
    if (url.endsWith('/api/health')) {
      return Promise.resolve({ ok: true, json: async () => ({ database: 'connected' }) });
    }
    if (url.endsWith('/api/auth/signup')) {
      signupRequest = options;
      return Promise.resolve({ ok: true, json: async () => ({ verificationRequired: true, email: 'new@example.com' }) });
    }
    if (url.endsWith('/api/auth/claim-email-verification')) {
      claimRequest = options;
      return new Promise((resolve) => {
        releaseClaim = () => resolve({ ok: true, json: async () => confirmedSession });
      });
    }
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve({ ok: true, json: async () => ({ user: confirmedSession.user }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /create account/i }));
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New User' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByText(/we sent a confirmation link/i)).toBeInTheDocument();
  await waitFor(() => expect(releaseClaim).toBeDefined());
  const signupHandoffToken = JSON.parse(signupRequest.body).handoffToken;
  expect(signupHandoffToken).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.parse(claimRequest.body).handoffToken).toBe(signupHandoffToken);

  await act(async () => releaseClaim());
  expect(await screen.findByRole('heading', { name: /what should your dashboard help you understand/i })).toBeInTheDocument();
  expect(localStorage.getItem('datawise-token')).toBe('laptop-session');
  if (originalCrypto) Object.defineProperty(window, 'crypto', { configurable: true, value: originalCrypto });
  else delete window.crypto;
});
