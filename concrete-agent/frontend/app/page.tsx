import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to projects page (main page according to MASTER_PLAN)
  redirect('/projects');
}
