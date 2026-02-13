let sessionToken;
let autocompleteService;
let placesService;

const mapElement = document.querySelector("gmp-map");
let innerMap;
let clinics = [];
let timeoutId;

/**
 * This function fetches the clinics data from a CSV file, parses it using the PapaParse library, and stores the resulting array of clinic objects in the clinics variable.
 */
async function readClinics() {
  const data = await fetch("clinics.csv");
  const raw = await data.text();

  Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      clinics = results.data;
    },
  });
}

/**
 * This function imports the necessary libraries for the map, initializes the inner map, and sets some options for the map.
 */
async function initMap() {
  const [] = await Promise.all([
    google.maps.importLibrary("marker"),
    google.maps.importLibrary("places"),
  ]);

  innerMap = mapElement.innerMap;
  innerMap.setOptions({
    mapTypeControl: false,
  });
}

/**
 * This function imports the necessary libraries for the autocomplete functionality, initializes the AutocompleteService and PlacesService, and creates a new session token for the autocomplete session.
 */
async function initAutocomplete() {
  const { AutocompleteService, PlacesService } =
    await google.maps.importLibrary("places");

  autocompleteService = new AutocompleteService();
  placesService = new PlacesService(document.createElement("div"));

  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

/**
 * This function is called whenever the user types in the search input. It first checks if the query is empty, and if it is, it clears the results list and returns. If the query is not empty, it clears any existing timeout and sets a new timeout to call the getPlacePredictions method of the AutocompleteService after 300 milliseconds. This is done to prevent making too many requests to the API while the user is typing.
 * @param {string} query
 * @returns
 */
function onSearchInput(query) {
  if (query.length < 3) return;

  const list = document.getElementById("results-list");
  if (!query) {
    sessionToken = new google.maps.places.AutocompleteSessionToken();
    list.innerHTML = "";
    return;
  }

  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    autocompleteService.getPlacePredictions(
      {
        input: query,
        sessionToken: sessionToken,
        componentRestrictions: { country: "it" },
      },
      (predictions, status) => {
        handlePredictionResults(predictions, status, list);
      },
    );
  }, 300);
}

/**
 * This function takes the predictions returned by the autocomplete service and the status of the request as arguments. It first clears the results list, then checks if the status is "OK" and if there are any predictions. If the status is not "OK" or if there are no predictions, it simply returns. If the status is "OK" and there are predictions, it removes the "hidden" class from the autocomplete card to make it visible, and calls the renderPredictions function to display the predictions in the results list.
 * @param {*} predictions
 * @param {*} status
 */
function handlePredictionResults(predictions, status, list) {
  list.innerHTML = "";

  if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
    return;
  }

  document.getElementById("autocomplete-card").classList.remove("hidden");

  renderPredictions(predictions, list);
}

/**
 * This function takes the predictions returned by the autocomplete service and creates a list item for each prediction. Each list item has an onclick event that calls the selectPlace function with the place ID of the selected prediction, hides the autocomplete card, clears the results list, and sets the value of the search input to the description of the selected prediction.
 * @param {*} predictions
 * @param {*} list
 */
function renderPredictions(predictions, list) {
  predictions.forEach((prediction) => {
    const li = document.createElement("li");
    li.textContent = prediction.description;
    li.onclick = () => {
      selectPlace(prediction.place_id);
      document.getElementById("autocomplete-card").classList.add("hidden");
      list.innerHTML = "";
      document.getElementById("autocomplete-input").value =
        prediction.description;
    };
    list.appendChild(li);
  });
}

/**
 * This function takes a place ID as an argument and uses the PlacesService to get the details of the selected place. It specifies that it only wants certain fields (geometry, name, formatted_address) to minimize the cost of the request. Once it receives the place details, it calls the calculateMarkers function to calculate the distance from the selected place to each clinic and display
 * @param {*} placeId
 */
function selectPlace(placeId) {
  placesService.getDetails(
    {
      placeId: placeId,
      sessionToken: sessionToken,
      // FONDAMENTALE: Chiedere solo i dati che servono (Basic Data = Costo minore)
      fields: ["geometry.location"],
    },
    (place, status) => calculateMarkers(place, status),
  );
}

/**
 * This function first checks if the status of the place details request is "OK". If it is, it calculates the distance from the selected place to each clinic using the calculateClinicsDistance function, then displays the clinics on the map using the displayClinicsOnMap function. Finally, it generates a new session token for the next search.
 * @param {*} place
 * @param {*} status
 */
async function calculateMarkers(place, status) {
  if (status != "OK") return;

  var clinicsWithDistance = calculateClinicsDistance(place);
  displayMarkerClinicsOnMap(clinicsWithDistance);
  displayClosestClinicsList(clinicsWithDistance);

  // RIGENERA IL TOKEN per la prossima ricerca
  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

/**
 * This function takes an array of clinics with their distance from the selected place, creates a marker for each clinic on the map, and sets up an info window that displays the clinic's name when the marker is clicked. It also adjusts the map bounds to ensure all markers are visible.
 * @param {*} clinicsWithDistance
 */
function displayMarkerClinicsOnMap(clinicsWithDistance) {
  let markerArray = [];
  const bounds = new google.maps.LatLngBounds();
  clinicsWithDistance.forEach((clinic) => {
    var position = {
      lat: parseInt(clinic.LAT),
      lng: parseInt(clinic.LONG),
    };
    var marker = new google.maps.marker.AdvancedMarkerElement({
      map: innerMap,
      position: position,
      title: clinic.NAME,
    });

    marker.addListener("click", () => {
      infoWindow.setContent(`<strong>${clinic.NAME}</strong>`);

      infoWindow.open({
        anchor: marker,
        map: innerMap,
      });
    });

    markerArray.push(marker);

    bounds.extend(position);
  });

  innerMap.fitBounds(bounds);
}

/**
 * This function takes an array of clinics with their distance from the selected place and displays a list of the 5 closest clinics in the "closest-clinics-list" element. Each list item shows the clinic's name and its distance from the selected place in kilometers, rounded to two decimal places.
 * @param {*} clinicsWithDistance
 */
function displayClosestClinicsList(clinicsWithDistance) {
  const list = document.getElementById("closest-clinics-list");
  list.innerHTML = "";
  clinicsWithDistance.forEach((clinic) => {
    const li = document.createElement("li");
    li.textContent = `${clinic.NAME} (${clinic.distance.toFixed(2)} km)`;
    list.appendChild(li);
  });
}

/**
 * This function calculates the distance between the place and each clinic, then sorts the clinics by distance and returns the 5 closest ones.
 * @param {*} place
 * @returns the 5 closest clinics to the place, with their distance from the place included in the returned objects.
 */
function calculateClinicsDistance(place) {
  var clinicsWithDistance = clinics.map((element) => {
    return {
      ...element,
      distance: haversineDistance(
        element.LAT,
        element.LONG,
        place.geometry.location.lat(),
        place.geometry.location.lng(),
      ),
    };
  });

  return clinicsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}

/**
 * This function calculates the distance between two points on the Earth using the Haversine formula, which accounts for the spherical shape of the Earth. The distance is returned in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns the distance between the two points in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

await Promise.all([initMap(), initAutocomplete(), readClinics()]);

window.onSearchInput = onSearchInput;
