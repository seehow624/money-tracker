// Inline script that runs BEFORE hydration to avoid FOUC.
// Reads localStorage 'theme' (system|light|dark) and applies the right class
// on <html> immediately.

const SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('mt-theme') || 'system';
    var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(d ? 'dark' : 'light');
  } catch (e) {}
})();
`.trim();

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
      // Run early in head — Next 16 hoists head children; this lives in body but runs sync first thing
    />
  );
}
