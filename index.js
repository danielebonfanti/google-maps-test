const mapElement = document.querySelector("gmp-map");
const placeAutocomplete = document.querySelector("gmp-place-autocomplete");
let innerMap;
let markerArray = [];

async function initMap() {
  const data = await fetch("clinics.csv");
  const raw = await data.text();

  var clinics = [];

  Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      clinics = results.data;
    },
  });

  const [] = await Promise.all([
    google.maps.importLibrary("marker"),
    google.maps.importLibrary("places"),
  ]);

  innerMap = mapElement.innerMap;
  innerMap.setOptions({
    mapTypeControl: false,
  });

  const infoWindow = new google.maps.InfoWindow();

  placeAutocomplete.addEventListener(
    "gmp-select",
    async ({ placePrediction }) => {
      markerArray.forEach((marker) => marker.setMap(null));
      markerArray = [];

      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
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
            place.location.lat(),
            place.location.lng(),
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
    },
  );
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

initMap();
