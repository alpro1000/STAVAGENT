/**
 * FlatMainPage — Main page layout for Part A (new flat design).
 *
 * Sidebar + main content area with KPI panel and positions table.
 * Deep-link support: ?bridge=X, ?auth_token=T, ?project=X
 */

import { useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import FlatHeader from './FlatHeader';
import FlatSidebar from './FlatSidebar';
import FlatPositionsTable from './FlatPositionsTable';

export default function FlatMainPage() {
  const { sidebarOpen, setSidebarOpen } = useUI();

  // Keyboard shortcut: Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  // Store auth_token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('auth_token');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Restore scroll position when returning from /planner
  useEffect(() => {
    const returnPart = sessionStorage.getItem('monolit-planner-return-part');
    const scrollY = sessionStorage.getItem('monolit-planner-scroll-y');

    if (returnPart) {
      sessionStorage.removeItem('monolit-planner-return-part');
      sessionStorage.removeItem('monolit-planner-scroll-y');

      // Wait for DOM to render, then scroll to part
      setTimeout(() => {
        const partEl = document.getElementById(`part-${returnPart}`);
        if (partEl) {
          partEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Highlight briefly
          partEl.style.outline = '3px solid var(--orange-500)';
          partEl.style.outlineOffset = '2px';
          setTimeout(() => {
            partEl.style.outline = '';
            partEl.style.outlineOffset = '';
          }, 3000);
        } else if (scrollY) {
          window.scrollTo(0, parseInt(scrollY, 10));
        }
      }, 300);
    }
  }, []);

  return (
    <div className="flat-app">
      <FlatHeader />
      <div className="flat-layout">
        {/* Mobile backdrop — CSS handles visibility via @media */}
        {sidebarOpen && (
          <div
            className="flat-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <FlatSidebar />

        <main className="flat-main">
          <FlatPositionsTable />
        </main>
      </div>
    </div>
  );
}
