// IntersectionObserver for scroll animations
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.classList.add('in-view');
      animObserver.unobserve(el.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-anim]').forEach(el => animObserver.observe(el));

function heroInlineSearch() {
  const spec = (document.getElementById('heroInlineSearch')?.value || '').trim();
  const city = (document.getElementById('heroSearchCityInline')?.value || '').trim();
  const params = new URLSearchParams();
  if (spec) params.set('specialty', spec);
  if (city) params.set('city', city);
  window.location.href = 'talalatok.html?' + params.toString();
}

function doClassicSearch() {
  const spec = (document.getElementById('classicSpec')?.value || '').trim();
  const city = (document.getElementById('classicCity')?.value || '').trim();
  const params = new URLSearchParams();
  if (spec) params.set('specialty', spec);
  if (city) params.set('city', city);
  window.location.href = 'talalatok.html?' + params.toString();
}

function classicChip(spec) {
  document.getElementById('classicSpec').value = spec;
  doClassicSearch();
}

function useExample(btn) {
  const text = btn.textContent.replace(/^💬\s*/, '').trim();
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  input.setAttribute('placeholder', '');
  const ex = document.getElementById('chatExamples');
  if (ex) ex.style.display = 'none';
  sendChat();
}
</script>

</body>
