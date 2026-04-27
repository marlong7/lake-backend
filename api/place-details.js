const GOOGLE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function getOpening(place) {
  return place?.current_opening_hours || place?.opening_hours || null;
}

function pickPhotoReference(place) {
  if (Array.isArray(place?.photos) && place.photos[0]?.photo_reference) {
    return place.photos[0].photo_reference;
  }

  return '';
}

function mapDetailsToResult(place) {
  const opening = getOpening(place);

  const hasOpenNowData = !!opening && typeof opening.open_now === 'boolean';
  const isOpenNow = hasOpenNowData ? opening.open_now === true : false;

  const weekdayText =
    Array.isArray(place?.current_opening_hours?.weekday_text)
      ? place.current_opening_hours.weekday_text
      : Array.isArray(place?.opening_hours?.weekday_text)
     
