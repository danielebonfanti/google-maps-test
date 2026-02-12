let sessionToken;
let autocompleteService;
let placesService;

const mapElement = document.querySelector("gmp-map");
let innerMap;
let markerArray = [];
let clinics = [];

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

async function initAutocomplete() {
  const { AutocompleteService, PlacesService } =
    await google.maps.importLibrary("places");

  autocompleteService = new AutocompleteService();
  placesService = new PlacesService(document.createElement("div")); // Dummy div per caricare il servizio

  // Generiamo il primo token quando l'utente interagisce con la ricerca
  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

let timeoutId;
function onSearchInput(query) {
  const list = document.getElementById("results-list");

  if (!query) {
    list.innerHTML = "";
    return;
  }

  // Debouncing applicato qui
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    autocompleteService.getPlacePredictions(
      {
        input: query,
        sessionToken: sessionToken,
        componentRestrictions: { country: "it" }, // Risparmia errori di ricerca
      },
      (predictions, status) => {
        list.innerHTML = ""; // Pulisce i vecchi suggerimenti

        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          return;
        }

        predictions.forEach((prediction) => {
          const li = document.createElement("li");
          li.textContent = prediction.description;
          li.onclick = () => {
            selectPlace(prediction.place_id);
            list.innerHTML = ""; // Chiude la lista dopo il click
            document.getElementById("autocomplete-input").value =
              prediction.description;
          };
          list.appendChild(li);
        });
      },
    );
  }, 300);
}

function selectPlace(placeId) {
  const infoWindow = new google.maps.InfoWindow();

  placesService.getDetails(
    {
      placeId: placeId,
      sessionToken: sessionToken,
      // FONDAMENTALE: Chiedi solo i dati che servono (Basic Data = Costo minore)
      fields: ["geometry", "name", "formatted_address", "geometry"],
    },
    (place, status) => calculateMarkers(place, status),
  );
}

async function calculateMarkers(place, status) {
  if (status === "OK") {
    markerArray.forEach((marker) => marker.setMap(null));
    markerArray = [];

    innerMap.setCenter(place.geometry.location);

    if (place.viewport) {
      innerMap.fitBounds(place.viewport);
    } else {
      innerMap.setCenter(place.location);
      innerMap.setZoom(17);
    }

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

    clinicsWithDistance = clinicsWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    const bounds = new google.maps.LatLngBounds();
    clinicsWithDistance.forEach((signal) => {
      var position = {
        lat: parseInt(signal.LAT),
        lng: parseInt(signal.LONG),
      };
      var marker = new google.maps.marker.AdvancedMarkerElement({
        map: innerMap,
        position: position,
        title: signal.NAME,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(`<strong>${signal.NAME}</strong>`);

        infoWindow.open({
          anchor: marker,
          map: innerMap,
        });
      });

      markerArray.push(marker);

      bounds.extend(position);
    });

    innerMap.fitBounds(bounds);

    // 3. RIGENERA IL TOKEN per la prossima ricerca
    sessionToken = new google.maps.places.AutocompleteSessionToken();
  }
}

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
