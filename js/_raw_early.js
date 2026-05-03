// Ha visszanavigáció (bfcache) történik, kényszerítjük az újratöltést
window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});
</script>
