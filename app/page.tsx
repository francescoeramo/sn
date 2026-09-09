import { SocialApp } from '@/components/social-app';
export default function Home() {
  return (
    <SocialApp
      demo={false}
      configured={Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      )}
    />
  );
}
