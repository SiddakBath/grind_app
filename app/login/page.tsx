import { LoginForm } from '@/components/LoginForm';
import Link from 'next/link';

// Force dynamic rendering for login page
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-6">
        <span className="font-bold text-3xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
          hustlebro.ai
        </span>
      </Link>
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}