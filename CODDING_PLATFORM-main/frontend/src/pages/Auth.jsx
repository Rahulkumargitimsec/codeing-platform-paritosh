import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Check } from 'lucide-react';
import { loginUser, registerUser, clearAuthError } from '../store/authSlice';
import { Logo, Alert, Spinner } from '../components/ui';
import { ThemeToggle } from '../components/AppShell';

function AuthLayout({ title, subtitle, children, footer }) {
  const { serverError } = useSelector((s) => s.auth);
  return (
    <div className="min-h-full paper flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <Link to="/" aria-label="CodeJudge home"><Logo /></Link>
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-[25rem]">
          <div className="panel panel-raised px-6 sm:px-8 py-8">
            <h1 className="text-[1.7rem] font-bold">{title}</h1>
            <p className="text-ink-2 mt-1 mb-6">{subtitle}</p>
            {serverError && <Alert tone="warn" className="mb-4">{serverError}</Alert>}
            {children}
          </div>
          <p className="text-center text-sm text-ink-2 mt-5">{footer}</p>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ registration, invalid, autoComplete, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete}
        className={`input pr-11 ${invalid ? 'is-invalid' : ''}`} {...registration} />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-icon"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const loginSchema = z.object({
  emailId: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export function Login() {
  const dispatch = useDispatch();
  const { submitting, error } = useSelector((s) => s.auth);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  return (
    <AuthLayout title="Log in" subtitle="Pick up where you left off."
      footer={<>New here? <Link to="/signup" className="font-semibold text-accent hover:underline">Create an account</Link></>}>
      {error && <Alert className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit((d) => dispatch(loginUser(d)))} noValidate className="space-y-4">
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" autoFocus className={`input ${errors.emailId ? 'is-invalid' : ''}`} {...register('emailId')} />
          {errors.emailId && <p className="field-error">{errors.emailId.message}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" registration={register('password')} invalid={!!errors.password} />
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? <><Spinner size={16} /> Logging in…</> : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}

const RULES = [
  { test: (p) => p.length >= 8, label: '8 or more characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'An uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'A lowercase letter' },
  { test: (p) => /\d/.test(p), label: 'A number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'A symbol' },
];

const signupSchema = z.object({
  firstName: z.string().trim().min(3, 'Use at least 3 characters').max(20, 'Use at most 20 characters'),
  emailId: z.string().trim().email('Enter a valid email address'),
  password: z.string().refine((p) => RULES.every((r) => r.test(p)), 'Meet every password rule below'),
});

export function Signup() {
  const dispatch = useDispatch();
  const { submitting, error } = useSelector((s) => s.auth);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(signupSchema), defaultValues: { password: '' } });
  const password = watch('password') || '';

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  return (
    <AuthLayout title="Create your account" subtitle="Twelve problems are waiting for you."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link></>}>
      {error && <Alert className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit((d) => dispatch(registerUser(d)))} noValidate className="space-y-4">
        <div>
          <label className="field-label" htmlFor="firstName">First name</label>
          <input id="firstName" autoComplete="given-name" autoFocus className={`input ${errors.firstName ? 'is-invalid' : ''}`} {...register('firstName')} />
          {errors.firstName && <p className="field-error">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className={`input ${errors.emailId ? 'is-invalid' : ''}`} {...register('emailId')} />
          {errors.emailId && <p className="field-error">{errors.emailId.message}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" registration={register('password')} invalid={!!errors.password} />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-ok' : errors.password ? 'text-bad' : 'text-ink-3'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${ok ? 'bg-ok text-white' : 'border border-current'}`}>
                    {ok && <Check size={9} strokeWidth={4} />}
                  </span>
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? <><Spinner size={16} /> Creating account…</> : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
