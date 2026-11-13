// Runs before paint so the stored theme never flashes. Storage access is
// wrapped: it throws in some private modes and sandboxed previews.
const code = `(function(){try{var t=localStorage.getItem("yt-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
