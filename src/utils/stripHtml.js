/** Texto visível de HTML (e entidades `&lt;p&gt;` armazenadas como texto). */
export function stripHtml(html) {
  if (html == null) return '';
  const source = String(html);
  if (!source.trim()) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = source;
  let text = tmp.textContent || tmp.innerText || '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    tmp.innerHTML = text;
    text = tmp.textContent || tmp.innerText || '';
  }
  return text;
}
