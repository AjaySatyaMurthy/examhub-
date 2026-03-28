function toggleModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.toggle('active');
  }
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
