const input = document.getElementById('place-input');
const button = document.getElementById('add-place-button');
const placeList = document.getElementById('place-list');

function addPlace() {
  if (input.value.trim() !== '') {
    const newPlace = document.createElement('li');
    newPlace.textContent = input.value.trim();
    placeList.appendChild(newPlace);
    input.value = '';
  }
}

button.addEventListener('click', function () {
  addPlace();
});

input.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    addPlace();
  }
});
