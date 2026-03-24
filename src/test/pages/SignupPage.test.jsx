import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateSpy = vi.fn();
const toastSpy = vi.fn();
const signUpSpy = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: signUpSpy,
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <>{children}</>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import SignupPage from '@/pages/SignupPage';

describe('SignupPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    signUpSpy.mockResolvedValue({
      user: { id: 'user-1' },
      session: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects to login when signUp completes without a session', async () => {
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Str0ng!Passw0rd' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      await Promise.resolve();
    });

    expect(signUpSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(navigateSpy).toHaveBeenCalledWith('/login', { replace: true });
    expect(navigateSpy).not.toHaveBeenCalledWith('/app/onboarding');
  });
});
