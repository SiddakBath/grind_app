import { LoginForm } from '@/components/LoginForm';
import Link from 'next/link';

// Force dynamic rendering for login page
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-6">
        <img src="/logo.png" alt="hustlebro.ai logo" className="h-16 w-auto" />
      </Link>
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}